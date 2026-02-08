import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { supabaseAdmin } from '@/lib/supabase-server'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}

/**
 * Decodifica entidades HTML que puedan haber quedado sin procesar
 */
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
    '&aacute;': 'á',
    '&eacute;': 'é',
    '&iacute;': 'í',
    '&oacute;': 'ó',
    '&uacute;': 'ú',
    '&Aacute;': 'Á',
    '&Eacute;': 'É',
    '&Iacute;': 'Í',
    '&Oacute;': 'Ó',
    '&Uacute;': 'Ú',
    '&ntilde;': 'ñ',
    '&Ntilde;': 'Ñ',
    '&uuml;': 'ü',
    '&Uuml;': 'Ü',
    '&iquest;': '¿',
    '&iexcl;': '¡'
  }

  let decoded = text
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replaceAll(entity, char)
  }
  
  // También decodificar entidades numéricas
  decoded = decoded.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
  decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
  
  return decoded
}

/**
 * Devuelve la fecha exactamente como viene del sitio web
 */
function preserveOriginalTimestamp(dateStr: string): string {
  if (!dateStr) {
    return new Date().toISOString()
  }
  
  const trimmed = dateStr.trim()
  const date = new Date(trimmed)
  
  if (isNaN(date.getTime())) {
    return new Date().toISOString()
  }
  
  // Devolver tal cual viene, sin modificaciones
  return trimmed
}

// Sitios de noticias a scrapear
const SITES = [
  'https://www.clarin.com/',
  'https://www.lanacion.com.ar/',
  'https://www.tn.com.ar/',
  'https://cnnespanol.cnn.com/argentina',
  'https://elpais.com/',
  'https://www.elonce.com/ultimas-noticias',
  'https://www.elonce.com/parana',
  'https://www.elonce.com/policiales',
  'https://www.elonce.com/politica',
  'https://www.elonce.com/sociedad',
  'https://www.elonce.com/internacionales',
  'https://www.elonce.com/economia',
  'https://www.analisisdigital.com.ar/',
  'https://www.analisisdigital.com.ar/opinion',
  'https://www.analisisdigital.com.ar/judiciales',
  'https://www.analisisdigital.com.ar/provinciales',
  'https://www.analisisdigital.com.ar/policiales',
  'https://www.analisisdigital.com.ar/economia',
  'https://www.analisisdigital.com.ar/cultura',
  'https://www.analisisdigital.com.ar/nacionales',
  'https://www.analisisdigital.com.ar/locales'
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
  'http://www.lapoliticaonline.com.ar/files/rss/judiciales.xml',
  'http://www.lapoliticaonline.com.ar/files/rss/medios.xml'
]

// Categorías relevantes
const RELEVANTES = [
  'politica', 'economia', 'sociedad', 'educacion', 'seguridad',
  'nacion', 'elecciones', 'actualidad', 'argentina', 'ciudades',
  'judiciales', 'provinciales', 'policiales', 'locales', 'nacionales', 'opinion'
]

// Categorías no relevantes
const NO_RELEVANTES = [
  'deportes', 'futbol', 'autos', 'show', 'fama', 'espectaculos',
  'gente', 'moda', 'estilo', 'gastronomia', 'viajes', 'revista',
  'salud', 'bienestar', 'icon', 'elviajero', 'television'
]

interface NoticiaExtraida {
  titulo: string
  descripcion: string | null
  autor: string | null
  fuente: string
  fecha_publicacion: string
  link: string
  cuerpo: string | null
  imagen_url: string | null
  fuente_base: string
  extraido_en: string
}

/**
 * Extrae metadatos y cuerpo de una noticia de Análisis Digital desde el HTML
 */
