import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import fs from 'fs'
import path from 'path'

// Leer el prompt del archivo
const promptPath = path.join(process.cwd(), 'prompts', 'news-analysis.md')

interface AnalysisResult {
  categoria: string
  resumen: string
  urgencia: 'alta' | 'media' | 'baja'
  sentimiento: 'positivo' | 'neutral' | 'negativo'
  nivel_geografico: 'internacional' | 'nacional' | 'provincial' | 'municipal'
  provincia: string | null
  ciudad: string | null
  palabras_clave: string[]
}

interface Noticia {
  id: number
  titulo: string
  descripcion: string | null
  cuerpo: string | null
}

/**
 * Analiza una noticia usando OpenAI
 */
async function analyzeNoticia(noticia: Noticia, systemPrompt: string): Promise<AnalysisResult | null> {
  try {
    const content = `
TÍTULO: ${noticia.titulo}

${noticia.descripcion ? `DESCRIPCIÓN: ${noticia.descripcion}` : ''}

${noticia.cuerpo ? `CONTENIDO: ${noticia.cuerpo.slice(0, 4000)}` : ''}
`.trim()

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`OpenAI API error: ${errorText}`)
      return null
    }

    const data = await response.json()
    const resultText = data.choices?.[0]?.message?.content

    if (!resultText) {
      console.error('No content in OpenAI response')
      return null
    }

    const result = JSON.parse(resultText) as AnalysisResult
    return result
  } catch (error) {
    console.error('Error analyzing noticia:', error)
    return null
  }
}

export async function GET() {
  // Contar noticias pendientes
  const { count } = await supabaseAdmin
    .from('noticia')
    .select('id', { count: 'exact', head: true })
    .eq('procesado_llm', false)

  return NextResponse.json({
    message: 'Endpoint de procesamiento de noticias con IA',
    usage: 'POST para procesar noticias pendientes',
    pendientes: count || 0
  })
}

export async function POST(request: Request) {
  try {
    // Obtener límite del body (opcional)
    let limit: number | null = null
    try {
      const body = await request.json()
      limit = body.limit || null
    } catch {
      // Sin body, procesar todas
    }

    // Leer el prompt del sistema
    let systemPrompt: string
    try {
      systemPrompt = fs.readFileSync(promptPath, 'utf-8')
    } catch {
      return NextResponse.json(
        { error: 'No se pudo leer el archivo de prompt' },
        { status: 500 }
      )
    }

    // Obtener noticias pendientes de procesar
    let query = supabaseAdmin
      .from('noticia')
      .select('id, titulo, descripcion, cuerpo')
      .eq('procesado_llm', false)
      .order('fecha_publicacion', { ascending: false })

    if (limit) {
      query = query.limit(limit)
    }

    const { data: noticias, error: fetchError } = await query

    if (fetchError) {
      console.error('Error fetching noticias:', fetchError)
      return NextResponse.json(
        { error: 'Error al obtener noticias', details: fetchError.message },
        { status: 500 }
      )
    }

    if (!noticias || noticias.length === 0) {
      return NextResponse.json({
        message: 'No hay noticias pendientes de procesar',
        processed: 0,
        failed: 0,
        total: 0,
        results: []
      })
    }

    console.log(`\n🤖 Procesando ${noticias.length} noticias con IA...`)

    const results: { id: number; titulo: string; status: 'success' | 'error'; error?: string }[] = []
    let processed = 0
    let failed = 0

    for (const noticia of noticias as Noticia[]) {
      console.log(`\n📰 Analizando: ${noticia.titulo.slice(0, 60)}...`)

      const analysis = await analyzeNoticia(noticia, systemPrompt)

      if (analysis) {
        // Actualizar la noticia con el análisis
        const { error: updateError } = await supabaseAdmin
          .from('noticia')
          .update({
            categoria: analysis.categoria,
            resumen: analysis.resumen,
            urgencia: analysis.urgencia,
            sentimiento: analysis.sentimiento,
            nivel_geografico: analysis.nivel_geografico,
            provincia: analysis.provincia,
            ciudad: analysis.ciudad,
            palabras_clave: analysis.palabras_clave,
            procesado_llm: true
          })
          .eq('id', noticia.id)

        if (updateError) {
          console.error(`   ❌ Error actualizando noticia ${noticia.id}:`, updateError)
          results.push({
            id: noticia.id,
            titulo: noticia.titulo,
            status: 'error',
            error: updateError.message
          })
          failed++
        } else {
          console.log(`   ✅ Analizada: ${analysis.categoria} | ${analysis.nivel_geografico} | ${analysis.urgencia}`)
          results.push({
            id: noticia.id,
            titulo: noticia.titulo,
            status: 'success'
          })
          processed++
        }
      } else {
        console.log(`   ❌ Error al analizar`)
        results.push({
          id: noticia.id,
          titulo: noticia.titulo,
          status: 'error',
          error: 'Error en análisis de IA'
        })
        failed++
      }

      // Pequeña pausa para no saturar la API
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    console.log(`\n✨ Procesamiento completado: ${processed} OK, ${failed} errores`)

    return NextResponse.json({
      message: `Procesamiento completado: ${processed} noticias analizadas`,
      processed,
      failed,
      total: noticias.length,
      results
    })
  } catch (error) {
    console.error('Error en process-news:', error)
    return NextResponse.json(
      {
        error: 'Error durante el procesamiento',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
