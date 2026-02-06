import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

/**
 * Field Reports WhatsApp Webhook
 * 
 * Endpoint que recibe mensajes de agentes de campo via WhatsApp (a través de n8n).
 * Verifica la whitelist y maneja una conversación para extraer datos del reporte.
 * 
 * Flow:
 * 1. n8n envía mensaje del agente de campo
 * 2. Verificamos si el teléfono está en la whitelist (tabla agente_campo)
 * 3. Si no está, respondemos con mensaje genérico
 * 4. Si está, procesamos el mensaje con AI para extraer datos del reporte
 * 5. Cuando tenemos todos los datos, guardamos la noticia en la BD
 */

interface WhatsAppInboundMessage {
  user_phone: string;
  conversation_id: string;
  timestamp: string;
  sender_type: 'USER' | 'AI' | 'OPERATOR';
  message_text: string;
  message_id: string;
}

// Almacenamiento en memoria de session IDs de OpenAI por teléfono
// En producción podrías usar Redis u otro almacenamiento persistente
const conversationSessions: Map<string, string> = new Map();

const REJECTION_MESSAGE = `Tu número no corresponde a ningún agente registrado.`;

/**
 * POST handler - Webhook entry point from n8n
 */
export async function POST(request: NextRequest) {
  try {
    const body: WhatsAppInboundMessage = await request.json();

    // Validar campos requeridos
    if (!body.user_phone || !body.message_text || !body.conversation_id || !body.message_id) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: user_phone, message_text, conversation_id, message_id' },
        { status: 400 }
      );
    }

    const { user_phone, message_text, conversation_id } = body;
    
    // Normalizar número de teléfono (remover espacios, guiones, etc.)
    const normalizedPhone = normalizePhoneNumber(user_phone);
    
    console.log(`📨 Reporte de campo recibido de ${normalizedPhone}: "${message_text}"`);
    console.log(`📋 Conversation ID: ${conversation_id}`);

    // Verificar si el teléfono está en la whitelist
    const agent = await checkWhitelist(normalizedPhone);

    if (!agent) {
      console.log(`❌ Teléfono ${normalizedPhone} no está en la whitelist`);
      await sendWhatsAppMessage(user_phone, REJECTION_MESSAGE);
      
      return NextResponse.json({
        success: true,
        authorized: false,
        message: 'Phone number not in whitelist'
      });
    }

    console.log(`✅ Agente autorizado: ${agent.nombre} (${agent.provincia})`);

    // Procesar el mensaje con el agente AI (usamos conversation_id para la sesión)
    const aiResponse = await processFieldReportMessage(
      conversation_id,
      message_text,
      agent
    );

    if (aiResponse) {
      await sendWhatsAppMessage(user_phone, aiResponse);
    }

    return NextResponse.json({
      success: true,
      authorized: true,
      agent_name: agent.nombre,
      conversation_id
    });

  } catch (error) {
    console.error('❌ Error processing field report webhook:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Normaliza el número de teléfono para comparación consistente
 */
function normalizePhoneNumber(phone: string): string {
  // Remover todo excepto dígitos
  return phone.replace(/\D/g, '');
}

/**
 * Verifica si el teléfono está en la whitelist de agentes de campo
 */
async function checkWhitelist(phone: string): Promise<{
  id: number;
  nombre: string;
  provincia: string | null;
  ciudad: string | null;
} | null> {
  try {
    // Buscar por número exacto o con variantes comunes
    const { data: agent, error } = await supabaseAdmin
      .from('agente_campo')
      .select('id, nombre, provincia, ciudad')
      .eq('activo', true)
      .or(`telefono.eq.${phone},telefono.eq.+${phone}`)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking whitelist:', error);
      return null;
    }

    return agent;
  } catch (error) {
    console.error('Error in checkWhitelist:', error);
    return null;
  }
}

/**
 * Procesa el mensaje del agente de campo usando OpenAI
 */
async function processFieldReportMessage(
  conversationId: string,
  messageText: string,
  agent: { id: number; nombre: string; provincia: string | null; ciudad: string | null }
): Promise<string | null> {
  try {
    // Obtener o crear session ID para esta conversación
    let sessionId: string | undefined = conversationSessions.get(conversationId);
    
    // Comando especial para resetear conversación
    if (messageText.toLowerCase() === '!reset' || messageText.toLowerCase() === '!nuevo') {
      conversationSessions.delete(conversationId);
      return '✅ Conversación reiniciada. Puedes comenzar a contarme sobre un nuevo reporte de campo.';
    }

    // Si no hay sesión, crear una nueva
    if (!sessionId) {
      const newSession = await createOpenAISession();
      if (newSession) {
        sessionId = newSession;
        conversationSessions.set(conversationId, sessionId);
        console.log(`📝 Nueva sesión creada para ${conversationId}: ${sessionId}`);
      }
    }

    if (!sessionId) {
      console.error('❌ Failed to get/create OpenAI session');
      return 'Lo siento, hubo un error técnico. Por favor intenta nuevamente en unos minutos.';
    }

    // Llamar al agente AI con tools
    const result = await callFieldReportAgent(sessionId, messageText, agent);
    
    return result.response;
  } catch (error) {
    console.error('Error processing field report message:', error);
    return 'Lo siento, hubo un error procesando tu mensaje. Por favor intenta nuevamente.';
  }
}

/**
 * Crea una nueva sesión en OpenAI
 */
async function createOpenAISession(): Promise<string | null> {
  try {
    // OpenAI Responses API usa conversation IDs que se crean automáticamente
    // Generamos un ID único para trackear la sesión
    const sessionId = `field_report_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    return sessionId;
  } catch (error) {
    console.error('Error creating OpenAI session:', error);
    return null;
  }
}

interface ToolResult {
  success: boolean;
  error?: string;
  noticia_id?: number;
  [key: string]: unknown;
}

/**
 * Ejecuta la tool de guardar reporte
 */
async function executeSaveReportTool(
  args: Record<string, unknown>,
  agentId: number
): Promise<ToolResult> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    const response = await fetch(`${baseUrl}/api/tools/save-field-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...args,
        agente_id: agentId
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: errorText };
    }

    return await response.json();
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Llama al agente AI para procesar el mensaje de reporte de campo
 */
async function callFieldReportAgent(
  sessionId: string,
  message: string,
  agent: { id: number; nombre: string; provincia: string | null; ciudad: string | null }
): Promise<{ response: string | null }> {
  try {
    const systemPrompt = buildSystemPrompt(agent);
    
    // Tools disponibles para el agente
    const tools = [
      {
        type: 'function',
        name: 'save_field_report',
        description: `Guarda un reporte de campo como noticia en la base de datos. 
IMPORTANTE: Solo usa esta función cuando tengas TODOS los datos necesarios confirmados por el agente.
Los campos obligatorios son: titulo, descripcion, categoria, provincia, ciudad, fecha_evento.
La urgencia es opcional y por defecto es "media".`,
        parameters: {
          type: 'object',
          properties: {
            titulo: {
              type: 'string',
              description: 'Título descriptivo del reporte (máximo 500 caracteres)'
            },
            descripcion: {
              type: 'string', 
              description: 'Descripción detallada del evento o situación reportada'
            },
            cuerpo: {
              type: 'string',
              description: 'Contenido completo y detallado del reporte (opcional)'
            },
            categoria: {
              type: 'string',
              enum: ['Economía', 'Seguridad', 'Salud', 'Educación', 'Infraestructura', 'Justicia', 'Medio Ambiente', 'Trabajo', 'Política Interna', 'Relaciones Internacionales', 'Tecnología', 'Cultura'],
              description: 'Categoría del reporte'
            },
            urgencia: {
              type: 'string',
              enum: ['alta', 'media', 'baja'],
              description: 'Nivel de urgencia del reporte'
            },
            provincia: {
              type: 'string',
              description: 'Provincia argentina donde ocurrió el evento'
            },
            ciudad: {
              type: 'string',
              description: 'Ciudad o municipio donde ocurrió el evento'
            },
            fecha_evento: {
              type: 'string',
              description: 'Fecha en que ocurrió el evento (formato: YYYY-MM-DD o descripción como "hoy", "ayer")'
            },
            palabras_clave: {
              type: 'array',
              items: { type: 'string' },
              description: 'Palabras clave relevantes del reporte'
            }
          },
          required: ['titulo', 'descripcion', 'categoria', 'provincia', 'ciudad', 'fecha_evento']
        },
        strict: false
      }
    ];

    // Construir el request
    const requestBody = {
      model: 'gpt-4o',
      input: message,
      instructions: systemPrompt,
      tools,
      store: true,
      metadata: {
        session_id: sessionId,
        agent_phone: agent.nombre
      },
      previous_response_id: getStoredResponseId(sessionId)
    };

    // Si no hay previous_response_id, removerlo del request
    if (!requestBody.previous_response_id) {
      delete (requestBody as Record<string, unknown>).previous_response_id;
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      return { response: 'Lo siento, hubo un error técnico. Por favor intenta nuevamente.' };
    }

    let data = await response.json();
    
    // Guardar el response_id para mantener el hilo de conversación
    if (data.id) {
      storeResponseId(sessionId, data.id);
    }

    // Loop para manejar function calls
    const maxIterations = 5;
    let iteration = 0;

    while (iteration < maxIterations) {
      iteration++;
      
      const functionCalls = data.output?.filter(
        (item: { type: string }) => item.type === 'function_call'
      );

      if (!functionCalls || functionCalls.length === 0) {
        break;
      }

      console.log(`🔧 Ejecutando ${functionCalls.length} tool(s)...`);

      const toolResults: Array<{
        type: string;
        call_id: string;
        output: string;
      }> = [];

      for (const call of functionCalls) {
        if (call.name === 'save_field_report') {
          const args = typeof call.arguments === 'string' 
            ? JSON.parse(call.arguments) 
            : call.arguments;
          
          const result = await executeSaveReportTool(args, agent.id);
          
          toolResults.push({
            type: 'function_call_output',
            call_id: call.call_id,
            output: JSON.stringify(result)
          });

          if (result.success) {
            console.log(`✅ Reporte guardado con ID: ${result.noticia_id}`);
            // Limpiar la sesión después de guardar exitosamente
            conversationSessions.delete(sessionId);
          }
        }
      }

      // Enviar resultados de las tools
      const followUpResponse = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          input: toolResults,
          previous_response_id: data.id,
          tools,
          store: true
        }),
      });

      if (!followUpResponse.ok) {
        console.error('Follow-up request failed:', await followUpResponse.text());
        break;
      }

      data = await followUpResponse.json();
      
      if (data.id) {
        storeResponseId(sessionId, data.id);
      }
    }

    // Extraer respuesta de texto
    const messageItem = data.output?.find(
      (item: { type: string }) => item.type === 'message'
    );

    if (messageItem?.content?.[0]?.text) {
      return { response: messageItem.content[0].text };
    }

    // Fallback: buscar output_text
    const textContent = data.output?.find(
      (item: { type: string }) => item.type === 'output_text'
    );

    if (textContent?.text) {
      return { response: textContent.text };
    }

    return { response: null };

  } catch (error) {
    console.error('Error calling field report agent:', error);
    return { response: 'Lo siento, hubo un error procesando tu mensaje.' };
  }
}

