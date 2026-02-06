'use client'

import { X, ExternalLink, Clock, MapPin, User, Radio, Bookmark, Share2, Tag, Newspaper } from 'lucide-react'
import { formatDate, formatTime, formatUbicacion } from '@/lib/utils'
import { CATEGORIA_COLORS, URGENCIA_COLORS, NoticiaConRelaciones } from '@/types/database'

interface NoticiaModalProps {
  noticia: NoticiaConRelaciones | null
  onClose: () => void
}

export function NoticiaModal({ noticia, onClose }: NoticiaModalProps) {
  if (!noticia) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-3 sm:p-4 border-b border-gray-200 flex items-start justify-between gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-2 flex-wrap">
              <span 
                className="px-2 py-0.5 text-[10px] sm:text-xs font-medium rounded-full text-white"
                style={{ backgroundColor: URGENCIA_COLORS[noticia.urgencia] }}
              >
                {noticia.urgencia.toUpperCase()}
              </span>
              {noticia.tipo_fuente === 'agente' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] sm:text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                  <Radio className="w-3 h-3" />
                  <span className="hidden sm:inline">Reporte de Campo</span>
                  <span className="sm:hidden">Campo</span>
                </span>
              )}
              {noticia.categoria && (
                <span 
                  className="px-2 py-0.5 text-[10px] sm:text-xs font-medium rounded-full text-white"
                  style={{ backgroundColor: CATEGORIA_COLORS[noticia.categoria] || '#6B7280' }}
                >
                  {noticia.categoria}
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-xl font-bold text-gray-900 line-clamp-3 sm:line-clamp-none">{noticia.titulo}</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg flex-shrink-0"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Meta info */}
        <div className="px-3 sm:px-4 py-2 sm:py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2 sm:gap-4 flex-wrap text-xs sm:text-sm text-gray-600">
          {noticia.fuente && (
            <span className="flex items-center gap-1">
              <Newspaper className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="truncate max-w-[100px] sm:max-w-none">{noticia.fuente}</span>
            </span>
          )}
          {noticia.autor && (
            <span className="hidden sm:flex items-center gap-1">
              <User className="w-4 h-4" />
              {noticia.autor}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">{formatDate(noticia.fecha_publicacion)} • {formatTime(noticia.fecha_publicacion)}</span>
            <span className="sm:hidden">{formatDate(noticia.fecha_publicacion)}</span>
          </span>
          {formatUbicacion(noticia.provincia, noticia.ciudad) && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="truncate max-w-[80px] sm:max-w-none">{formatUbicacion(noticia.provincia, noticia.ciudad)}</span>
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {noticia.descripcion && (
            <div className="mb-4 p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-100">
              <h3 className="text-xs sm:text-sm font-semibold text-blue-800 mb-1">Descripción</h3>
              <p className="text-sm sm:text-base text-blue-900">{noticia.descripcion}</p>
            </div>
          )}

          {noticia.cuerpo && (
            <div className="prose prose-sm max-w-none text-gray-700">
              {noticia.cuerpo.split('\n').map((paragraph, i) => (
                <p key={i} className="text-sm sm:text-base">{paragraph}</p>
              ))}
            </div>
          )}

          {/* Palabras clave */}
          {noticia.palabras_clave && noticia.palabras_clave.length > 0 && (
            <div className="mt-4 sm:mt-6 pt-4 border-t border-gray-200">
              <h3 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                Palabras clave
              </h3>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {noticia.palabras_clave.map((keyword, i) => (
                  <span 
                    key={i}
                    className="px-2 py-0.5 sm:py-1 bg-gray-100 text-gray-700 text-xs sm:text-sm rounded-full"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Sentimiento */}
          {noticia.sentimiento && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h3 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2">Análisis de sentimiento</h3>
              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
                noticia.sentimiento === 'positivo' ? 'bg-green-100 text-green-700' :
                noticia.sentimiento === 'negativo' ? 'bg-red-100 text-red-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {noticia.sentimiento.charAt(0).toUpperCase() + noticia.sentimiento.slice(1)}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-gray-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 sm:gap-2">
            <button className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg">
              <Bookmark className="w-4 h-4" />
              <span className="hidden sm:inline">Guardar</span>
            </button>
            <button className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg">
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">Compartir</span>
            </button>
          </div>
          {noticia.link && (
            <a
              href={noticia.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">Ver original</span>
              <span className="sm:hidden">Ver</span>
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
