'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Usuario, NoticiaConRelaciones, Noticiero } from '@/types/database'

interface Filters {
  categoria?: string
  urgencia?: 'alta' | 'media' | 'baja'
  tipo_fuente?: 'noticiero' | 'agente'
  nivel_geografico?: 'internacional' | 'nacional' | 'provincial' | 'municipal'
  fecha_desde?: string
  fecha_hasta?: string
  busqueda?: string
  noticieros_ids?: number[]
  // Datos del usuario para filtrar provincial/municipal
  userProvincia?: string | null
  userCiudad?: string | null
}

export function useNoticias(filters: Filters = {}) {
  const [noticias, setNoticias] = useState<NoticiaConRelaciones[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchNoticias = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      let query = supabase
        .from('noticia')
        .select(`
          *,
          noticiero:noticiero_id(nombre),
          agente:agente_id(nombre, provincia)
        `)
        .eq('procesado_llm', true)
        .neq('urgencia', 'irrelevante')
        .order('fecha_publicacion', { ascending: false })

      if (filters.categoria) {
        query = query.eq('categoria', filters.categoria)
      }
      if (filters.urgencia) {
        query = query.eq('urgencia', filters.urgencia)
      }
      if (filters.tipo_fuente) {
        query = query.eq('tipo_fuente', filters.tipo_fuente)
      }
      if (filters.fecha_desde) {
        // Agregar hora inicio del día (00:00:00) para el filtro desde
        const fechaDesdeCompleta = `${filters.fecha_desde}T00:00:00.000Z`
        query = query.gte('fecha_publicacion', fechaDesdeCompleta)
      }
      if (filters.fecha_hasta) {
        // Agregar hora fin del día (23:59:59) para el filtro hasta
        const fechaHastaCompleta = `${filters.fecha_hasta}T23:59:59.999Z`
        query = query.lte('fecha_publicacion', fechaHastaCompleta)
      }
      if (filters.busqueda) {
        query = query.or(`titulo.ilike.%${filters.busqueda}%,descripcion.ilike.%${filters.busqueda}%`)
      }
      if (filters.noticieros_ids && filters.noticieros_ids.length > 0) {
        query = query.in('noticiero_id', filters.noticieros_ids)
      }

      // Filtros de nivel geográfico
      if (filters.nivel_geografico) {
        // Para provincial, filtrar por la provincia del usuario
        if (filters.nivel_geografico === 'provincial' && filters.userProvincia) {
          query = query.eq('nivel_geografico', 'provincial')
          query = query.eq('provincia', filters.userProvincia)
        }
        // Para municipal, incluir noticias municipales Y noticias provinciales que mencionan la ciudad
        else if (filters.nivel_geografico === 'municipal' && filters.userCiudad) {
          // Buscar noticias que:
          // 1. Sean de nivel municipal de la ciudad del usuario
          // 2. O sean de nivel provincial pero que mencionan específicamente la ciudad
          query = query.or(
            `and(nivel_geografico.eq.municipal,ciudad.eq.${filters.userCiudad}),and(nivel_geografico.eq.provincial,ciudad.eq.${filters.userCiudad})`
          )
          
          // Filtrar también por provincia si está disponible
          if (filters.userProvincia) {
            query = query.eq('provincia', filters.userProvincia)
          }
        }
        // Para otros niveles geográficos
        else {
          query = query.eq('nivel_geografico', filters.nivel_geografico)
        }
      }

      const { data, error: fetchError } = await query

      if (fetchError) throw fetchError
      setNoticias((data as NoticiaConRelaciones[]) || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar noticias')
    } finally {
      setLoading(false)
    }
  }, [filters.categoria, filters.urgencia, filters.tipo_fuente, filters.nivel_geografico, filters.fecha_desde, filters.fecha_hasta, filters.busqueda, filters.noticieros_ids, filters.userProvincia, filters.userCiudad])

  useEffect(() => {
    fetchNoticias()
  }, [fetchNoticias])

  return { noticias, loading, error, refetch: fetchNoticias }
}

export function useReportesCampo() {
  const [reportes, setReportes] = useState<NoticiaConRelaciones[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchReportes = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('noticia')
        .select(`
          *,
          noticiero:noticiero_id(nombre),
          agente:agente_id(nombre, provincia)
        `)
        .eq('tipo_fuente', 'agente')
        .neq('urgencia', 'irrelevante')
        .order('fecha_publicacion', { ascending: false })

      if (fetchError) throw fetchError
      setReportes((data as NoticiaConRelaciones[]) || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar reportes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReportes()
  }, [fetchReportes])

  return { reportes, loading, error, refetch: fetchReportes }
}

