import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { supabaseAdmin } from '@/lib/supabase-server'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}

/**
 * Convierte una fecha a timestamp UTC
 * Las fechas de los feeds RSS generalmente ya vienen en UTC
 * Solo se convierte al formato ISO estándar
 */
function toArgentinaTimestamp(dateStr: string): string {
  if (!dateStr) {
    return new Date().toISOString()
  }
  
  const date = new Date(dateStr.trim())
  
  if (isNaN(date.getTime())) {
    return new Date().toISOString()
  }
  
  return date.toISOString()
}

// Sitios de noticias a scrapear
const SITES = [
  'https://www.clarin.com/',
  'https://www.lanacion.com.ar/',
  'https://www.tn.com.ar/',
  'https://cnnespanol.cnn.com/argentina',
  'https://elpais.com/'
]

// Feeds RSS
const FEEDS = [
  'https://www.lapoliticaonline.com/files/rss/politica.xml',
  'https://www.ambito.com/rss/pages/economia.xml',
  'https://www.clarin.com/rss/politica/',
  'https://www.clarin.com/rss/sociedad/',
  'https://www.clarin.com/rss/policiales/',
  'https://www.clarin.com/rss/mundo/',
  'https://www.clarin.com/rss/economia/',
  'https://www.clarin.com/rss/tecnologia/',
  'https://www.clarin.com/rss/opinion/',
  'https://www.ambito.com/rss/pages/negocios.xml',
  'https://www.ambito.com/rss/pages/nacional.xml',
  'https://www.ambito.com/rss/pages/ultimas-noticias.xml',
  'https://www.ambito.com/rss/pages/finanzas.xml',
  'https://www.ambito.com/rss/pages/politica.xml',
  'https://www.ambito.com/rss/pages/tecnologia.xml',
  'http://www.lapoliticaonline.com.ar/files/rss/ultimasnoticias.xml',
  'http://www.lapoliticaonline.com.ar/files/rss/politica.xml',
  'http://www.lapoliticaonline.com.ar/files/rss/economia.xml',
  'http://www.lapoliticaonline.com.ar/files/rss/ciudad.xml',
  'http://www.lapoliticaonline.com.ar/files/rss/provincia.xml',
  'http://www.lapoliticaonline.com.ar/files/rss/energía.xml',
  'http://www.lapoliticaonline.com.ar/files/rss/judiciales.xml',
  'http://www.lapoliticaonline.com.ar/files/rss/medios.xml'
]

// Categorías relevantes
const RELEVANTES = [
  'politica', 'economia', 'sociedad', 'educacion', 'seguridad',
  'nacion', 'elecciones', 'actualidad', 'argentina', 'ciudades'
]

// Categorías no relevantes
const NO_RELEVANTES = [
  'deportes', 'futbol', 'autos', 'show', 'fama', 'espectaculos',
  'gente', 'moda', 'estilo', 'gastronomia', 'viajes', 'revista',
  'salud', 'bienestar', 'icon', 'elviajero', 'television', 'cultura'
]

interface NoticiaExtraida {
  titulo: string
  descripcion: string | null
  autor: string | null
  fuente: string
  fecha_publicacion: string
  link: string
  cuerpo: string | null
  fuente_base: string
  extraido_en: string
}

/**
 * Extrae metadatos y cuerpo de una noticia desde el bloque JSON-LD
 */
