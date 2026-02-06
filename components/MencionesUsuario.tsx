'use client'

import { User, ExternalLink, Clock, MapPin, X, Radio } from 'lucide-react'
import { formatDate, formatTime, formatUbicacion } from '@/lib/utils'
import { CATEGORIA_COLORS, URGENCIA_COLORS } from '@/types/database'

interface NoticiaBasica {
  id: number
  titulo: string
  descripcion: string | null
  cuerpo: string | null
  link: string | null
  fecha_publicacion: string
  categoria: string | null
  urgencia: 'alta' | 'media' | 'baja'
  provincia: string | null
  ciudad: string | null
  tipo_fuente: 'noticiero' | 'agente'
}

interface MencionesUsuarioProps {
  nombreUsuario: string
  menciones: NoticiaBasica[]
  count: number
  loading?: boolean
  onClose?: () => void
  onNoticiaClick?: (id: number) => void
}

export function MencionesUsuario({ 
  nombreUsuario, 
  menciones, 
  count, 
  loading, 
  onClose,
  onNoticiaClick 
}: MencionesUsuarioProps) {
  if (loading) {
    return (
      <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200 p-4">
        <div className="h-6 bg-purple-200 rounded w-48 animate-pulse mb-4" />
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg p-3 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (count === 0) {
    return null
  }

  return (
    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
      <div className="p-3 sm:p-4 border-b border-purple-200 flex items-center justify-between">
        <h2 className="font-semibold text-sm sm:text-base text-gray-900 flex items-center gap-2">
          <User className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
          Sus Menciones
          <span className="text-xs sm:text-sm font-normal text-purple-600">
            ({count} {count === 1 ? 'vez' : 'veces'})
          </span>
        </h2>
        {onClose && (
          <button onClick={onClose} className="p-1 hover:bg-purple-200 rounded-lg">
            <X className="w-4 h-4 text-gray-600" />
          </button>
        )}
      </div>

      <div className="p-2 sm:p-3 space-y-2 max-h-[250px] sm:max-h-[300px] overflow-y-auto">
        {menciones.slice(0, 5).map((noticia) => (
          <div
            key={noticia.id}
            onClick={() => onNoticiaClick?.(noticia.id)}
            className="bg-white rounded-lg p-2.5 sm:p-3 hover:shadow-md transition-all cursor-pointer group border border-transparent hover:border-purple-300"
          >
            <div className="flex items-start gap-1.5 sm:gap-2 mb-1 flex-wrap">
              {noticia.tipo_fuente === 'agente' && (
                <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                  <Radio className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  Campo
                </span>
              )}
              {noticia.categoria && (
                <span 
                  className="px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium rounded-full text-white"
                  style={{ backgroundColor: CATEGORIA_COLORS[noticia.categoria] || '#6B7280' }}
                >
                  {noticia.categoria}
                </span>
              )}
              <span 
                className="px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium rounded-full text-white ml-auto"
                style={{ backgroundColor: URGENCIA_COLORS[noticia.urgencia] }}
              >
                {noticia.urgencia}
              </span>
            </div>

            <h3 className="font-medium text-gray-900 text-xs sm:text-sm mb-1 group-hover:text-purple-600 transition-colors line-clamp-2">
              {highlightName(noticia.titulo, nombreUsuario)}
            </h3>

            <div className="flex items-center gap-2 text-[10px] sm:text-xs text-gray-500 flex-wrap">
              <span className="flex items-center gap-1">
                <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                <span className="hidden sm:inline">{formatDate(noticia.fecha_publicacion)} {formatTime(noticia.fecha_publicacion)}</span>
                <span className="sm:hidden">{formatDate(noticia.fecha_publicacion)}</span>
              </span>
              {formatUbicacion(noticia.provincia, noticia.ciudad) && (
                <span className="hidden sm:flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {formatUbicacion(noticia.provincia, noticia.ciudad)}
                </span>
              )}
              {noticia.link && (
                <a
                  href={noticia.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto flex items-center gap-1 text-purple-600 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  Ver
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function highlightName(text: string, name: string): React.ReactNode {
  if (!name) return text
  
  const regex = new RegExp(`(${name})`, 'gi')
  const parts = text.split(regex)
  
  return parts.map((part, i) => 
    part.toLowerCase() === name.toLowerCase() ? (
      <mark key={i} className="bg-purple-200 text-purple-900 px-0.5 rounded">
        {part}
      </mark>
    ) : (
      part
    )
  )
}