export function useNoticiasHoy() {
  const [stats, setStats] = useState({
    hoy: 0,
    ayer: 0,
    urgentes: 0,
    reportesCampo: 0
  })
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const ayer = new Date(hoy)
    ayer.setDate(ayer.getDate() - 1)

    try {
      const [hoyResult, ayerResult, urgentesResult, reportesResult] = await Promise.all([
        supabase
          .from('noticia')
          .select('id', { count: 'exact', head: true })
          .neq('urgencia', 'irrelevante')
          .gte('fecha_publicacion', hoy.toISOString()),
        supabase
          .from('noticia')
          .select('id', { count: 'exact', head: true })
          .neq('urgencia', 'irrelevante')
          .gte('fecha_publicacion', ayer.toISOString())
          .lt('fecha_publicacion', hoy.toISOString()),
        supabase
          .from('noticia')
          .select('id', { count: 'exact', head: true })
          .eq('urgencia', 'alta')
          .gte('fecha_publicacion', hoy.toISOString()),
        supabase
          .from('noticia')
          .select('id', { count: 'exact', head: true })
          .eq('tipo_fuente', 'agente')
          .neq('urgencia', 'irrelevante')
      ])

      setStats({
        hoy: hoyResult.count || 0,
        ayer: ayerResult.count || 0,
        urgentes: urgentesResult.count || 0,
        reportesCampo: reportesResult.count || 0
      })
    } catch (err) {
      console.error('Error fetching stats:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  return { stats, loading, refetch: fetchStats }
}

export function useUsuario() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // En un caso real, esto vendría de la autenticación
    // Por ahora usamos un usuario de ejemplo
    setUsuario({
      id: 1,
      nombre: 'María González',
      email: 'maria.gonzalez@legislatura.gob.ar',
      password_hash: '',
      cargo: 'Diputada Nacional',
      provincia: 'Buenos Aires',
      ciudad: 'La Plata',
      activo: true,
      created_at: new Date().toISOString()
    })
    setLoading(false)
  }, [])

  return { usuario, loading }
}

export function useMencionesUsuario(nombreUsuario: string) {
  const [menciones, setMenciones] = useState<NoticiaConRelaciones[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchMenciones() {
      if (!nombreUsuario) {
        setLoading(false)
        return
      }

      try {
        const { data, error, count: totalCount } = await supabase
          .from('noticia')
          .select(`
            *,
            noticiero:noticiero_id(nombre),
            agente:agente_id(nombre, provincia)
          `, { count: 'exact' })
          .or(`titulo.ilike.%${nombreUsuario}%,cuerpo.ilike.%${nombreUsuario}%,descripcion.ilike.%${nombreUsuario}%`)
          .neq('urgencia', 'irrelevante')
          .order('fecha_publicacion', { ascending: false })
          .limit(10)

        if (error) throw error
        setMenciones((data as NoticiaConRelaciones[]) || [])
        setCount(totalCount || 0)
      } catch (err) {
        console.error('Error fetching menciones:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchMenciones()
  }, [nombreUsuario])

  return { menciones, count, loading }
}

export function useTendencias() {
  const [tendencias, setTendencias] = useState<{ palabra: string; count: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchTendencias() {
      try {
        const hoy = new Date()
        hoy.setHours(0, 0, 0, 0)

        const { data, error } = await supabase
          .from('noticia')
          .select('palabras_clave, categoria')
          .neq('urgencia', 'irrelevante')
          .gte('fecha_publicacion', hoy.toISOString())

        if (error) throw error

        // Contar palabras clave
        const conteo: Record<string, number> = {}
        interface NoticiaData {
          palabras_clave: string[] | null
          categoria: string | null
        }
        (data as NoticiaData[] | null)?.forEach(noticia => {
          if (noticia.palabras_clave && Array.isArray(noticia.palabras_clave)) {
            noticia.palabras_clave.forEach((palabra: string) => {
              conteo[palabra] = (conteo[palabra] || 0) + 1
            })
          }
          if (noticia.categoria) {
            conteo[noticia.categoria] = (conteo[noticia.categoria] || 0) + 1
          }
        })

        const ordenado = Object.entries(conteo)
          .map(([palabra, count]) => ({ palabra, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)

        setTendencias(ordenado)
      } catch (err) {
        console.error('Error fetching tendencias:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchTendencias()
  }, [])

  return { tendencias, loading }
}

export function useNoticieros() {
  const [noticieros, setNoticieros] = useState<Noticiero[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchNoticieros() {
      try {
        const { data, error: fetchError } = await supabase
          .from('noticiero')
          .select('*')
          .eq('activo', true)
          .order('nombre', { ascending: true })

        if (fetchError) throw fetchError
        setNoticieros((data as Noticiero[]) || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar noticieros')
        console.error('Error fetching noticieros:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchNoticieros()
  }, [])

  return { noticieros, loading, error }
}