async function extractJsonLd(url: string): Promise<NoticiaExtraida | null> {
  try {
    const response = await fetch(url, { headers: HEADERS })
    if (!response.ok) return null

    const html = await response.text()
    const $ = cheerio.load(html)

    for (const script of $('script[type="application/ld+json"]').toArray()) {
      const content = $(script).html()
      if (!content) continue

      try {
        let data = JSON.parse(content)

        // Si es lista, buscamos el artículo
        if (Array.isArray(data)) {
          for (const item of data) {
            if (typeof item === 'object' && item !== null && 'articleBody' in item) {
              data = item
              break
            }
          }
        }

        // Si contiene el cuerpo del artículo
        if (typeof data === 'object' && data !== null && 'articleBody' in data) {
          const article = data as Record<string, unknown>

          // Procesar autor
          let autor = ''
          const author = article.author
          if (Array.isArray(author)) {
            autor = author
              .map(a => (typeof a === 'object' && a !== null ? (a as Record<string, unknown>).name : String(a)))
              .filter(Boolean)
              .join(', ')
          } else if (typeof author === 'object' && author !== null) {
            autor = (author as Record<string, unknown>).name as string || ''
          } else if (author) {
            autor = String(author)
          }

          // Obtener fecha de publicación
          const fechaRaw = article.datePublished as string
          const fechaPublicacion = toArgentinaTimestamp(fechaRaw)

          // Obtener nombre de la fuente
          const publisher = article.publisher as Record<string, unknown> | undefined
          const fuente = publisher?.name as string || new URL(url).hostname

          return {
            titulo: article.headline as string,
            descripcion: article.description as string || null,
            autor: autor || null,
            fuente,
            fecha_publicacion: fechaPublicacion,
            link: (article.url as string) || url,
            cuerpo: article.articleBody as string || null,
            fuente_base: new URL(url).hostname,
            extraido_en: new Date().toISOString()
          }
        }
      } catch {
        continue
      }
    }

    return null
  } catch {
    return null
  }
}

/**
 * Obtiene los links de noticias de una página
 */
async function getNewsLinks(site: string, limit: number = 30): Promise<string[]> {
  try {
    const response = await fetch(site, { headers: HEADERS })
    if (!response.ok) return []

    const html = await response.text()
    const $ = cheerio.load(html)
    const parsedUrl = new URL(site)
    const base = `${parsedUrl.protocol}//${parsedUrl.host}`
    const links = new Set<string>()

    // Buscar en JSON-LD
    for (const script of $('script[type="application/ld+json"]').toArray()) {
      try {
        const content = $(script).text().trim()
        const d = JSON.parse(content)
        const arr = d['@graph'] || (Array.isArray(d) ? d : [d])

        for (const o of arr) {
          if (typeof o === 'object' && o !== null && o['@type'] === 'ItemList') {
            for (const it of o.itemListElement || []) {
              const u = it.url
              if (typeof u === 'string' && u.startsWith('http')) {
                links.add(u)
              }
            }
          }
        }
      } catch {
        continue
      }
    }

    // Si no encontramos links en JSON-LD, buscar en anchors
    if (links.size === 0) {
      for (const a of $('a[href]').toArray()) {
        const href = $(a).attr('href')
        if (!href) continue

        // Patrones de URLs de noticias
        const hasNid = /-nid\d{6,}/.test(href)
        const hasSection = /(politica|sociedad|mundo|show|economia|deportes)\//.test(href)
        const hasDate = /\/\d{4}\/\d{2}\/\d{2}\//.test(href)

        if (hasNid || hasSection || hasDate) {
          const fullUrl = href.startsWith('http') ? href : `${base}${href.startsWith('/') ? '' : '/'}${href}`
          links.add(fullUrl)
        }
      }
    }

    return Array.from(links).slice(0, limit)
  } catch {
    return []
  }
}

/**
 * Filtra links de noticias relevantes
 */
function filterRelevantLinks(links: string[]): string[] {
  return links.filter(url => {
    const lower = url.toLowerCase()

    // Excluir no relevantes
    if (NO_RELEVANTES.some(x => lower.includes(x))) {
      return false
    }

    // Incluir solo relevantes
    return RELEVANTES.some(x => lower.includes(x))
  })
}

/**
 * Normaliza una URL
 */
function normalizeUrl(u: string): string {
  try {
    const parsed = new URL(u)
    const path = parsed.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '')
    return `${parsed.protocol}//${parsed.host}${path}`
  } catch {
    return u
  }
}

/**
 * Obtiene links desde feeds RSS
 */