async function extractAnalisisDigital(url: string): Promise<NoticiaExtraida | null> {
  try {
    const response = await fetch(url, { headers: HEADERS })
    if (!response.ok) return null

    const html = await response.text()
    const $ = cheerio.load(html)

    // Extraer de meta tags Open Graph
    const titulo = decodeHtmlEntities(
      $('meta[property="og:title"]').attr('content') || 
      $('h1').first().text().trim()
    )

    const descripcion = $('meta[property="og:description"]').attr('content') || 
                       $('meta[name="description"]').attr('content') || 
                       null
    const descripcionDecoded = descripcion ? decodeHtmlEntities(descripcion) : null

    const imagenUrl = $('meta[property="og:image"]').attr('content') || null

    // Extraer cuerpo del artículo - buscar párrafos con contenido significativo
    const parrafos = $('p')
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(p => {
        // Filtrar párrafos muy cortos o que sean elementos de navegación
        return p.length > 50 && 
               !p.includes('href=') && 
               !p.includes('src=') &&
               !p.includes('Newsletter') &&
               !p.includes('Seguinos en') &&
               !p.includes('Suscribite')
      })

    const cuerpo = decodeHtmlEntities(parrafos.join('\n\n'))

    // Extraer fecha
    let fecha = $('meta[property="article:published_time"]').attr('content') ||
                $('meta[name="date"]').attr('content') ||
                $('time').attr('datetime')

    // Si no hay fecha en meta tags, intentar extraer de la URL (formato: /seccion/YYYY/MM/DD/...)
    if (!fecha) {
      const dateMatch = url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//)
      if (dateMatch) {
        fecha = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}T12:00:00Z`
      } else {
        fecha = new Date().toISOString()
      }
    }

    if (!titulo || !cuerpo || cuerpo.length < 100) {
      return null
    }

    const parsedUrl = new URL(url)
    return {
      titulo,
      descripcion: descripcionDecoded,
      autor: null,
      fuente: 'Análisis Digital',
      fecha_publicacion: preserveOriginalTimestamp(fecha),
      link: url,
      cuerpo,
      imagen_url: imagenUrl,
      fuente_base: parsedUrl.hostname,
      extraido_en: new Date().toISOString()
    }
  } catch (error) {
    console.error('Error extrayendo Análisis Digital:', error)
    return null
  }
}

/**
 * Extrae metadatos y cuerpo de una noticia de El Once desde el HTML
 */
async function extractElOnce(url: string): Promise<NoticiaExtraida | null> {
  try {
    const response = await fetch(url, { headers: HEADERS })
    if (!response.ok) return null

    const html = await response.text()
    const $ = cheerio.load(html)

    // Buscar el título - puede estar en h1 o en meta tags
    let titulo = $('h1').first().text().trim()
    if (!titulo) {
      titulo = $('meta[property="og:title"]').attr('content') || ''
    }
    titulo = decodeHtmlEntities(titulo)

    // Buscar la descripción
    let descripcion: string | null = $('h2').first().text().trim()
    if (!descripcion) {
      descripcion = $('meta[property="og:description"]').attr('content') || 
                    $('meta[name="description"]').attr('content') || 
                    null
    }
    if (descripcion) {
      descripcion = decodeHtmlEntities(descripcion)
    }

    // Buscar el cuerpo de la noticia - usualmente en párrafos dentro del artículo
    let cuerpo = ''
    
    // Textos de UI/navegación que debemos excluir
    const excludeTexts = [
      '¿Querés recibir alertas de último momento?',
      'Copyright',
      '©',
      'Seguinos en',
      'Suscribite',
      'Newsletter',
      'Ver más',
      'Compartir',
      'Acceso a portada',
      'Edición N°'
    ]
    
    // Función para verificar si un párrafo debe ser excluido
    const shouldExclude = (text: string): boolean => {
      return excludeTexts.some(exclude => text.includes(exclude)) || text.length < 20
    }
    
    // Intentar varios selectores comunes para el contenido
    const contentSelectors = [
      'article p',
      '.article-content p',
      '.content p',
      '.body p',
      'main p'
    ]

    for (const selector of contentSelectors) {
      const paragraphs = $(selector)
      if (paragraphs.length > 0) {
        cuerpo = paragraphs
          .map((_, el) => $(el).text().trim())
          .get()
          .filter(p => !shouldExclude(p))
          .join('\n\n')
        if (cuerpo.length > 100) break
      }
    }

    // Si no encontramos cuerpo con selectores específicos, buscar todos los párrafos
    if (!cuerpo || cuerpo.length < 100) {
      cuerpo = $('p')
        .map((_, el) => $(el).text().trim())
        .get()
        .filter(p => !shouldExclude(p))
        .join('\n\n')
    }

    // Decodificar entidades HTML en el cuerpo
    cuerpo = decodeHtmlEntities(cuerpo)

    // Buscar fecha
    const fecha = $('meta[property="article:published_time"]').attr('content') ||
          $('meta[name="date"]').attr('content') ||
          $('time').attr('datetime') ||
          new Date().toISOString()

    if (!titulo || !cuerpo || cuerpo.length < 50) {
      return null
    }

    // Buscar imagen
    let imagenUrl: string | null = null
    imagenUrl = $('meta[property="og:image"]').attr('content') ||
                $('meta[name="twitter:image"]').attr('content') ||
                $('article img').first().attr('src') ||
                null

    // Asegurar que la URL de la imagen sea absoluta
    if (imagenUrl && !imagenUrl.startsWith('http')) {
      const parsedUrl = new URL(url)
      const base = `${parsedUrl.protocol}//${parsedUrl.host}`
      imagenUrl = imagenUrl.startsWith('/') ? `${base}${imagenUrl}` : `${base}/${imagenUrl}`
    }

    const parsedUrl = new URL(url)
    return {
      titulo,
      descripcion,
      autor: null,
      fuente: 'El Once',
      fecha_publicacion: preserveOriginalTimestamp(fecha),
      link: url,
      cuerpo,
      imagen_url: imagenUrl,
      fuente_base: parsedUrl.hostname,
      extraido_en: new Date().toISOString()
    }
  } catch (error) {
    console.error('Error extrayendo El Once:', error)
    return null
  }
}

