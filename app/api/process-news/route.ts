import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import OpenAI from 'openai'
import { readFileSync } from 'fs'
import { join } from 'path'
import { Noticia } from '@/types/database'

// Inicializar cliente de OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// Interfaz para la respuesta del LLM
interface LLMAnalysis {
  categoria: string
  urgencia: 'alta' | 'media' | 'baja'
  sentimiento: 'positivo' | 'neutral' | 'negativo'
  ubicacion_geografica: string | null
  palabras_clave: string[]
  impacto_legislativo: string
  requiere_accion: boolean
}

// Cargar el prompt del sistema desde el archivo
function loadSystemPrompt(): string {
  try {
    const promptPath = join(process.cwd(), 'prompts', 'news-analysis.md')
    return readFileSync(promptPath, 'utf-8')
  } catch (error) {
    console.error('Error cargando prompt:', error)
    throw new Error('No se pudo cargar el prompt del sistema')
  }
}

// Construir el contenido de la noticia para el análisis
function buildNewsContent(noticia: Noticia): string {
  const parts: string[] = []
  
  parts.push(`# ${noticia.titulo}`)
  
  if (noticia.fuente) {
    parts.push(`**Fuente:** ${noticia.fuente}`)
  }
  
  if (noticia.fecha_publicacion) {
    parts.push(`**Fecha:** ${new Date(noticia.fecha_publicacion).toLocaleDateString('es-AR')}`)
  }
  
  if (noticia.autor) {
    parts.push(`**Autor:** ${noticia.autor}`)
  }
  
  if (noticia.descripcion) {
    parts.push(`\n## Resumen\n${noticia.descripcion}`)
  }
  
  if (noticia.cuerpo) {
    parts.push(`\n## Contenido\n${noticia.cuerpo}`)
  }
  
  return parts.join('\n')
}

// Procesar una noticia individual con OpenAI
async function processNewsWithAI(noticia: Noticia, systemPrompt: string): Promise<LLMAnalysis> {
  const newsContent = buildNewsContent(noticia)
  
  const response = await openai.responses.create({
    model: 'gpt-4o-mini',
    instructions: systemPrompt,
    input: newsContent,
    text: {
      format: {
        type: 'json_schema',
        name: 'news_analysis',
        schema: {
          type: 'object',
          properties: {
            categoria: {
              type: 'string',
              enum: [
                'Economía', 'Seguridad', 'Salud', 'Educación', 
                'Infraestructura', 'Justicia', 'Medio Ambiente', 
                'Trabajo', 'Política Interna', 'Relaciones Internacionales', 
                'Tecnología', 'Cultura'
              ]
            },
            urgencia: {
              type: 'string',
              enum: ['alta', 'media', 'baja']
            },
            sentimiento: {
              type: 'string',
              enum: ['positivo', 'neutral', 'negativo']
            },
            ubicacion_geografica: {
              type: ['string', 'null']
            },
            palabras_clave: {
              type: 'array',
              items: { type: 'string' }
            },
            impacto_legislativo: {
              type: 'string'
            },
            requiere_accion: {
              type: 'boolean'
            }
          },
          required: [
            'categoria', 'urgencia', 'sentimiento', 
            'ubicacion_geografica', 'palabras_clave', 
            'impacto_legislativo', 'requiere_accion'
          ],
          additionalProperties: false
        },
        strict: true
      }
    }
  })

  // Extraer el texto de la respuesta
  const outputText = response.output_text
  
  if (!outputText) {
    throw new Error('No se recibió respuesta del modelo')
  }

  // Parsear el JSON de la respuesta
  const analysis: LLMAnalysis = JSON.parse(outputText)
  
  return analysis
}