/**
 * Construye el prompt del sistema para el agente de reportes de campo
 */
function buildSystemPrompt(agent: { nombre: string; provincia: string | null; ciudad: string | null }): string {
  const today = new Date().toISOString().split('T')[0];
  
  return `Eres M.I.R.T.A. (Monitor Inteligente de Reportes y Temas de Actualidad), un asistente de inteligencia especializado en recibir y procesar reportes de campo de agentes legislativos.

INFORMACIÓN DEL AGENTE ACTUAL:
- Nombre: ${agent.nombre}
- Provincia: ${agent.provincia || 'No especificada'}
- Ciudad: ${agent.ciudad || 'No especificada'}
- Fecha actual: ${today}

TU OBJETIVO:
Mantener una conversación natural para extraer toda la información necesaria para registrar un reporte de campo. Debes obtener los siguientes datos OBLIGATORIOS:
1. **Título**: Un título descriptivo del evento o situación
2. **Descripción**: Qué está pasando, contexto del evento
3. **Categoría**: Clasificar en una de las categorías disponibles
4. **Ubicación**: Dónde está ocurriendo (ciudad, barrio, dirección si es posible)
5. **Fecha del evento**: Cuándo ocurrió o está ocurriendo

DATOS OPCIONALES (pregunta si son relevantes):
- Urgencia (alta, media, baja)
- Palabras clave
- Impacto legislativo potencial
- Si requiere acción inmediata

CATEGORÍAS DISPONIBLES:
Economía, Seguridad, Salud, Educación, Infraestructura, Justicia, Medio Ambiente, Trabajo, Política Interna, Relaciones Internacionales, Tecnología, Cultura

INSTRUCCIONES:
1. Saluda brevemente al agente por su nombre la primera vez
2. Pregunta de forma conversacional para obtener los datos
3. Si el agente da información parcial, haz preguntas de seguimiento
4. Cuando tengas TODOS los datos obligatorios, confirma con el agente antes de guardar
5. Usa la función save_field_report SOLO cuando el agente confirme que los datos son correctos
6. Después de guardar, confirma el éxito e indica que puede enviar otro reporte

FORMATO:
- Sé conciso, esto es WhatsApp
- Usa emojis moderadamente para hacer la conversación más amigable
- No hagas demasiadas preguntas a la vez (máximo 2)

COMANDOS ESPECIALES:
- Si el usuario escribe "!reset" o "!nuevo", inicia una nueva conversación para un nuevo reporte`;
}

// Almacenamiento simple de response IDs para mantener el hilo
const responseIdStore: Map<string, string> = new Map();

function getStoredResponseId(sessionId: string): string | undefined {
  return responseIdStore.get(sessionId);
}

function storeResponseId(sessionId: string, responseId: string): void {
  responseIdStore.set(sessionId, responseId);
}

/**
 * Envía un mensaje a WhatsApp via webhook de n8n
 */
async function sendWhatsAppMessage(userPhone: string, messageText: string): Promise<boolean> {
  try {
    const webhookUrl = process.env.N8N_WHATSAPP_WEBHOOK_URL || 'https://n8n.southamerica-east1-a.gcp.pathfinding.com.ar/webhook/send-whatsapp';
    const apiKey = process.env.N8N_WEBHOOK_API_KEY || 'cnRO8gxiwnnLShIe2hO1ROJvv7b8GguU';

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        to: userPhone,
        type: 'text',
        text: messageText,
      }),
    });

    if (!response.ok) {
      console.error('❌ Error sending WhatsApp message:', await response.text());
      return false;
    }

    console.log(`📤 Mensaje enviado a ${userPhone}`);
    return true;
  } catch (error) {
    console.error('❌ Error calling n8n webhook:', error);
    return false;
  }
}