async function getRssLinks(feedUrls: string[]): Promise<string[]> {
  const links: string[] = []
  const seen = new Set<string>()

  for (const feed of feedUrls) {
    try {
      const response = await fetch(feed, { headers: HEADERS })
      if (!response.ok) continue

      const xml = await response.text()
      const $ = cheerio.load(xml, { xmlMode: true })

      for (const item of $('item').toArray()) {
        let href = $(item).find('link').text().trim()

        if (!href) {
          const guid = $(item).find('guid')
          const guidText = guid.text().trim()
          if (guidText.startsWith('http')) {
            href = guidText
          }
        }

        if (href && href.startsWith('http')) {
          const nu = normalizeUrl(href)
          if (!seen.has(nu)) {
            seen.add(nu)
            links.push(nu)
          }
        }
      }
    } catch {
      continue
    }
  }

  return links
}

/**
 * Obtiene o crea un noticiero por su fuente_base
 */
async function getOrCreateNoticiero(fuenteBase: string): Promise<number | null> {
  try {
    // Buscar noticiero existente
    const { data: existing } = await supabaseAdmin
      .from('noticiero')
      .select('id')
      .eq('fuente_base', fuenteBase)
      .maybeSingle()

    if (existing && existing.id) {
      return existing.id
    }

    // Crear nuevo noticiero
    const nombreMap: Record<string, string> = {
      'www.clarin.com': 'Clarín',
      'www.lanacion.com.ar': 'La Nación',
      'www.tn.com.ar': 'Todo Noticias',
      'cnnespanol.cnn.com': 'CNN Español',
      'elpais.com': 'El País',
      'www.ambito.com': 'Ámbito',
      'www.lapoliticaonline.com': 'La Política Online',
      'www.lapoliticaonline.com.ar': 'La Política Online'
    }

    const nombre = nombreMap[fuenteBase] || fuenteBase

    const { data: newNoticiero, error } = await supabaseAdmin
      .from('noticiero')
      .insert({
        nombre,
        fuente_base: fuenteBase,
        tipo: 'digital',
        activo: true
      })
      .select('id')
      .single()

    if (error) {
      console.error('Error creando noticiero:', error)
      return null
    }

    return newNoticiero.id
  } catch (error) {
    console.error('Error en getOrCreateNoticiero:', error)
    return null
  }
}

// Límite de horas para considerar una noticia como reciente
const HORAS_LIMITE = 48

/**
 * Verifica si una fecha está dentro de las últimas N horas
 */
function isWithinHours(fechaStr: string, horas: number): boolean {
  try {
    const fecha = new Date(fechaStr)
    const ahora = new Date()
    const limiteMs = horas * 60 * 60 * 1000
    const diferenciaMs = ahora.getTime() - fecha.getTime()
    return diferenciaMs >= 0 && diferenciaMs <= limiteMs
  } catch {
    return false
  }
}

/**
 * Verifica si una noticia ya existe por su link
 */
async function noticiaExists(link: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('noticia')
    .select('id')
    .eq('link', link)
    .maybeSingle()

  return !!data
}

/**
 * Guarda una noticia en la base de datos
 */
