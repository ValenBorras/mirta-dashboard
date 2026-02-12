'use client'

import { useMemo } from 'react'
import { Hash, TrendingUp } from 'lucide-react'

interface PalabraConConteo {
  palabra: string
  count: number
}

interface NubePalabrasProps {
  palabras: PalabraConConteo[]
  loading?: boolean
  onPalabraClick?: (palabra: string) => void
}

export function NubePalabras({ palabras, loading, onPalabraClick }: NubePalabrasProps) {
  const maxCount = useMemo(() => {
    if (palabras.length === 0) return 1
    return Math.max(...palabras.map(p => p.count))
  }, [palabras])

  // Tomar los top 15 términos
  const topPalabras = useMemo(() => palabras.slice(0, 15), [palabras])

  // Dividir en columnas para que el orden sea vertical (por columnas)
  // Mobile: 1 col, Tablet: 2 cols, Desktop: 3 cols
  const columnas = useMemo(() => {
    const numCols = 3
    const porColumna = Math.ceil(topPalabras.length / numCols)
    const cols: { palabra: string; count: number; rank: number }[][] = []
    for (let c = 0; c < numCols; c++) {
      cols.push(
        topPalabras
          .slice(c * porColumna, (c + 1) * porColumna)
          .map((p, i) => ({ ...p, rank: c * porColumna + i + 1 }))
      )
    }
    return cols
  }, [topPalabras])

  if (loading) {
    return (
      <div className="mb-4 sm:mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-5 w-5 bg-gray-200 rounded animate-pulse" />
            <div className="h-5 bg-gray-200 rounded w-48 animate-pulse" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6">
            {[...Array(3)].map((_, col) => (
              <div key={col} className="space-y-2.5">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse flex items-center gap-2">
                    <div className="h-4 bg-gray-200 rounded w-4" />
                    <div className="h-4 bg-gray-200 rounded w-20" />
                    <div className="flex-1" />
                    <div className="h-1.5 bg-gray-100 rounded-full w-14" />
                    <div className="h-4 bg-gray-200 rounded w-5" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (topPalabras.length === 0) {
    return null
  }

  return (
    <div className="mb-4 sm:mb-6">
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-sm sm:text-base text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            Tendencias del Día
          </h2>
          <span className="text-xs text-gray-400">
            {topPalabras.length} términos principales
          </span>
        </div>

        {/* Columnas — orden vertical */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6">
          {columnas.map((col, colIdx) => (
            <div key={colIdx} className="space-y-0.5">
              {col.map((p) => {
                const percentage = (p.count / maxCount) * 100

                return (
                  <button
                    key={p.palabra}
                    onClick={() => onPalabraClick?.(p.palabra)}
                    className="group flex items-center gap-2 py-1.5 rounded-md hover:bg-gray-50 transition-colors text-left px-1.5 -mx-1.5 w-full"
                  >
                    {/* Ranking */}
                    <span className="text-[11px] font-medium text-gray-300 w-4 text-right shrink-0 tabular-nums">
                      {p.rank}
                    </span>

                    {/* Hash icon */}
                    <Hash className="w-3 h-3 text-gray-300 shrink-0" />

                    {/* Palabra */}
                    <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600 transition-colors truncate min-w-0">
                      {p.palabra}
                    </span>

                    {/* Barra de progreso + conteo */}
                    <div className="flex items-center gap-2 ml-auto shrink-0">
                      <div className="w-12 sm:w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-500 group-hover:bg-blue-600"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 tabular-nums w-5 text-right">
                        {p.count}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
