'use client'

import { AlertTriangle, MapPin, Clock, ExternalLink, Check } from 'lucide-react'
import { formatRelativeTime, truncateText, formatUbicacion } from '@/lib/utils'
import { CATEGORIA_COLORS } from '@/types/database'

interface NoticiaUrgente {
  id: number
  titulo: string
  descripcion: string | null
  categoria: string | null
  provincia: string | null
  ciudad: string | null
  fecha_publicacion: string
  link: string | null
}

interface AlertasUrgentesProps {
  noticias: NoticiaUrgente[]
  loading?: boolean
  onNoticiaClick?: (id: number) => void
}

export function AlertasUrgentes({ noticias, loading, onNoticiaClick }: AlertasUrgentesProps) {
  if (loading) {
    return (
      <div className="mb-4 sm:mb-6">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
          Alertas Urgentes
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-3 sm:p-4 border-2 border-red-200 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2 sm:mb-3" />
              <div className="h-3 bg-gray-200 rounded w-full mb-2" />
              <div className="h-3 bg-gray-200 rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (noticias.length === 0) {
    return null
  }

  return (
    <div className="mb-4 sm:mb-6">
      <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-3 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
        Alertas Urgentes
        <span className="text-sm font-normal text-gray-500">({noticias.length})</span>
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {noticias.slice(0, 3).map((noticia) => (
          <div 
            key={noticia.id}
            className="bg-white rounded-xl p-3 sm:p-4 border-2 border-red-200 hover:border-red-400 hover:shadow-lg transition-all cursor-pointer group"
            onClick={() => onNoticiaClick?.(noticia.id)}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
                URGENTE
              </span>
              {noticia.categoria && (
                <span 
                  className="px-2 py-0.5 text-xs font-medium rounded-full text-white"
                  style={{ backgroundColor: CATEGORIA_COLORS[noticia.categoria] || '#6B7280' }}
                >
                  {noticia.categoria}
                </span>
              )}
            </div>
            
            <h3 className="font-semibold text-gray-900 text-sm sm:text-base mb-2 group-hover:text-red-600 transition-colors line-clamp-2">
              {noticia.titulo}
            </h3>
            
            {noticia.descripcion && (
              <p className="text-xs sm:text-sm text-gray-600 mb-2 sm:mb-3 line-clamp-2">
                {truncateText(noticia.descripcion, 120)}
              </p>
            )}
            
            <div className="flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                {formatUbicacion(noticia.provincia, noticia.ciudad) && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate max-w-[100px]">{formatUbicacion(noticia.provincia, noticia.ciudad)}</span>
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatRelativeTime(noticia.fecha_publicacion)}
                </span>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="p-1 hover:bg-green-100 rounded" title="Marcar como revisada">
                  <Check className="w-4 h-4 text-green-600" />
                </button>
                {noticia.link && (
                  <a 
                    href={noticia.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-1 hover:bg-blue-100 rounded"
                    onClick={(e) => e.stopPropagation()}
                    title="Ver original"
                  >
                    <ExternalLink className="w-4 h-4 text-blue-600" />
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