async function saveNoticia(noticia: NoticiaExtraida, noticieroId: number): Promise<boolean> {
  try {
    // Verificar si ya existe
    if (await noticiaExists(noticia.link)) {
      return false
    }

    const { error } = await supabaseAdmin.from('noticia').insert({
      titulo: noticia.titulo,
      descripcion: noticia.descripcion,
      autor: noticia.autor,
      fuente: noticia.fuente,
      fecha_publicacion: noticia.fecha_publicacion,
      link: noticia.link,
      cuerpo: noticia.cuerpo,
      fuente_base: noticia.fuente_base,
      extraido_en: noticia.extraido_en,
      tipo_fuente: 'noticiero',
      noticiero_id: noticieroId,
      urgencia: 'media',
      procesado_llm: false,
      requiere_accion: false
    })

    if (error) {
      console.error('Error guardando noticia:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error en saveNoticia:', error)
    return false
  }
}

/**
 * Construye el dataset de noticias
 */
async function buildNewsDataset(
  sites: string[],
  feeds: string[],
  limit: number = 20
): Promise<{ total: number; nuevas: number; errores: number; duplicadas: number; omitidas_fecha: number }> {
  const allLinks: string[] = []
  const seen = new Set<string>()

  console.log('🔄 Iniciando scraping de noticias...')

  // Links desde home pages (filtrados)
  for (const site of sites) {
    console.log(`\n🔹 Procesando: ${site}`)
    try {
      const links = await getNewsLinks(site, limit)
      const filtered = filterRelevantLinks(links)

      for (const link of filtered) {
        const nu = normalizeUrl(link)
        if (!seen.has(nu)) {
          seen.add(nu)
          allLinks.push(nu)
        }
      }
      console.log(`   ✓ ${filtered.length} links relevantes encontrados`)
    } catch (error) {
      console.error(`   ✗ Error procesando ${site}:`, error)
    }
  }

  // Agregar RSS
  console.log('\n📡 Procesando feeds RSS...')
  try {
    const rssLinks = await getRssLinks(feeds)
    for (const link of rssLinks) {
      const nu = normalizeUrl(link)
      if (!seen.has(nu)) {
        seen.add(nu)
        allLinks.push(nu)
      }
    }
    console.log(`   ✓ ${rssLinks.length} links de RSS encontrados`)
  } catch (error) {
    console.error('   ✗ Error procesando RSS:', error)
  }

  console.log(`\n📰 Total de links únicos a procesar: ${allLinks.length}`)

  // Extraer contenidos y guardar
  let nuevas = 0
  let errores = 0
  let omitidas_fecha = 0
  let duplicadas = 0

  for (const link of allLinks) {
    try {
      // Verificar primero si ya existe (evitar fetch innecesario)
      if (await noticiaExists(link)) {
        duplicadas++
        continue
      }

      const noticia = await extractJsonLd(link)

      if (noticia) {
        // Filtrar por fecha: solo noticias de las últimas 48 horas
        if (!isWithinHours(noticia.fecha_publicacion, HORAS_LIMITE)) {
          omitidas_fecha++
          continue
        }

        const noticieroId = await getOrCreateNoticiero(noticia.fuente_base)

        if (noticieroId) {
          const saved = await saveNoticia(noticia, noticieroId)
          if (saved) {
            nuevas++
            console.log(` ✅ ${noticia.titulo.slice(0, 80)}...`)
          } else {
            duplicadas++
          }
        }
      }
    } catch {
      errores++
    }
  }

  console.log(`\n🗞️ Scraping completado:`)
  console.log(`   - Total links procesados: ${allLinks.length}`)
  console.log(`   - Nuevas guardadas: ${nuevas}`)
  console.log(`   - Duplicadas omitidas: ${duplicadas}`)
  console.log(`   - Fuera de rango (>${HORAS_LIMITE}h): ${omitidas_fecha}`)
  console.log(`   - Errores: ${errores}`)

  return { total: allLinks.length, nuevas, errores, duplicadas, omitidas_fecha }
}

export async function GET() {
  return NextResponse.json({
    message: 'Endpoint de scraping de noticias',
    usage: 'POST para ejecutar el scraping',
    params: {
      limit: 'Número máximo de links por sitio (default: 30)'
    },
    config: {
      horas_limite: HORAS_LIMITE,
      descripcion: `Solo se guardan noticias de las últimas ${HORAS_LIMITE} horas`
    }
  })
}

export async function POST(request: Request) {
  try {
    // Obtener parámetros del body
    let limit = 30

    try {
      const body = await request.json()
      limit = body.limit || 30
    } catch {
      // Sin body, usar defaults
    }

    console.log(`\n${'='.repeat(50)}`)
    console.log(`🚀 Iniciando scraping - ${new Date().toISOString()}`)
    console.log(`   Límite por sitio: ${limit}`)
    console.log(`   Solo noticias de las últimas ${HORAS_LIMITE} horas`)
    console.log(`${'='.repeat(50)}`)

    const result = await buildNewsDataset(SITES, FEEDS, limit)

    return NextResponse.json({
      success: true,
      message: 'Scraping completado',
      data: {
        total_links_procesados: result.total,
        nuevas_guardadas: result.nuevas,
        duplicadas_omitidas: result.duplicadas,
        fuera_de_rango: result.omitidas_fecha,
        errores: result.errores,
        filtro_horas: HORAS_LIMITE,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Error en scraping:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error durante el scraping',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
