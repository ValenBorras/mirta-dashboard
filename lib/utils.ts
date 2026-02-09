import { type ClassValue, clsx } from 'clsx'

// Zona horaria de Argentina
const TIMEZONE = 'America/Argentina/Buenos_Aires'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions) {
  return new Date(date).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: TIMEZONE,
    ...options
  })
}

export function formatTime(date: string | Date) {
  return new Date(date).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIMEZONE
  })
}

export function formatRelativeTime(date: string | Date) {
  const now = new Date()
  // Convertir la fecha a la zona horaria de Argentina para comparación
  const past = new Date(date)
  const diffMs = now.getTime() - past.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Ahora'
  if (diffMins < 60) return `Hace ${diffMins} min`
  if (diffHours < 24) return `Hace ${diffHours}h`
  if (diffDays < 7) return `Hace ${diffDays}d`
  return formatDate(date)
}

export function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trim() + '...'
}

/**
 * Construye una cadena de ubicación geográfica a partir de provincia y ciudad
 */
export function formatUbicacion(provincia: string | null, ciudad: string | null): string | null {
  if (ciudad && provincia) {
    return `${ciudad}, ${provincia}`
  }
  if (provincia) {
    return provincia
  }
  if (ciudad) {
    return ciudad
  }
  return null
}

/**
 * Formatea el cuerpo de una noticia en párrafos legibles
 * Intenta diferentes estrategias de separación y filtra párrafos vacíos
 */
export function formatNewsParagraphs(cuerpo: string): string[] {
  if (!cuerpo) return []
  
  // Primero intentar separar por doble salto de línea (formato del scraper)
  let paragraphs = cuerpo.split('\n\n').map(p => p.trim()).filter(p => p.length > 0)
  
  // Si obtenemos pocos párrafos (1-2) y el texto es largo, intentar con saltos simples
  if (paragraphs.length <= 2 && cuerpo.length > 300) {
    paragraphs = cuerpo.split('\n').map(p => p.trim()).filter(p => p.length > 0)
  }

  // Si sigue siendo un solo bloque grande (datos viejos de articleBody JSON-LD),
  // dividir en puntos donde naturalmente cambia el tema:
  // buscar patrones como ". Palabra mayúscula" que indican un nuevo párrafo potencial
  if (paragraphs.length <= 2 && cuerpo.length > 400) {
    // Dividir por oraciones que terminan en punto seguido de mayúscula
    const parts = cuerpo.split(/\.(?=\s+[A-ZÁÉÍÓÚÑ])/)
    if (parts.length > 2) {
      paragraphs = []
      let current = ''
      for (let i = 0; i < parts.length; i++) {
        current += parts[i]
        // Agregar el punto que se removió al hacer split (excepto en el último)
        if (i < parts.length - 1) current += '.'
        // Agrupar de a ~2-3 oraciones para que los párrafos no sean de una sola oración
        const sentenceCount = (current.match(/\./g) || []).length
        if (sentenceCount >= 3 || (i === parts.length - 1 && current.trim())) {
          paragraphs.push(current.trim())
          current = ''
        }
      }
      if (current.trim()) {
        paragraphs.push(current.trim())
      }
    }
  }
  
  // Sanitizar HTML: mantener solo tags de formato básico
  paragraphs = paragraphs.map(p => sanitizeHtml(p))
  
  return paragraphs.filter(p => p.length > 20) // Filtrar párrafos muy cortos
}

/**
 * Sanitiza HTML manteniendo solo tags de formato básico (negrita, cursiva)
 * y eliminando tags peligrosos o no deseados
 */
function sanitizeHtml(html: string): string {
  // Eliminar scripts y estilos
  html = html.replace(/<script[^>]*>.*?<\/script>/gi, '')
  html = html.replace(/<style[^>]*>.*?<\/style>/gi, '')
  
  // Eliminar links pero mantener el texto
  html = html.replace(/<a[^>]*>(.*?)<\/a>/gi, '$1')
  
  // Eliminar otros tags excepto los de formato (negrita, cursiva, etc.)
  // Permitimos: <b>, <strong>, <i>, <em>, <u>, <mark>, <small>, <del>, <ins>, <sub>, <sup>
  html = html.replace(/<(?!\/?(?:b|strong|i|em|u|mark|small|del|ins|sub|sup)\b)[^>]+>/gi, '')

  // Limpiar cualquier evento o atributo on* que pueda haber quedado
  html = html.replace(/\son\w+="[^"]*"/gi, '')

  // Eliminar escapes de barra invertida antes de comillas o slash (\" -> ", \/ -> /)
  // y reemplazar secuencias de newline escapadas por un espacio
  html = html.replace(/\\(["'\/])/g, '$1')
  html = html.replace(/\\n/g, ' ')

  return html
}
