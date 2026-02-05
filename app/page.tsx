'use client'

import { useState, useMemo, useCallback } from 'react'
import { Header } from '@/components/Header'
import { KPICards } from '@/components/KPICards'
import { AlertasUrgentes } from '@/components/AlertasUrgentes'
import { NewsFeed } from '@/components/NewsFeed'
import { ReportesCampo } from '@/components/ReportesCampo'
import { Tendencias } from '@/components/Tendencias'
import { MencionesUsuario } from '@/components/MencionesUsuario'
import { NoticiaModal } from '@/components/NoticiaModal'
import { 
  useNoticias, 
  useNoticiasHoy, 
  useUsuario, 
  useMencionesUsuario,
  useTendencias 
} from '@/hooks/useNoticias'

export default function Dashboard() {
  const [filters, setFilters] = useState<{
    categoria?: string
    urgencia?: 'alta' | 'media' | 'baja'
    busqueda?: string
  }>({})
  const [selectedNoticiaId, setSelectedNoticiaId] = useState<number | null>(null)

  const { usuario } = useUsuario()
  const { stats, loading: loadingStats, refetch: refetchStats } = useNoticiasHoy()
  const { noticias, loading: loadingNoticias, refetch: refetchNoticias } = useNoticias(filters)
  const { tendencias, loading: loadingTendencias } = useTendencias()
  const { menciones, count: mencionesCount, loading: loadingMenciones } = useMencionesUsuario(
    usuario?.nombre || ''
  )

  // Noticias urgentes
  const noticiasUrgentes = useMemo(() => 
    noticias.filter(n => n.urgencia === 'alta'),
    [noticias]
  )

  // Reportes de campo
  const reportesCampo = useMemo(() => 
    noticias.filter(n => n.tipo_fuente === 'agente'),
    [noticias]
  )

  // Noticia seleccionada para el modal
  const selectedNoticia = useMemo(() => 
    noticias.find(n => n.id === selectedNoticiaId) || null,
    [noticias, selectedNoticiaId]
  )

  const handleSearch = useCallback((query: string) => {
    setFilters(prev => ({ ...prev, busqueda: query || undefined }))
  }, [])

  const handleFilterChange = useCallback((newFilters: { 
    categoria?: string
    urgencia?: string 
  }) => {
    setFilters(prev => ({
      ...prev,
      categoria: newFilters.categoria || undefined,
      urgencia: (newFilters.urgencia as 'alta' | 'media' | 'baja') || undefined
    }))
  }, [])

  const handleTendenciaClick = useCallback((palabra: string) => {
    setFilters(prev => ({ ...prev, busqueda: palabra }))
  }, [])

  const handleScraperComplete = useCallback(() => {
    refetchNoticias()
    refetchStats()
  }, [refetchNoticias, refetchStats])

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        usuario={usuario}
        onSearch={handleSearch}
        mencionesCount={mencionesCount}
        onRefresh={handleScraperComplete}
      />

      <main className="max-w-[1920px] mx-auto px-4 sm:px-6 py-6">
        {/* KPI Cards */}
        <section className="mb-6">
          <KPICards
            noticiasHoy={stats.hoy}
            noticiasAyer={stats.ayer}
            urgentes={stats.urgentes}
            porRevisar={0}
            reportesCampo={stats.reportesCampo}
            loading={loadingStats}
          />
        </section>

        {/* Alertas Urgentes */}
        <AlertasUrgentes
          noticias={noticiasUrgentes}
          loading={loadingNoticias}
          onNoticiaClick={setSelectedNoticiaId}
        />

        {/* Layout principal: 2 columnas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna izquierda: Feed principal */}
          <div className="lg:col-span-2">
            <NewsFeed
              noticias={noticias}
              loading={loadingNoticias}
              onNoticiaClick={setSelectedNoticiaId}
              onFilterChange={handleFilterChange}
            />
          </div>

          {/* Columna derecha: Reportes, Menciones y Tendencias */}
          <div className="space-y-6">
            {/* Menciones del usuario */}
            {mencionesCount > 0 && (
              <MencionesUsuario
                nombreUsuario={usuario?.nombre || ''}
                menciones={menciones}
                count={mencionesCount}
                loading={loadingMenciones}
                onNoticiaClick={setSelectedNoticiaId}
              />
            )}

            {/* Reportes de campo */}
            <ReportesCampo
              reportes={reportesCampo}
              loading={loadingNoticias}
              onReporteClick={setSelectedNoticiaId}
            />

            {/* Tendencias */}
            <Tendencias
              tendencias={tendencias}
              loading={loadingTendencias}
              onTendenciaClick={handleTendenciaClick}
            />
          </div>
        </div>
      </main>

      {/* Modal de noticia */}
      {selectedNoticia && (
        <NoticiaModal
          noticia={selectedNoticia}
          onClose={() => setSelectedNoticiaId(null)}
        />
      )}
    </div>
  )
}
