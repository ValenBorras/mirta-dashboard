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
