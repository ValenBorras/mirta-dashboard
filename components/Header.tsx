'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { Search, Bell, Settings, Menu, User, Users, LogOut } from 'lucide-react'
// import { ScraperButton } from './ScraperButton'
// import { AIProcessButton } from './AIProcessButton'
import Image from 'next/image'

interface HeaderProps {
  onSearch: (query: string) => void
  mencionesCount: number
  onRefresh?: () => void
  onGestionAgentes?: () => void
}

export function Header({ onSearch, mencionesCount, onRefresh, onGestionAgentes }: HeaderProps) {
  const { data: session } = useSession()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [searchQuery, setSearchQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch(searchQuery)
  }

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo y título */}
          <div className="flex items-center gap-3">
            <button 
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <Menu className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex items-center gap-2">
              <Image
                src="/LogoMIRTA.png"
                alt="MIRTA Logo"
                width={36}
                height={36}
                className="rounded-lg"
              />
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-gray-900">MIRTA</h1>
                <p className="text-[10px] text-gray-500 -mt-1 leading-tight">
                  Monitoreo Integral de Relevamiento
                </p>
              </div>
            </div>
          </div>

          {/* Reloj y fecha */}
          <div className="hidden md:flex flex-col items-center">
            <span className="text-2xl font-semibold text-gray-900 tabular-nums">
              {currentTime.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="text-xs text-gray-500">
              {currentTime.toLocaleDateString('es-AR', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long',
                year: 'numeric'
              })}
            </span>
          </div>

          {/* Búsqueda */}
          <form onSubmit={handleSearch} className="hidden sm:flex flex-1 max-w-md mx-4">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar noticias..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </form>

          {/* Usuario y acciones */}
          <div className="flex items-center gap-2">
            {/* Botones: Scraper, Procesamiento IA y Gestión Agentes */}
            <div className="flex items-center gap-2">
              {/* <ScraperButton onComplete={onRefresh} /> */}
              {/* <AIProcessButton onComplete={onRefresh} /> */}
              {onGestionAgentes && (
                <button
                  onClick={onGestionAgentes}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors text-sm font-medium"
                  title="Gestionar Agentes de Campo"
                >
                  <Users className="w-4 h-4" />
                  <span className="hidden lg:inline">Agentes</span>
                </button>
              )}
            </div>

            {mencionesCount > 0 && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                <User className="w-4 h-4" />
                <span>{mencionesCount} menciones</span>
              </div>
            )}
            
            <button className="relative p-2 hover:bg-gray-100 rounded-lg">
              <Bell className="w-5 h-5 text-gray-600" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            
            <button className="p-2 hover:bg-gray-100 rounded-lg">
              <Settings className="w-5 h-5 text-gray-600" />
            </button>

            <div className="hidden sm:flex items-center gap-2 ml-2 pl-4 border-l border-gray-200 relative">
              <button 
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 hover:bg-gray-100 rounded-lg p-1 transition-colors"
              >
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-blue-600" />
                </div>
                <div className="hidden lg:block text-left">
                  <p className="text-sm font-medium text-gray-900">
                    {session?.user?.name || 'Usuario'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {session?.user?.cargo || 'Legislador'}
                  </p>
                </div>
              </button>
              
              {/* Dropdown menu */}
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">{session?.user?.name}</p>
                    <p className="text-xs text-gray-500">{session?.user?.email}</p>
                  </div>
                  <button
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
