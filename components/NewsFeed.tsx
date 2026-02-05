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
  ChevronDown
} from 'lucide-react'
import { formatRelativeTime, truncateText } from '@/lib/utils'
import { CATEGORIA_COLORS, URGENCIA_COLORS, CATEGORIAS } from '@/types/database'
import type { NoticiaConRelaciones } from '@/types/database'

type NivelGeografico = 'todas' | 'nacional' | 'provincial' | 'municipal'

interface NewsFeedProps {
  noticias: NoticiaConRelaciones[]
  loading?: boolean
  onNoticiaClick?: (id: number) => void
  onFilterChange?: (filters: {
    categoria?: string
    urgencia?: string
    tipo_fuente?: string
  }) => void
}

export function NewsFeed({ noticias, loading, onNoticiaClick, onFilterChange }: NewsFeedProps) {
  const [nivelActivo, setNivelActivo] = useState<NivelGeografico>('todas')
  const [showFilters, setShowFilters] = useState(false)
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('')
  const [urgenciaFiltro, setUrgenciaFiltro] = useState<string>('')

  const niveles: { key: NivelGeografico; label: string }[] = [
    { key: 'todas', label: 'Todas' },
    { key: 'nacional', label: 'Nacional' },
    { key: 'provincial', label: 'Provincial' },
    { key: 'municipal', label: 'Municipal' }
  ]

  const handleFilterChange = (tipo: 'categoria' | 'urgencia', valor: string) => {
    if (tipo === 'categoria') setCategoriaFiltro(valor)
    if (tipo === 'urgencia') setUrgenciaFiltro(valor)
    
    onFilterChange?.({
      categoria: tipo === 'categoria' ? valor : categoriaFiltro,
      urgencia: tipo === 'urgencia' ? valor : urgenciaFiltro
    })
  }

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
      {/* Tabs de nivel geográfico */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4">
        <div className="flex">
          {niveles.map((nivel) => (
            <button
              key={nivel.key}
              onClick={() => setNivelActivo(nivel.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                nivelActivo === nivel.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {nivel.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
            showFilters ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-600'
          }`}
        >
          <Filter className="w-4 h-4" />
          Filtros
          <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Panel de filtros */}
      {showFilters && (
        <div className="p-4 bg-gray-50 border-b border-gray-200 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Categoría</label>
            <select
              value={categoriaFiltro}
              onChange={(e) => handleFilterChange('categoria', e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas</option>
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
          </div>
        </div>
      )}

      {/* Lista de noticias */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
        {noticias.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No hay noticias disponibles
          </div>
        ) : (
          noticias.map((noticia) => (
            <article
              key={noticia.id}
              onClick={() => onNoticiaClick?.(noticia.id)}
              className="p-4 hover:bg-gray-50 transition-colors cursor-pointer group"
            >
              <div className="flex items-start gap-3">
                {/* Indicador de urgencia */}
                <div 
                  className="w-1 h-full min-h-[60px] rounded-full flex-shrink-0"
                  style={{ backgroundColor: URGENCIA_COLORS[noticia.urgencia] }}
                />
                
                <div className="flex-1 min-w-0">
                  {/* Badges */}
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    {noticia.tipo_fuente === 'agente' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                        <Radio className="w-3 h-3" />
                        Campo
                      </span>
                    )}
                    {noticia.categoria && (
                      <span 
                        className="px-2 py-0.5 text-xs font-medium rounded-full text-white"
                        style={{ backgroundColor: CATEGORIA_COLORS[noticia.categoria] || '#6B7280' }}
                      >
                        {noticia.categoria}
                      </span>
                    )}
                    {noticia.urgencia === 'alta' && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
                        Urgente
                      </span>
                    )}
                    {noticia.requiere_accion && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                        Acción
                      </span>
                    )}
                  </div>

                  {/* Título */}
                  <h3 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2 mb-1">
                    {noticia.titulo}
                  </h3>

                  {/* Descripción */}
                  {noticia.descripcion && (
                    <p className="text-sm text-gray-600 line-clamp-1 mb-2">
                      {truncateText(noticia.descripcion, 100)}
                    </p>
                  )}

                  {/* Meta información */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>
                        {noticia.fuente || (noticia.tipo_fuente === 'noticiero' 
                          ? noticia.noticiero?.nombre 
                          : noticia.agente?.nombre)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(noticia.fecha_publicacion)}
                      </span>
                      {noticia.ubicacion_geografica && (
                        <span className="flex items-center gap-1">
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
