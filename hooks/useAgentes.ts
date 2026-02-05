'use client'

import { useState, useEffect, useCallback } from 'react'
import type { AgenteCampo } from '@/types/database'

export interface AgenteConStats extends AgenteCampo {
  stats?: {
    totalNoticias: number
    noticiasUltimoMes: number
    ultimaNoticia: string | null
  }
}

export interface CreateAgenteInput {
  nombre: string
  telefono: string
  provincia?: string
  ciudad?: string
  activo?: boolean
}

export interface UpdateAgenteInput extends Partial<CreateAgenteInput> {
  id: number
}

export function useAgentes(includeStats = true) {
  const [agentes, setAgentes] = useState<AgenteConStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAgentes = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (includeStats) params.append('stats', 'true')

      const response = await fetch(`/api/agentes?${params.toString()}`)
      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Error al cargar agentes')
      }

      setAgentes(result.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar agentes')
    } finally {
      setLoading(false)
    }
  }, [includeStats])

  useEffect(() => {
    fetchAgentes()
  }, [fetchAgentes])

  const createAgente = useCallback(async (input: CreateAgenteInput): Promise<AgenteConStats | null> => {
    try {
      const response = await fetch('/api/agentes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Error al crear agente')
      }

      // Refrescar la lista
      await fetchAgentes()
      return result.data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al crear agente'
      setError(message)
      throw err
    }
  }, [fetchAgentes])

  const updateAgente = useCallback(async (input: UpdateAgenteInput): Promise<AgenteConStats | null> => {
    try {
      const response = await fetch('/api/agentes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Error al actualizar agente')
      }

      // Refrescar la lista
      await fetchAgentes()
      return result.data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al actualizar agente'
      setError(message)
      throw err
    }
  }, [fetchAgentes])

  const deleteAgente = useCallback(async (id: number): Promise<boolean> => {
    try {
      const response = await fetch(`/api/agentes?id=${id}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Error al eliminar agente')
      }

      // Refrescar la lista
      await fetchAgentes()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al eliminar agente'
      setError(message)
      throw err
    }
  }, [fetchAgentes])

  const toggleActivo = useCallback(async (id: number, activo: boolean): Promise<boolean> => {
    try {
      await updateAgente({ id, activo })
      return true
    } catch {
      return false
    }
  }, [updateAgente])

  // Estadísticas agregadas
  const estadisticas = {
    total: agentes.length,
    activos: agentes.filter(a => a.activo).length,
    inactivos: agentes.filter(a => !a.activo).length,
    totalNoticias: agentes.reduce((sum, a) => sum + (a.stats?.totalNoticias || 0), 0),
    noticiasUltimoMes: agentes.reduce((sum, a) => sum + (a.stats?.noticiasUltimoMes || 0), 0)
  }

  return {
    agentes,
    loading,
    error,
    estadisticas,
    refetch: fetchAgentes,
    createAgente,
    updateAgente,
    deleteAgente,
    toggleActivo
  }
}
