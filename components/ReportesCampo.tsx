'use client'

import { Radio, MapPin, CheckCircle } from 'lucide-react'
import { formatRelativeTime, truncateText } from '@/lib/utils'

interface ReporteConAgente {
  id: number
  titulo: string
  descripcion: string | null
  fecha_publicacion: string
  ubicacion_geografica: string | null
  agente: { nombre: string; provincia: string | null } | null
}

interface ReportesCampoProps {
  reportes: ReporteConAgente[]
  loading?: boolean
  onReporteClick?: (id: number) => void
}

export function ReportesCampo({ reportes, loading, onReporteClick }: ReportesCampoProps) {
  if (loading) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
        <div className="p-4 border-b border-blue-200">
          <div className="h-6 bg-blue-200 rounded w-40 animate-pulse" />
        </div>
        <div className="p-4 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg p-3 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
      <div className="p-4 border-b border-blue-200 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <Radio className="w-5 h-5 text-blue-600" />
          Reportes de Campo
        </h2>
        <span className="text-sm text-blue-600 font-medium">{reportes.length}</span>
      </div>

      <div className="p-3 space-y-2 max-h-[500px] overflow-y-auto">
        {reportes.length === 0 ? (
          <div className="text-center py-6 text-gray-500 text-sm">
            No hay reportes de campo recientes
          </div>
        ) : (
          reportes.map((reporte) => (
            <div
              key={reporte.id}
              onClick={() => onReporteClick?.(reporte.id)}
              className="bg-white rounded-lg p-3 hover:shadow-md transition-all cursor-pointer group border border-transparent hover:border-blue-300"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700">
                  <CheckCircle className="w-3 h-3" />
                  Verificado
                </span>
                <span className="text-xs text-gray-500">
                  {formatRelativeTime(reporte.fecha_publicacion)}
                </span>
              </div>

              <h3 className="font-medium text-gray-900 text-sm mb-1 group-hover:text-blue-600 transition-colors line-clamp-2">
                {reporte.titulo}
              </h3>

              {reporte.descripcion && (
                <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                  {truncateText(reporte.descripcion, 80)}
                </p>
              )}

              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="font-medium text-gray-700">
                  {reporte.agente?.nombre || 'Agente'}
                </span>
                {reporte.ubicacion_geografica && (
                  <span className="flex items-center gap-0.5">
                    <MapPin className="w-3 h-3" />
                    {reporte.ubicacion_geografica}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
