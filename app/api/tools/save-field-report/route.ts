import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

/**
 * HTTP Tool: Save Field Report
 * 
 * Guarda un reporte de campo como noticia en la base de datos.
 * Esta tool es llamada por el agente AI cuando tiene todos los datos necesarios.
 */

interface FieldReportData {
  titulo: string;
  descripcion: string;
  cuerpo?: string;
  categoria: string;
  urgencia?: 'alta' | 'media' | 'baja';
  provincia: string;
  ciudad: string;
  fecha_evento: string;
  palabras_clave?: string[];
  agente_id: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: FieldReportData = await request.json();
    
    console.log('🔧 HTTP Tool Called: save_field_report');
    console.log('📋 Data received:', JSON.stringify(body, null, 2));

    // Validar campos obligatorios
    const requiredFields = ['titulo', 'descripcion', 'categoria', 'provincia', 'ciudad', 'fecha_evento', 'agente_id'];
    const missingFields = requiredFields.filter(field => !body[field as keyof FieldReportData]);
    
    if (missingFields.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Campos obligatorios faltantes: ${missingFields.join(', ')}`,
        missing_fields: missingFields
      }, { status: 400 });
    }

    // Validar que el agente existe y está activo
    const { data: agent, error: agentError } = await supabaseAdmin
      .from('agente_campo')
      .select('id, nombre, provincia')
      .eq('id', body.agente_id)
      .eq('activo', true)
      .single();

    if (agentError || !agent) {
      return NextResponse.json({
        success: false,
        error: 'Agente de campo no encontrado o inactivo'
      }, { status: 400 });
    }

    // La fecha del reporte debe ser la fecha de hoy (fecha de creación del reporte),
    // NO la fecha en que ocurrió el evento.
    const fechaPublicacion = new Date();

    // Crear la noticia
    const noticiaData = {
      titulo: body.titulo.substring(0, 500), // Limitar a 500 chars
      descripcion: body.descripcion,
      cuerpo: body.cuerpo || body.descripcion,
      autor: agent.nombre,
      fuente: `Agente de Campo - ${agent.provincia || 'Sin provincia'}`,
      fuente_base: 'reporte_campo',
      fecha_publicacion: fechaPublicacion.toISOString(),
      extraido_en: new Date().toISOString(),
      categoria: body.categoria,
      urgencia: body.urgencia || 'media',
      sentimiento: 'neutral' as const,
      nivel_geografico: 'municipal' as const,
      provincia: body.provincia,
      ciudad: body.ciudad,
      palabras_clave: body.palabras_clave || [],
      procesado_llm: true, // Ya fue procesado por el agente AI
      tipo_fuente: 'agente' as const,
      noticiero_id: null,
      agente_id: body.agente_id,
      link: null
    };

    const { data: noticia, error: insertError } = await supabaseAdmin
      .from('noticia')
      .insert(noticiaData)
      .select('id, titulo, created_at')
      .single();

    if (insertError) {
      console.error('❌ Error insertando noticia:', insertError);
      return NextResponse.json({
        success: false,
        error: `Error guardando el reporte: ${insertError.message}`
      }, { status: 500 });
    }

    console.log(`✅ Reporte guardado con ID: ${noticia.id}`);

    return NextResponse.json({
      success: true,
      message: 'Reporte de campo guardado exitosamente',
      noticia_id: noticia.id,
      titulo: noticia.titulo,
      created_at: noticia.created_at
    });

  } catch (error) {
    console.error('❌ Error in save_field_report:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}

/**
 * Parsea la fecha del evento desde diferentes formatos
 */
function parseFechaEvento(fechaStr: string): Date {
  const today = new Date();
  const lowerFecha = fechaStr.toLowerCase().trim();
  
  // Manejar formatos relativos
  if (lowerFecha === 'hoy' || lowerFecha === 'ahora') {
    return today;
  }
  
  if (lowerFecha === 'ayer') {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  }
  
  if (lowerFecha === 'anteayer' || lowerFecha === 'antes de ayer') {
    const dayBeforeYesterday = new Date(today);
    dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
    return dayBeforeYesterday;
  }
  
  // Manejar "hace X días"
  const haceDiasMatch = lowerFecha.match(/hace\s+(\d+)\s+d[ií]as?/);
  if (haceDiasMatch) {
    const daysAgo = parseInt(haceDiasMatch[1]);
    const pastDate = new Date(today);
    pastDate.setDate(pastDate.getDate() - daysAgo);
    return pastDate;
  }
  
  // Intentar parsear como fecha ISO (YYYY-MM-DD)
  const isoDate = new Date(fechaStr);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }
  
  // Intentar parsear formato DD/MM/YYYY
  const ddmmyyyyMatch = fechaStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (ddmmyyyyMatch) {
    const [, day, month, year] = ddmmyyyyMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  
  // Si no se puede parsear, usar fecha actual
  console.warn(`⚠️ No se pudo parsear la fecha "${fechaStr}", usando fecha actual`);
  return today;
}
