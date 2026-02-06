export interface Usuario {
  id: number
  nombre: string
  email: string
  password_hash: string
  cargo: string | null
  provincia: string | null
  activo: boolean
  created_at: string
}

export interface Noticiero {
  id: number
  nombre: string
  url_rss: string | null
  tipo: 'nacional' | 'provincial' | 'digital' | null
  fuente_base: string | null
  activo: boolean
  created_at: string
}

export interface AgenteCampo {
  id: number
  nombre: string
  telefono: string
  provincia: string | null
  ciudad: string | null
  activo: boolean
  created_at: string
}

export interface Noticia {
  id: number
  titulo: string
  descripcion: string | null
  autor: string | null
  fuente: string | null
  fecha_publicacion: string
  link: string | null
  cuerpo: string | null
  fuente_base: string | null
  extraido_en: string | null
  categoria: string | null
  urgencia: 'alta' | 'media' | 'baja'
  sentimiento: 'positivo' | 'neutral' | 'negativo' | null
  ubicacion_geografica: string | null
  nivel_geografico: 'internacional' | 'nacional' | 'provincial' | 'municipal' | null
  palabras_clave: string[] | null
  impacto_legislativo: string | null
  requiere_accion: boolean
  procesado_llm: boolean
  tipo_fuente: 'noticiero' | 'agente'
  noticiero_id: number | null
  agente_id: number | null
  created_at: string
}

// Noticia con datos de relaciones (para usar con joins de Supabase)
export interface NoticiaConRelaciones extends Omit<Noticia, 'noticiero_id' | 'agente_id'> {
  noticiero_id: number | null
  agente_id: number | null
  noticiero: { nombre: string; fuente_base: string | null } | null
  agente: { nombre: string; provincia: string | null } | null
}

export interface Database {
  public: {
    Tables: {
      usuario: {
        Row: Usuario
        Insert: Omit<Usuario, 'id' | 'created_at'>
        Update: Partial<Omit<Usuario, 'id'>>
      }
      noticiero: {
        Row: Noticiero
        Insert: Omit<Noticiero, 'id' | 'created_at'>
        Update: Partial<Omit<Noticiero, 'id'>>
      }
      agente_campo: {
        Row: AgenteCampo
        Insert: Omit<AgenteCampo, 'id' | 'created_at'>
        Update: Partial<Omit<AgenteCampo, 'id'>>
      }
      noticia: {
        Row: Noticia
        Insert: Omit<Noticia, 'id' | 'created_at'>
        Update: Partial<Omit<Noticia, 'id'>>
      }
    }
  }
}

export type Categoria = 
  | 'Economía' 
  | 'Seguridad' 
  | 'Salud' 
  | 'Educación' 
  | 'Infraestructura' 
  | 'Justicia' 
  | 'Medio Ambiente' 
  | 'Trabajo' 
  | 'Política Interna' 
  | 'Relaciones Internacionales' 
  | 'Tecnología' 
  | 'Cultura'

export const CATEGORIAS: Categoria[] = [
  'Economía',
  'Seguridad',
  'Salud',
  'Educación',
  'Infraestructura',
  'Justicia',
  'Medio Ambiente',
  'Trabajo',
  'Política Interna',
  'Relaciones Internacionales',
  'Tecnología',
  'Cultura'
]

export const URGENCIA_COLORS = {
  alta: '#DC2626',
  media: '#F59E0B',
  baja: '#10B981'
} as const

export const CATEGORIA_COLORS: Record<string, string> = {
  'Economía': '#3B82F6',
  'Seguridad': '#EF4444',
  'Salud': '#10B981',
  'Educación': '#8B5CF6',
  'Infraestructura': '#F59E0B',
  'Justicia': '#6366F1',
  'Medio Ambiente': '#22C55E',
  'Trabajo': '#EC4899',
  'Política Interna': '#14B8A6',
  'Relaciones Internacionales': '#0EA5E9',
  'Tecnología': '#A855F7',
  'Cultura': '#F97316'
}
