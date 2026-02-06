'use client'

import { useState } from 'react'
import { 
  MapPin, 
  Clock, 
  ExternalLink, 
  Bookmark, 
  Share2, 
  Radio,
  Filter,
  ChevronDown,
  Newspaper
} from 'lucide-react'
import { formatRelativeTime, truncateText } from '@/lib/utils'
import { CATEGORIA_COLORS, URGENCIA_COLORS, CATEGORIAS } from '@/types/database'
import type { NoticiaConRelaciones, Noticiero } from '@/types/database'

interface NewsFeedProps {
  noticias: NoticiaConRelaciones[]
  loading?: boolean
  onNoticiaClick?: (id: number) => void
  onFilterChange?: (filters: {
    categoria?: string
    urgencia?: string
    tipo_fuente?: string
    fecha_desde?: string
    fecha_hasta?: string
    noticieros_ids?: number[]
  }) => void
  noticieros?: Noticiero[]
  noticierosLoading?: boolean
  selectedNoticierosIds?: number[]
}

export function NewsFeed({ 
  noticias, 
  loading, 
  onNoticiaClick, 
  onFilterChange,
  noticieros = [],
  noticierosLoading,
  selectedNoticierosIds = []
}: NewsFeedProps) {
  const [showFilters, setShowFilters] = useState(false)
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('')
  const [urgenciaFiltro, setUrgenciaFiltro] = useState<string>('')
  const [fechaDesdeFiltro, setFechaDesdeFiltro] = useState<string>('')
  const [fechaHastaFiltro, setFechaHastaFiltro] = useState<string>('')
  const [noticierosSeleccionados, setNoticierosSeleccionados] = useState<number[]>(selectedNoticierosIds)

  const handleFilterChange = (tipo: 'categoria' | 'urgencia' | 'fecha_desde' | 'fecha_hasta', valor: string) => {
    if (tipo === 'categoria') setCategoriaFiltro(valor)
    if (tipo === 'urgencia') setUrgenciaFiltro(valor)
    if (tipo === 'fecha_desde') setFechaDesdeFiltro(valor)
    if (tipo === 'fecha_hasta') setFechaHastaFiltro(valor)
    
    onFilterChange?.({
      categoria: tipo === 'categoria' ? valor : categoriaFiltro,
      urgencia: tipo === 'urgencia' ? valor : urgenciaFiltro,
      fecha_desde: tipo === 'fecha_desde' ? valor : fechaDesdeFiltro || undefined,
      fecha_hasta: tipo === 'fecha_hasta' ? valor : fechaHastaFiltro || undefined,
      noticieros_ids: noticierosSeleccionados.length > 0 ? noticierosSeleccionados : undefined
    })
  }

  const handleNoticierosChange = (ids: number[]) => {
    setNoticierosSeleccionados(ids)
    onFilterChange?.({
      categoria: categoriaFiltro || undefined,
      urgencia: urgenciaFiltro || undefined,
      fecha_desde: fechaDesdeFiltro || undefined,
      fecha_hasta: fechaHastaFiltro || undefined,
      noticieros_ids: ids.length > 0 ? ids : undefined
    })
  }

  const handleToggleNoticiero = (id: number) => {
    const newIds = noticierosSeleccionados.includes(id)
      ? noticierosSeleccionados.filter(selectedId => selectedId !== id)
      : [...noticierosSeleccionados, id]
    handleNoticierosChange(newIds)
  }

  // Contar filtros activos
  const filtrosActivos = [
    categoriaFiltro,
    urgenciaFiltro,
    fechaDesdeFiltro,
    fechaHastaFiltro,
    noticierosSeleccionados.length > 0 ? 'noticieros' : ''
  ].filter(Boolean).length

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
        </div>
        <div className="divide-y divide-gray-100">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-full mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 flex flex-col h-full">
      {/* Header con filtros */}
      <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Noticias</h2>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
            showFilters || filtrosActivos > 0
              ? 'bg-blue-100 text-blue-700' 
              : 'hover:bg-gray-100 text-gray-600'
          }`}
        >
          <Filter className="w-4 h-4" />
          <span>Filtros</span>
          {filtrosActivos > 0 && (
            <span className="px-1.5 py-0.5 text-xs font-medium rounded-full bg-blue-500 text-white">
              {filtrosActivos}
            </span>
          )}
          <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Panel de filtros expandible */}
      {showFilters && (
        <div className="p-3 sm:p-4 bg-gray-50 border-b border-gray-200 space-y-4">
          {/* Filtros principales */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Categoría</label>
              <select
                value={categoriaFiltro}
                onChange={(e) => handleFilterChange('categoria', e.target.value)}
                className="w-full px-2 sm:px-3 py-1.5 text-xs sm:text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Todas</option>
                {CATEGORIAS.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Urgencia</label>
              <select
                value={urgenciaFiltro}
                onChange={(e) => handleFilterChange('urgencia', e.target.value)}
                className="w-full px-2 sm:px-3 py-1.5 text-xs sm:text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Todas</option>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
              <input
                type="date"
                value={fechaDesdeFiltro}
                onChange={(e) => handleFilterChange('fecha_desde', e.target.value)}
                className="w-full px-2 sm:px-3 py-1.5 text-xs sm:text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
              <input
                type="date"
                value={fechaHastaFiltro}
                onChange={(e) => handleFilterChange('fecha_hasta', e.target.value)}
                className="w-full px-2 sm:px-3 py-1.5 text-xs sm:text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
          </div>

          {/* Selector de noticieros */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                <Newspaper className="w-3.5 h-3.5" />
                Noticieros
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleNoticierosChange(noticieros.map(n => n.id))}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Todos
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={() => handleNoticierosChange([])}
                  className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                >
                  Limpiar
                </button>
              </div>
            </div>
            
            {noticierosLoading ? (
              <div className="flex flex-wrap gap-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-8 w-24 bg-gray-200 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {noticieros.map((noticiero) => {
                  const isSelected = noticierosSeleccionados.includes(noticiero.id)
                  return (
                    <button
                      key={noticiero.id}
                      onClick={() => handleToggleNoticiero(noticiero.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${
                        isSelected
                          ? 'bg-blue-100 border border-blue-300 text-blue-700 font-medium'
                          : 'bg-white border border-gray-200 hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className={`w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0 border ${
                        isSelected 
                          ? 'bg-blue-500 border-blue-500' 
                          : 'border-gray-300'
                      }`}>
                        {isSelected && (
                          <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <span>{noticiero.nombre}</span>
                    </button>
                  )
                })}
                {noticieros.length === 0 && (
                  <p className="text-sm text-gray-500">No hay noticieros disponibles</p>
                )}
              </div>
            )}
            
            {noticierosSeleccionados.length === 0 && noticieros.length > 0 && (
              <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                <span>💡</span>
                Sin selección se muestran todos los noticieros
              </p>
            )}
          </div>
        </div>
      )}

      {/* Lista de noticias */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
        {noticias.length === 0 ? (
          <div className="p-6 sm:p-8 text-center text-gray-500">
            No hay noticias disponibles
          </div>
        ) : (
          noticias.map((noticia) => (
            <article
              key={noticia.id}
              onClick={() => onNoticiaClick?.(noticia.id)}
              className="p-3 sm:p-4 hover:bg-gray-50 transition-colors cursor-pointer group"
            >
              <div className="flex items-start gap-2 sm:gap-3">
                {/* Indicador de urgencia */}
                <div 
                  className="w-1 h-full min-h-[50px] sm:min-h-[60px] rounded-full flex-shrink-0"
                  style={{ backgroundColor: URGENCIA_COLORS[noticia.urgencia] }}
                />
                
                <div className="flex-1 min-w-0">
                  {/* Badges */}
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-1.5 flex-wrap">
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
                    {noticia.urgencia === 'alta' && (
                      <span className="px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium rounded-full bg-red-100 text-red-700">
                        Urgente
                      </span>
                    )}
                    {noticia.requiere_accion && (
                      <span className="hidden sm:inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                        Acción
                      </span>
                    )}
                  </div>

                  {/* Título */}
                  <h3 className="font-medium text-sm sm:text-base text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2 mb-1">
                    {noticia.titulo}
                  </h3>

                  {/* Descripción */}
                  {noticia.descripcion && (
                    <p className="text-xs sm:text-sm text-gray-600 line-clamp-1 mb-1.5 sm:mb-2">
                      {truncateText(noticia.descripcion, 100)}
                    </p>
                  )}

                  {/* Meta información */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-gray-500 flex-wrap">
                      <span className="truncate max-w-[80px] sm:max-w-none">
                        {noticia.fuente || (noticia.tipo_fuente === 'noticiero' 
                          ? noticia.noticiero?.nombre 
                          : noticia.agente?.nombre)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(noticia.fecha_publicacion)}
                      </span>
                      {noticia.ubicacion_geografica && (
                        <span className="hidden sm:flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {noticia.ubicacion_geografica}
                        </span>
                      )}
                    </div>

                    {/* Acciones */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        className="p-1.5 hover:bg-gray-200 rounded-lg"
                        onClick={(e) => e.stopPropagation()}
                        title="Guardar"
                      >
                        <Bookmark className="w-4 h-4 text-gray-500" />
                      </button>
                      <button 
                        className="p-1.5 hover:bg-gray-200 rounded-lg"
                        onClick={(e) => e.stopPropagation()}
                        title="Compartir"
                      >
                        <Share2 className="w-4 h-4 text-gray-500" />
                      </button>
                      {noticia.link && (
                        <a 
                          href={noticia.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 hover:bg-gray-200 rounded-lg"
                          onClick={(e) => e.stopPropagation()}
                          title="Ver original"
                        >
                          <ExternalLink className="w-4 h-4 text-gray-500" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  )
}
