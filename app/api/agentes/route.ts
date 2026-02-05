import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

/**
 * GET /api/agentes - Obtener todos los agentes de campo con estadísticas
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeStats = searchParams.get('stats') === 'true';
    const activo = searchParams.get('activo');

    // Query base de agentes
    let query = supabaseAdmin
      .from('agente_campo')
      .select('*')
      .order('created_at', { ascending: false });

    // Filtrar por estado activo si se especifica
    if (activo !== null) {
      query = query.eq('activo', activo === 'true');
    }

    const { data: agentes, error } = await query;

    if (error) {
      console.error('Error fetching agentes:', error);
      return NextResponse.json(
        { success: false, error: 'Error al obtener agentes' },
        { status: 500 }
      );
    }

    // Si se requieren estadísticas, obtener conteo de noticias por agente
    if (includeStats && agentes) {
      const agentesConStats = await Promise.all(
        agentes.map(async (agente) => {
          // Contar noticias del agente
          const { count: totalNoticias } = await supabaseAdmin
            .from('noticia')
            .select('*', { count: 'exact', head: true })
            .eq('agente_id', agente.id);

          // Contar noticias del último mes
          const unMesAtras = new Date();
          unMesAtras.setMonth(unMesAtras.getMonth() - 1);
          
          const { count: noticiasUltimoMes } = await supabaseAdmin
            .from('noticia')
            .select('*', { count: 'exact', head: true })
            .eq('agente_id', agente.id)
            .gte('created_at', unMesAtras.toISOString());

          // Obtener última noticia
          const { data: ultimaNoticia } = await supabaseAdmin
            .from('noticia')
            .select('created_at, titulo')
            .eq('agente_id', agente.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          return {
            ...agente,
            stats: {
              totalNoticias: totalNoticias || 0,
              noticiasUltimoMes: noticiasUltimoMes || 0,
              ultimaNoticia: ultimaNoticia?.created_at || null
            }
          };
        })
      );

      return NextResponse.json({ 
        success: true, 
        data: agentesConStats,
        total: agentesConStats.length
      });
    }

    return NextResponse.json({ 
      success: true, 
      data: agentes,
      total: agentes?.length || 0
    });
  } catch (error) {
    console.error('Error en GET /api/agentes:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agentes - Crear un nuevo agente de campo
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validar campos requeridos
    if (!body.nombre || !body.telefono) {
      return NextResponse.json(
        { success: false, error: 'Nombre y teléfono son requeridos' },
        { status: 400 }
      );
    }

    // Normalizar teléfono
    const telefonoNormalizado = body.telefono.replace(/[\s\-\(\)]/g, '');

    // Verificar si ya existe un agente con ese teléfono
    const { data: existente } = await supabaseAdmin
      .from('agente_campo')
      .select('id')
      .eq('telefono', telefonoNormalizado)
      .single();

    if (existente) {
      return NextResponse.json(
        { success: false, error: 'Ya existe un agente con ese número de teléfono' },
        { status: 409 }
      );
    }

    // Crear agente
    const { data: agente, error } = await supabaseAdmin
      .from('agente_campo')
      .insert({
        nombre: body.nombre,
        telefono: telefonoNormalizado,
        provincia: body.provincia || null,
        ciudad: body.ciudad || null,
        activo: body.activo ?? true
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating agente:', error);
      return NextResponse.json(
        { success: false, error: 'Error al crear agente' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      data: agente 
    }, { status: 201 });
  } catch (error) {
    console.error('Error en POST /api/agentes:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/agentes - Actualizar un agente existente
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { success: false, error: 'ID del agente es requerido' },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (body.nombre !== undefined) updateData.nombre = body.nombre;
    if (body.telefono !== undefined) updateData.telefono = body.telefono.replace(/[\s\-\(\)]/g, '');
    if (body.provincia !== undefined) updateData.provincia = body.provincia;
    if (body.ciudad !== undefined) updateData.ciudad = body.ciudad;
    if (body.activo !== undefined) updateData.activo = body.activo;

    // Si se está actualizando el teléfono, verificar que no exista
    if (updateData.telefono) {
      const { data: existente } = await supabaseAdmin
        .from('agente_campo')
        .select('id')
        .eq('telefono', updateData.telefono)
        .neq('id', body.id)
        .single();

      if (existente) {
        return NextResponse.json(
          { success: false, error: 'Ya existe otro agente con ese número de teléfono' },
          { status: 409 }
        );
      }
    }

    const { data: agente, error } = await supabaseAdmin
      .from('agente_campo')
      .update(updateData)
      .eq('id', body.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating agente:', error);
      return NextResponse.json(
        { success: false, error: 'Error al actualizar agente' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      data: agente 
    });
  } catch (error) {
    console.error('Error en PUT /api/agentes:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/agentes - Eliminar un agente
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID del agente es requerido' },
        { status: 400 }
      );
    }

    // Verificar si el agente tiene noticias asociadas
    const { count } = await supabaseAdmin
      .from('noticia')
      .select('*', { count: 'exact', head: true })
      .eq('agente_id', parseInt(id));

    if (count && count > 0) {
      // En lugar de eliminar, desactivar el agente
      const { data: agente, error } = await supabaseAdmin
        .from('agente_campo')
        .update({ activo: false })
        .eq('id', parseInt(id))
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { success: false, error: 'Error al desactivar agente' },
          { status: 500 }
        );
      }

      return NextResponse.json({ 
        success: true, 
        data: agente,
        message: 'Agente desactivado (tiene noticias asociadas)'
      });
    }

    // Si no tiene noticias, eliminar completamente
    const { error } = await supabaseAdmin
      .from('agente_campo')
      .delete()
      .eq('id', parseInt(id));

    if (error) {
      console.error('Error deleting agente:', error);
      return NextResponse.json(
        { success: false, error: 'Error al eliminar agente' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Agente eliminado correctamente'
    });
  } catch (error) {
    console.error('Error en DELETE /api/agentes:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
