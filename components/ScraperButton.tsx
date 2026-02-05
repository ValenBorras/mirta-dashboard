'use client'

import { useState } from 'react'
import { RefreshCw, Check, AlertCircle, X } from 'lucide-react'

interface ScraperResult {
  success: boolean
  message: string
  data?: {
    total_links_procesados: number
    nuevas_guardadas: number
    duplicadas_omitidas: number
    fuera_de_rango: number
    errores: number
    filtro_horas: number
    timestamp: string
  }
  error?: string
}

type ScraperStatus = 'idle' | 'running' | 'success' | 'error'

interface ScraperButtonProps {
  onComplete?: () => void
}

export function ScraperButton({ onComplete }: ScraperButtonProps) {
  const [status, setStatus] = useState<ScraperStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<ScraperResult | null>(null)
  const [showResult, setShowResult] = useState(false)

  const runScraper = async () => {
    if (status === 'running') return

    setStatus('running')
    setProgress(0)
    setResult(null)
    setShowResult(false)

    // Simular progreso mientras se ejecuta
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev
        return prev + Math.random() * 15
      })
    }, 500)

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 50 })
      })

      clearInterval(progressInterval)
      setProgress(100)

      const data: ScraperResult = await response.json()
      setResult(data)
      setStatus(data.success ? 'success' : 'error')
      setShowResult(true)

      if (data.success) {
        onComplete?.()
      }

      // Auto-cerrar después de 5 segundos
      setTimeout(() => {
        setShowResult(false)
        setTimeout(() => {
          setStatus('idle')
          setProgress(0)
        }, 300)
      }, 5000)

    } catch (error) {
      clearInterval(progressInterval)
      setProgress(100)
      setResult({
        success: false,
        message: 'Error de conexión',
        error: error instanceof Error ? error.message : 'Error desconocido'
      })
      setStatus('error')
      setShowResult(true)
    }
  }

  const getButtonContent = () => {
    switch (status) {
      case 'running':
        return (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="hidden sm:inline">Scrapeando...</span>
          </>
        )
      case 'success':
        return (
          <>
            <Check className="w-4 h-4" />
            <span className="hidden sm:inline">Completado</span>
          </>
        )
      case 'error':
        return (
          <>
            <AlertCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Error</span>
          </>
        )
      default:
        return (
          <>
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Scrapear Noticias</span>
          </>
        )
    }
  }

  const getButtonStyles = () => {
    const base = "relative flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all overflow-hidden"
    
    switch (status) {
      case 'running':
        return `${base} bg-blue-100 text-blue-700 cursor-wait`
      case 'success':
        return `${base} bg-green-100 text-green-700`
      case 'error':
        return `${base} bg-red-100 text-red-700`
      default:
        return `${base} bg-blue-600 text-white hover:bg-blue-700`
    }
  }

  return (
    <div className="relative">
      <button
        onClick={runScraper}
        disabled={status === 'running'}
        className={getButtonStyles()}
      >
        {/* Barra de progreso */}
        {status === 'running' && (
          <div 
            className="absolute inset-0 bg-blue-200 transition-all duration-300"
            style={{ 
              width: `${progress}%`,
              opacity: 0.5
            }}
          />
        )}
        
        <span className="relative z-10 flex items-center gap-2">
          {getButtonContent()}
        </span>
      </button>

      {/* Popup de resultado */}
      {showResult && result && (
        <div className={`absolute top-full right-0 mt-2 w-72 p-4 rounded-xl shadow-lg border z-50 ${
          result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-start justify-between mb-2">
            <div className={`flex items-center gap-2 font-medium ${
              result.success ? 'text-green-800' : 'text-red-800'
            }`}>
              {result.success ? (
                <Check className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
              {result.message}
            </div>
            <button 
              onClick={() => setShowResult(false)}
              className="p-1 hover:bg-white/50 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {result.success && result.data && (
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-green-700">
                <span>Nuevas guardadas:</span>
                <span className="font-semibold">{result.data.nuevas_guardadas}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Links procesados:</span>
                <span>{result.data.total_links_procesados}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Duplicadas omitidas:</span>
                <span>{result.data.duplicadas_omitidas}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Fuera de rango ({result.data.filtro_horas}h):</span>
                <span>{result.data.fuera_de_rango}</span>
              </div>
              {result.data.errores > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span>Errores:</span>
                  <span>{result.data.errores}</span>
                </div>
              )}
            </div>
          )}

          {!result.success && result.error && (
            <p className="text-sm text-red-700">{result.error}</p>
          )}
        </div>
      )}
    </div>
  )
}
