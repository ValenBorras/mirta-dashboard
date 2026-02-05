"use client"

import { useState } from 'react'
import { Cpu, Play, Check, AlertCircle, X } from 'lucide-react'

interface AIResultItem {
  id: number
  titulo: string
  status: 'success' | 'error'
  error?: string
}

interface AIResponse {
  message: string
  processed: number
  failed: number
  total: number
  results: AIResultItem[]
}

type AIStatus = 'idle' | 'running' | 'success' | 'error'

interface AIProcessButtonProps {
  onComplete?: () => void
}

export function AIProcessButton({ onComplete }: AIProcessButtonProps) {
  const [status, setStatus] = useState<AIStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [response, setResponse] = useState<AIResponse | null>(null)
  const [showPopup, setShowPopup] = useState(false)

  const runProcessing = async () => {
    if (status === 'running') return

    setStatus('running')
    setProgress(0)
    setResponse(null)
    setShowPopup(false)

    const interval = setInterval(() => {
      setProgress(p => (p >= 90 ? p : p + Math.random() * 12))
    }, 400)

    try {
      // No limit sent -> endpoint will process ALL pending noticias (procesado_llm = false)
      const res = await fetch('/api/process-news', {
        method: 'POST'
      })

      clearInterval(interval)
      setProgress(100)

      const data: AIResponse = await res.json()
      setResponse(data)
      setStatus(data.failed === 0 ? 'success' : 'error')
      setShowPopup(true)

      if (data.processed > 0) onComplete?.()

      setTimeout(() => {
        setShowPopup(false)
        setTimeout(() => {
          setStatus('idle')
          setProgress(0)
        }, 250)
      }, 5000)

    } catch {
      clearInterval(interval)
      setProgress(100)
      setStatus('error')
      setResponse({ message: 'Error de conexión', processed: 0, failed: 0, total: 0, results: [] })
      setShowPopup(true)
    }
  }

  const getContent = () => {
    switch (status) {
      case 'running':
        return (
          <>
            <Play className="w-4 h-4 animate-spin" />
            <span className="hidden sm:inline">Procesando IA...</span>
          </>
        )
      case 'success':
        return (
          <>
            <Check className="w-4 h-4" />
            <span className="hidden sm:inline">IA completada</span>
          </>
        )
      case 'error':
        return (
          <>
            <AlertCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Errores IA</span>
          </>
        )
      default:
        return (
          <>
            <Cpu className="w-4 h-4" />
            <span className="hidden sm:inline">Analizar con IA</span>
          </>
        )
    }
  }

  const getStyles = () => {
    const base = 'relative flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all overflow-hidden'
    switch (status) {
      case 'running':
        return `${base} bg-amber-100 text-amber-700 cursor-wait`
      case 'success':
        return `${base} bg-green-100 text-green-700`
      case 'error':
        return `${base} bg-red-100 text-red-700`
      default:
        return `${base} bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200`
    }
  }

  return (
    <div className="relative">
      <button onClick={runProcessing} disabled={status === 'running'} className={getStyles()}>
        {status === 'running' && (
          <div className="absolute inset-0 bg-amber-200 transition-all duration-300" style={{ width: `${progress}%`, opacity: 0.45 }} />
        )}

        <span className="relative z-10 flex items-center gap-2">{getContent()}</span>
      </button>

      {showPopup && response && (
        <div className={`absolute top-full right-0 mt-2 w-80 p-4 rounded-xl shadow-lg border z-50 ${status === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-start justify-between mb-2">
            <div className={`flex items-center gap-2 font-medium ${status === 'success' ? 'text-green-800' : 'text-red-800'}`}>
              {status === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              <span>{response.message}</span>
            </div>
            <button onClick={() => setShowPopup(false)} className="p-1 hover:bg-white/50 rounded"><X className="w-4 h-4" /></button>
          </div>

          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span>Procesadas:</span>
              <span className="font-semibold">{response.processed}</span>
            </div>
            <div className="flex justify-between">
              <span>Fallidas:</span>
              <span className="font-semibold">{response.failed}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Total intentadas:</span>
              <span>{response.total}</span>
            </div>

            {response.results && response.results.length > 0 && (
              <div className="mt-2 text-xs text-gray-700 max-h-36 overflow-auto">
                {response.results.slice(0, 6).map(r => (
                  <div key={r.id} className="flex justify-between mb-1">
                    <span className="truncate">{r.titulo}</span>
                    <span className={`ml-2 font-semibold ${r.status === 'success' ? 'text-green-700' : 'text-red-700'}`}>{r.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
