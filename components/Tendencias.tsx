'use client'

import { TrendingUp, Hash } from 'lucide-react'

interface Tendencia {
  palabra: string
  count: number
}

interface TendenciasProps {
  tendencias: Tendencia[]
  loading?: boolean
  onTendenciaClick?: (palabra: string) => void
}

export function Tendencias({ tendencias, loading, onTendenciaClick }: TendenciasProps) {
  const maxCount = tendencias.length > 0 ? Math.max(...tendencias.map(t => t.count)) : 1

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="h-6 bg-gray-200 rounded w-32 mb-4 animate-pulse" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-24 mb-1" />
              <div className="h-2 bg-gray-100 rounded w-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-green-600" />
        Tendencias del Día
      </h2>

      {tendencias.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">
          No hay tendencias disponibles
        </p>
      ) : (
        <div className="space-y-3">
          {tendencias.map((tendencia) => {
            const percentage = (tendencia.count / maxCount) * 100

            return (
              <button
                key={tendencia.palabra}
                onClick={() => onTendenciaClick?.(tendencia.palabra)}
                className="w-full text-left group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-gray-700 group-hover:text-blue-600 transition-colors">
                    <Hash className="w-3.5 h-3.5 text-gray-400" />
                    {tendencia.palabra}
                  </span>
                  <span className="text-xs text-gray-500">{tendencia.count}</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-500 group-hover:from-blue-500 group-hover:to-blue-700"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