/**
 * Extrae metadatos y cuerpo de una noticia desde el bloque JSON-LD
 */
async function extractJsonLd(url: string): Promise<NoticiaExtraida | null> {
  try {
    // Si es El Once, usar el scraper específico
    if (url.includes('elonce.com')) {
      return extractElOnce(url)
    }

    // Si es Análisis Digital, usar el scraper específico
    if (url.includes('analisisdigital.com.ar')) {
      return extractAnalisisDigital(url)
    }

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

          // Obtener nombre de la fuente
          const publisher = article.publisher as Record<string, unknown> | undefined
          const fuente = publisher?.name as string || new URL(url).hostname

          // Decodificar entidades HTML en todos los campos de texto
          const titulo = decodeHtmlEntities(article.headline as string)
          const descripcion = article.description ? decodeHtmlEntities(article.description as string) : null
          const cuerpo = article.articleBody ? decodeHtmlEntities(article.articleBody as string) : null
          const autorDecoded = autor ? decodeHtmlEntities(autor) : null

          // Extraer URL de imagen desde JSON-LD
          let imagenUrl: string | null = null
          const image = article.image
          if (typeof image === 'string') {
            imagenUrl = image
          } else if (typeof image === 'object' && image !== null) {
            // El campo image puede ser un objeto con url o contentUrl
            const imageObj = image as Record<string, unknown>
            imagenUrl = (imageObj.url as string) || (imageObj.contentUrl as string) || null
          } else if (Array.isArray(image) && image.length > 0) {
            // Puede ser un array de imágenes, tomamos la primera
            const firstImage = image[0]
            if (typeof firstImage === 'string') {
              imagenUrl = firstImage
            } else if (typeof firstImage === 'object' && firstImage !== null) {
              const imgObj = firstImage as Record<string, unknown>
              imagenUrl = (imgObj.url as string) || (imgObj.contentUrl as string) || null
            }
          }

          return {
            titulo,
            descripcion,
            autor: autorDecoded,
            fuente,
            fecha_publicacion: preserveOriginalTimestamp(fechaRaw || ''),
            link: (article.url as string) || url,
            cuerpo,
            imagen_url: imagenUrl,
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
        const hasSection = /(politica|sociedad|mundo|show|economia|deportes|policiales|judiciales|provinciales|locales|nacionales|opinion|cultura)\//.test(href)
        const hasDate = /\/\d{4}\/\d{2}\/\d{2}\//.test(href)
        const isElOnceArticle = /\.htm$/.test(href) && href.includes('elonce.com')
        const isAnalisisDigital = /\/(noticias-de-edicion-impresa|opinion|judiciales|provinciales|policiales|economia|cultura|nacionales|locales)\//.test(href) && href.includes('analisisdigital.com.ar')

        if (hasNid || hasSection || hasDate || isElOnceArticle || isAnalisisDigital) {
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
      'www.lapoliticaonline.com.ar': 'La Política Online',
      'www.elonce.com': 'El Once',
      'www.analisisdigital.com.ar': 'Análisis Digital'
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
      imagen_url: noticia.imagen_url,
      fuente_base: noticia.fuente_base,
      extraido_en: noticia.extraido_en,
      tipo_fuente: 'noticiero',
      noticiero_id: noticieroId,
      urgencia: 'media',
      procesado_llm: false
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

// Removed unused `processInBatches` helper (was defined but never used).

/**
 * Construye el dataset de noticias
 */
async function buildNewsDataset(
  sites: string[],
  feeds: string[],
  limit: number = 20,
  concurrency: number = 20
): Promise<{ total: number; nuevas: number; errores: number; duplicadas: number }> {
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
  console.log(`⚡ Procesando con concurrencia de ${concurrency} links simultáneos`)

  // Extraer contenidos y guardar (paralelizado)
  let nuevas = 0
  let errores = 0
  let duplicadas = 0

  // Función para procesar un link individual
  const procesarLink = async (link: string): Promise<{ tipo: 'nueva' | 'duplicada' | 'error'; titulo?: string }> => {
    try {
      // Verificar primero si ya existe (evitar fetch innecesario)
      if (await noticiaExists(link)) {
        return { tipo: 'duplicada' }
      }

      const noticia = await extractJsonLd(link)

      if (noticia) {
        const noticieroId = await getOrCreateNoticiero(noticia.fuente_base)

        if (noticieroId) {
          const saved = await saveNoticia(noticia, noticieroId)
          if (saved) {
            return { tipo: 'nueva', titulo: noticia.titulo }
          } else {
            return { tipo: 'duplicada' }
          }
        }
      }
      return { tipo: 'error' }
    } catch {
      return { tipo: 'error' }
    }
  }

  // Procesar en lotes paralelos
  const totalBatches = Math.ceil(allLinks.length / concurrency)
  
  for (let i = 0; i < allLinks.length; i += concurrency) {
    const batch = allLinks.slice(i, i + concurrency)
    const batchNum = Math.floor(i / concurrency) + 1
    
    console.log(`\n🔄 Procesando lote ${batchNum}/${totalBatches} (${batch.length} links)...`)
    
    const resultados = await Promise.all(batch.map(link => procesarLink(link)))
    
    // Contar resultados del lote
    for (const resultado of resultados) {
      if (resultado.tipo === 'nueva') {
        nuevas++
        if (resultado.titulo) {
          console.log(` ✅ ${resultado.titulo.slice(0, 80)}...`)
        }
      } else if (resultado.tipo === 'duplicada') {
        duplicadas++
      } else {
        errores++
      }
    }
    
    console.log(`   Lote ${batchNum}: ${resultados.filter(r => r.tipo === 'nueva').length} nuevas, ${resultados.filter(r => r.tipo === 'duplicada').length} duplicadas, ${resultados.filter(r => r.tipo === 'error').length} errores`)
  }

  console.log(`\n🗞️ Scraping completado:`)
  console.log(`   - Total links procesados: ${allLinks.length}`)
  console.log(`   - Nuevas guardadas: ${nuevas}`)
  console.log(`   - Duplicadas omitidas: ${duplicadas}`)
  console.log(`   - Errores: ${errores}`)

  return { total: allLinks.length, nuevas, errores, duplicadas }
}

export async function GET() {
  return NextResponse.json({
    message: 'Endpoint de scraping de noticias',
    usage: 'POST para ejecutar el scraping',
    params: {
      limit: 'Número máximo de links por sitio (default: 30)',
      concurrency: 'Número de links a procesar simultáneamente (default: 20)'
    }
  })
}

export async function POST(request: Request) {
  try {
    // Obtener parámetros del body
    let limit = 30
    let concurrency = 20

    try {
      const body = await request.json()
      limit = body.limit || 30
      concurrency = body.concurrency || 20
    } catch {
      // Sin body, usar defaults
    }

    console.log(`\n${'='.repeat(50)}`)
    console.log(`🚀 Iniciando scraping - ${new Date().toISOString()}`)
    console.log(`   Límite por sitio: ${limit}`)
    console.log(`   Concurrencia: ${concurrency} links simultáneos`)
    console.log(`${'='.repeat(50)}`)

    const result = await buildNewsDataset(SITES, FEEDS, limit, concurrency)

    return NextResponse.json({
      success: true,
      message: 'Scraping completado',
      data: {
        total_links_procesados: result.total,
        nuevas_guardadas: result.nuevas,
        duplicadas_omitidas: result.duplicadas,
        errores: result.errores,
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
