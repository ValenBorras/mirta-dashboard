/**
 * Script para actualizar las últimas noticias sin imágenes
 * Extrae las imágenes de las URLs originales y actualiza la BD
 */

// PRIMERO: Cargar variables de entorno ANTES de cualquier otra importación
import { config } from 'dotenv'
import { resolve } from 'path'
import * as cheerio from 'cheerio'
import { createClient } from '@supabase/supabase-js'

// Cargar .env.local si existe
config({ path: resolve(process.cwd(), '.env.local') })
// Cargar .env como fallback
config({ path: resolve(process.cwd(), '.env') })

// Verificar que las variables estén cargadas
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_DEFAULT_KEY) {
  console.error('\n❌ Error: Variables de entorno no configuradas')
  console.error('Por favor, verifica que tu archivo .env.local contenga:')
  console.error('  - NEXT_PUBLIC_SUPABASE_URL')
  console.error('  - SUPABASE_SECRET_DEFAULT_KEY\n')
  process.exit(1)
}

// Crear cliente de Supabase directamente aquí
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_DEFAULT_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}

interface NoticiaUpdate {
  id: number
  link: string
  fuente_base: string
}

/**
 * Extrae la URL de imagen de una noticia desde su HTML
 */
async function extractImageUrl(url: string, fuenteBase: string): Promise<string | null> {
  try {
    const response = await fetch(url, { headers: HEADERS })
    if (!response.ok) return null

    const html = await response.text()
    const $ = cheerio.load(html)

    // Si es El Once, usar selectores específicos
    if (fuenteBase.includes('elonce.com')) {
      let imagenUrl: string | null = null
      imagenUrl = $('meta[property="og:image"]').attr('content') ||
                  $('meta[name="twitter:image"]').attr('content') ||
                  $('article img').first().attr('src') ||
                  null

      // Asegurar que la URL sea absoluta
      if (imagenUrl && !imagenUrl.startsWith('http')) {
        const parsedUrl = new URL(url)
        const base = `${parsedUrl.protocol}//${parsedUrl.host}`
        imagenUrl = imagenUrl.startsWith('/') ? `${base}${imagenUrl}` : `${base}/${imagenUrl}`
      }

      return imagenUrl
    }

    // Para otros sitios, intentar JSON-LD primero
    for (const script of $('script[type="application/ld+json"]').toArray()) {
      const content = $(script).html()
      if (!content) continue

      try {
        let data = JSON.parse(content)

        if (Array.isArray(data)) {
          for (const item of data) {
            if (typeof item === 'object' && item !== null && 'image' in item) {
              data = item
              break
            }
          }
        }

        if (typeof data === 'object' && data !== null && 'image' in data) {
          const image = data.image
          
          if (typeof image === 'string') {
            return image
          } else if (typeof image === 'object' && image !== null) {
            const imageObj = image as Record<string, unknown>
            return (imageObj.url as string) || (imageObj.contentUrl as string) || null
          } else if (Array.isArray(image) && image.length > 0) {
            const firstImage = image[0]
            if (typeof firstImage === 'string') {
              return firstImage
            } else if (typeof firstImage === 'object' && firstImage !== null) {
              const imgObj = firstImage as Record<string, unknown>
              return (imgObj.url as string) || (imgObj.contentUrl as string) || null
            }
          }
        }
      } catch {
        continue
      }
    }

    // Fallback a meta tags
    let imagenUrl = $('meta[property="og:image"]').attr('content') ||
                    $('meta[name="twitter:image"]').attr('content') ||
                    null

    return imagenUrl
  } catch (error) {
    console.error(`Error extrayendo imagen de ${url}:`, error)
    return null
  }
}

/**
 * Actualiza las últimas N noticias sin imágenes
 */
async function updateNewsImages(limit: number = 100) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`🖼️  Actualizando imágenes de noticias`)
  console.log(`   Procesando últimas ${limit} noticias sin imagen`)
  console.log(`${'='.repeat(60)}\n`)

  // Obtener noticias sin imagen_url
  const { data: noticias, error } = await supabaseAdmin
    .from('noticia')
    .select('id, link, fuente_base')
    .is('imagen_url', null)
    .not('link', 'is', null)
    .order('fecha_publicacion', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('❌ Error obteniendo noticias:', error)
    return
  }

  if (!noticias || noticias.length === 0) {
    console.log('✅ No hay noticias sin imágenes para procesar')
    return
  }

  console.log(`📰 Encontradas ${noticias.length} noticias para procesar\n`)

  let actualizadas = 0
  let sinImagen = 0
  let errores = 0

  for (let i = 0; i < noticias.length; i++) {
    const noticia = noticias[i] as NoticiaUpdate
    const progreso = `[${i + 1}/${noticias.length}]`

    try {
      console.log(`${progreso} Procesando noticia ID ${noticia.id}...`)
      
      const imagenUrl = await extractImageUrl(noticia.link, noticia.fuente_base || '')

      if (imagenUrl) {
        // Actualizar la noticia con la imagen
        const { error: updateError } = await supabaseAdmin
          .from('noticia')
          .update({ imagen_url: imagenUrl })
          .eq('id', noticia.id)

        if (updateError) {
          console.error(`  ❌ Error actualizando: ${updateError.message}`)
          errores++
        } else {
          console.log(`  ✅ Imagen actualizada`)
          actualizadas++
        }
      } else {
        console.log(`  ⚠️  No se encontró imagen`)
        sinImagen++
      }

      // Pequeña pausa para no saturar los servidores
      await new Promise(resolve => setTimeout(resolve, 500))
    } catch (error) {
      console.error(`  ❌ Error: ${error}`)
      errores++
    }
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`✨ Actualización completada:`)
  console.log(`   - Total procesadas: ${noticias.length}`)
  console.log(`   - Actualizadas con imagen: ${actualizadas}`)
  console.log(`   - Sin imagen encontrada: ${sinImagen}`)
  console.log(`   - Errores: ${errores}`)
  console.log(`${'='.repeat(60)}\n`)
}

// Ejecutar el script
const limit = process.argv[2] ? parseInt(process.argv[2]) : 100
updateNewsImages(limit)
  .then(() => {
    console.log('✅ Script finalizado')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Error fatal:', error)
    process.exit(1)
  })