// Actualizar la noticia en Supabase con los resultados del análisis
async function updateNewsInDatabase(noticiaId: number, analysis: LLMAnalysis): Promise<void> {
  const { error } = await supabaseAdmin
    .from('noticia')
    .update({
      categoria: analysis.categoria,
      urgencia: analysis.urgencia,
      sentimiento: analysis.sentimiento,
      ubicacion_geografica: analysis.ubicacion_geografica,
      palabras_clave: analysis.palabras_clave,
      impacto_legislativo: analysis.impacto_legislativo,
      requiere_accion: analysis.requiere_accion,
      procesado_llm: true
    })
    .eq('id', noticiaId)

  if (error) {
    throw new Error(`Error actualizando noticia ${noticiaId}: ${error.message}`)
  }
}

// Handler principal POST
export async function POST(request: NextRequest) {
  try {
    // Obtener parámetros opcionales del body
    const body = await request.json().catch(() => ({}))
    // Si el cliente pasa `limit` como número lo usamos; si no, procesamos TODAS las pendientes
    const limit: number | null = typeof body.limit === 'number' ? body.limit : null
    
    // Cargar el prompt del sistema
    const systemPrompt = loadSystemPrompt()
    
    // Obtener noticias no procesadas de Supabase
    let query = supabaseAdmin
      .from('noticia')
      .select('*')
      .eq('procesado_llm', false)
      .order('fecha_publicacion', { ascending: false })

    if (limit !== null) {
      query = query.limit(limit)
    }

    const { data: noticias, error: fetchError } = await query

    if (fetchError) {
      return NextResponse.json(
        { error: 'Error obteniendo noticias', details: fetchError.message },
        { status: 500 }
      )
    }

    if (!noticias || noticias.length === 0) {
      return NextResponse.json({
        message: 'No hay noticias pendientes de procesar',
        processed: 0
      })
    }

    // Procesar cada noticia
    const results: { id: number; titulo: string; status: 'success' | 'error'; error?: string }[] = []

    for (const noticia of noticias as Noticia[]) {
      try {
        console.log(`Procesando noticia ID ${noticia.id}: ${noticia.titulo.substring(0, 50)}...`)
        
        // Analizar con IA
        const analysis = await processNewsWithAI(noticia, systemPrompt)
        
        // Guardar en base de datos
        await updateNewsInDatabase(noticia.id, analysis)
        
        results.push({
          id: noticia.id,
          titulo: noticia.titulo,
          status: 'success'
        })

        console.log(`✓ Noticia ${noticia.id} procesada correctamente`)
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
        console.error(`✗ Error procesando noticia ${noticia.id}:`, errorMessage)
        
        results.push({
          id: noticia.id,
          titulo: noticia.titulo,
          status: 'error',
          error: errorMessage
        })
      }
    }

    // Resumen de resultados
    const successful = results.filter(r => r.status === 'success').length
    const failed = results.filter(r => r.status === 'error').length

    return NextResponse.json({
      message: `Procesamiento completado: ${successful} exitosas, ${failed} fallidas`,
      processed: successful,
      failed: failed,
      total: noticias.length,
      results
    })

  } catch (error) {
    console.error('Error en el endpoint de procesamiento:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}

// Handler GET para verificar estado
export async function GET() {
  try {
    // Contar noticias pendientes
    const { count: pendientes, error: countError } = await supabaseAdmin
      .from('noticia')
      .select('*', { count: 'exact', head: true })
      .eq('procesado_llm', false)

    if (countError) {
      return NextResponse.json(
        { error: 'Error consultando base de datos', details: countError.message },
        { status: 500 }
      )
    }

    // Contar noticias ya procesadas
    const { count: procesadas } = await supabaseAdmin
      .from('noticia')
      .select('*', { count: 'exact', head: true })
      .eq('procesado_llm', true)

    return NextResponse.json({
      status: 'ok',
      pendientes: pendientes || 0,
      procesadas: procesadas || 0,
      endpoint: '/api/process-news',
      usage: 'POST para procesar noticias pendientes. Body opcional: { "limit": 10 }'
    })

  } catch {
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
