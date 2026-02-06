'use client'

import { Newspaper, AlertTriangle, Clock, Radio, TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface KPICardsProps {
  noticiasHoy: number
  noticiasAyer: number
  urgentes: number
  porRevisar: number
  reportesCampo: number
  loading?: boolean
}

export function KPICards({ 
  noticiasHoy, 
  noticiasAyer, 
  urgentes, 
  porRevisar,
  reportesCampo,
  loading 
}: KPICardsProps) {
  const diff = noticiasHoy - noticiasAyer
  const diffPercent = noticiasAyer > 0 ? Math.round((diff / noticiasAyer) * 100) : 0

  const cards = [
    {
      title: 'Noticias de Hoy',
      value: noticiasHoy,
      icon: Newspaper,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
      trend: diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral',
      trendValue: `${diff > 0 ? '+' : ''}${diff} (${diffPercent}%)`
    },
    {
      title: 'Alertas Urgentes',
      value: urgentes,
      icon: AlertTriangle,
      color: 'bg-red-500',
      bgColor: 'bg-red-50',
      highlight: urgentes > 0
    },
    {
      title: 'Por Revisar',
      value: porRevisar,
      icon: Clock,
      color: 'bg-amber-500',
      bgColor: 'bg-amber-50'
    },
    {
      title: 'Reportes de Campo',
      value: reportesCampo,
      icon: Radio,
      color: 'bg-emerald-500',
      bgColor: 'bg-emerald-50'
    }
  ]

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-3 sm:p-4 border border-gray-200 animate-pulse">
            <div className="h-3 sm:h-4 bg-gray-200 rounded w-20 sm:w-24 mb-2 sm:mb-3" />
            <div className="h-6 sm:h-8 bg-gray-200 rounded w-12 sm:w-16" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
      {cards.map((card) => (
        <div 
          key={card.title}
          className={`bg-white rounded-xl p-3 sm:p-4 border border-gray-200 hover:shadow-md transition-shadow ${
            card.highlight ? 'ring-2 ring-red-500 ring-opacity-50' : ''
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-gray-500 font-medium truncate">{card.title}</p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-0.5 sm:mt-1">{card.value}</p>
              {card.trend && (
                <div className={`flex items-center gap-1 mt-0.5 sm:mt-1 text-xs ${
                  card.trend === 'up' ? 'text-green-600' : 
                  card.trend === 'down' ? 'text-red-600' : 'text-gray-500'
                }`}>
                  {card.trend === 'up' && <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />}
                  {card.trend === 'down' && <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4" />}
                  {card.trend === 'neutral' && <Minus className="w-3 h-3 sm:w-4 sm:h-4" />}
                  <span className="hidden sm:inline">{card.trendValue} vs ayer</span>
                  <span className="sm:hidden">{diff > 0 ? '+' : ''}{diff}</span>
                </div>
              )}
            </div>
            <div className={`p-1.5 sm:p-2 rounded-lg ${card.bgColor} flex-shrink-0 ml-2`}>
              <card.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${card.color.replace('bg-', 'text-')}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
