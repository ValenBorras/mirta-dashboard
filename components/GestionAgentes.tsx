'use client'

import { useState } from 'react'
import {
  Users,
  Plus,
  Search,
  Phone,
  MapPin,
  Calendar,
  FileText,
  MoreVertical,
  Edit2,
  Trash2,
  Power,
  X,
  Check,
  AlertCircle,
  TrendingUp,
  UserCheck,
  UserX,
  ChevronLeft
} from 'lucide-react'
import { useAgentes, type AgenteConStats, type CreateAgenteInput } from '@/hooks/useAgentes'
import { formatRelativeTime } from '@/lib/utils'

interface GestionAgentesProps {
  onClose?: () => void
}

const PROVINCIAS_ARGENTINA = [
  'Buenos Aires',
  'CABA',
  'Catamarca',
  'Chaco',
  'Chubut',
  'Córdoba',
  'Corrientes',
  'Entre Ríos',
  'Formosa',
  'Jujuy',
  'La Pampa',
  'La Rioja',
  'Mendoza',
  'Misiones',
  'Neuquén',
  'Río Negro',
  'Salta',
  'San Juan',
  'San Luis',
  'Santa Cruz',
  'Santa Fe',
  'Santiago del Estero',
  'Tierra del Fuego',
  'Tucumán'
]

export function GestionAgentes({ onClose }: GestionAgentesProps) {
  const {
    agentes,
    loading,
    error,
    estadisticas,
    createAgente,
    updateAgente,
    deleteAgente,
    toggleActivo,
    refetch
  } = useAgentes()

  const [searchQuery, setSearchQuery] = useState('')
  const [filterActivo, setFilterActivo] = useState<'all' | 'active' | 'inactive'>('all')
  const [showModal, setShowModal] = useState(false)
  const [editingAgente, setEditingAgente] = useState<AgenteConStats | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [openMenu, setOpenMenu] = useState<number | null>(null)

  // Filtrar agentes
  const filteredAgentes = agentes.filter(agente => {
    const matchesSearch = 
      agente.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agente.telefono.includes(searchQuery) ||
      agente.provincia?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agente.ciudad?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesFilter = 
      filterActivo === 'all' ||
      (filterActivo === 'active' && agente.activo) ||
      (filterActivo === 'inactive' && !agente.activo)

    return matchesSearch && matchesFilter
  })

  const handleCreate = () => {
    setEditingAgente(null)
    setShowModal(true)
    setActionError(null)
  }

  const handleEdit = (agente: AgenteConStats) => {
    setEditingAgente(agente)
    setShowModal(true)
    setActionError(null)
    setOpenMenu(null)
  }

  const handleDelete = async (id: number) => {
    setActionLoading(true)
    setActionError(null)
    try {
      await deleteAgente(id)
      setShowDeleteConfirm(null)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error al eliminar')
    } finally {
      setActionLoading(false)
    }
  }

  const handleToggleActivo = async (id: number, activo: boolean) => {
    setActionLoading(true)
    try {
      await toggleActivo(id, !activo)
    } catch {
      // Error ya manejado en el hook
    } finally {
      setActionLoading(false)
      setOpenMenu(null)
    }
  }

  const handleSave = async (data: CreateAgenteInput) => {
    setActionLoading(true)
    setActionError(null)
    try {
      if (editingAgente) {
        await updateAgente({ id: editingAgente.id, ...data })
      } else {
        await createAgente(data)
      }
      setShowModal(false)
      setEditingAgente(null)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Users className="w-7 h-7 text-blue-600" />
                  Gestión de Agentes de Campo
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  Administra los agentes que envían reportes vía WhatsApp
                </p>
              </div>
            </div>
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Plus className="w-5 h-5" />
              Nuevo Agente
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{estadisticas.total}</p>
                <p className="text-xs text-gray-500">Total Agentes</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <UserCheck className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{estadisticas.activos}</p>
                <p className="text-xs text-gray-500">Activos</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <UserX className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{estadisticas.inactivos}</p>
                <p className="text-xs text-gray-500">Inactivos</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FileText className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{estadisticas.totalNoticias}</p>
                <p className="text-xs text-gray-500">Reportes Totales</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{estadisticas.noticiasUltimoMes}</p>
                <p className="text-xs text-gray-500">Último Mes</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, teléfono, provincia..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setFilterActivo('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filterActivo === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterActivo('active')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filterActivo === 'active'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Activos
              </button>
              <button
                onClick={() => setFilterActivo('inactive')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filterActivo === 'inactive'
                    ? 'bg-gray-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Inactivos
              </button>
            </div>
          </div>
        </div>

        {/* Error global */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
            <button onClick={refetch} className="ml-auto text-sm font-medium underline">
              Reintentar
            </button>
          </div>
        )}

        {/* Agents Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8">
              <div className="animate-pulse space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-200 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-1/4" />
                      <div className="h-3 bg-gray-200 rounded w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : filteredAgentes.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">
                {searchQuery || filterActivo !== 'all' 
                  ? 'No se encontraron agentes' 
                  : 'No hay agentes registrados'}
              </h3>
              <p className="text-gray-500 mb-4">
                {searchQuery || filterActivo !== 'all'
                  ? 'Intenta con otros filtros de búsqueda'
                  : 'Comienza agregando el primer agente de campo'}
              </p>
              {!searchQuery && filterActivo === 'all' && (
                <button
                  onClick={handleCreate}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Agregar Agente
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Agente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contacto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ubicación
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reportes
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredAgentes.map((agente) => (
                    <tr key={agente.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${
                            agente.activo ? 'bg-blue-600' : 'bg-gray-400'
                          }`}>
                            {agente.nombre.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{agente.nombre}</p>
                            <p className="text-xs text-gray-500">
                              Desde {new Date(agente.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone className="w-4 h-4" />
                          {agente.telefono}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <MapPin className="w-4 h-4" />
                          <span>
                            {agente.ciudad && `${agente.ciudad}, `}
                            {agente.provincia || 'Sin ubicación'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-semibold text-gray-900">
                              {agente.stats?.totalNoticias || 0}
                            </span>
                            <span className="text-xs text-gray-500">total</span>
                          </div>
                          {agente.stats?.ultimaNoticia && (
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <Calendar className="w-3 h-3" />
                              Último: {formatRelativeTime(agente.stats.ultimaNoticia)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                          agente.activo
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            agente.activo ? 'bg-green-500' : 'bg-gray-400'
                          }`} />
                          {agente.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="relative">
                          <button
                            onClick={() => setOpenMenu(openMenu === agente.id ? null : agente.id)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <MoreVertical className="w-5 h-5 text-gray-500" />
                          </button>

                          {openMenu === agente.id && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                              <button
                                onClick={() => handleEdit(agente)}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <Edit2 className="w-4 h-4" />
                                Editar
                              </button>
                              <button
                                onClick={() => handleToggleActivo(agente.id, agente.activo)}
                                disabled={actionLoading}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <Power className="w-4 h-4" />
                                {agente.activo ? 'Desactivar' : 'Activar'}
                              </button>
                              <hr className="my-1" />
                              <button
                                onClick={() => {
                                  setShowDeleteConfirm(agente.id)
                                  setOpenMenu(null)
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                              >
                                <Trash2 className="w-4 h-4" />
                                Eliminar
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Stats footer */}
        <div className="mt-4 text-sm text-gray-500 text-center">
          Mostrando {filteredAgentes.length} de {agentes.length} agentes
        </div>
      </div>

      {/* Modal de crear/editar */}
      {showModal && (
        <AgenteModal
          agente={editingAgente}
          onSave={handleSave}
          onClose={() => {
            setShowModal(false)
            setEditingAgente(null)
            setActionError(null)
          }}
          loading={actionLoading}
          error={actionError}
        />
      )}

      {/* Modal de confirmación de eliminación */}
      {showDeleteConfirm !== null && (
        <DeleteConfirmModal
          agenteName={agentes.find(a => a.id === showDeleteConfirm)?.nombre || ''}
          onConfirm={() => handleDelete(showDeleteConfirm)}
          onCancel={() => setShowDeleteConfirm(null)}
          loading={actionLoading}
        />
      )}

      {/* Click outside handler for menu */}
      {openMenu !== null && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setOpenMenu(null)}
        />
      )}
    </div>
  )
}

// Modal de crear/editar agente
interface AgenteModalProps {
  agente: AgenteConStats | null
  onSave: (data: CreateAgenteInput) => void
  onClose: () => void
  loading: boolean
  error: string | null
}

function AgenteModal({ agente, onSave, onClose, loading, error }: AgenteModalProps) {
  const [formData, setFormData] = useState<CreateAgenteInput>({
    nombre: agente?.nombre || '',
    telefono: agente?.telefono || '',
    provincia: agente?.provincia || '',
    ciudad: agente?.ciudad || '',
    activo: agente?.activo ?? true
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {agente ? 'Editar Agente' : 'Nuevo Agente'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre *
            </label>
            <input
              type="text"
              required
              value={formData.nombre}
              onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
              placeholder="Nombre completo del agente"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Teléfono WhatsApp *
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="tel"
                required
                value={formData.telefono}
                onChange={(e) => setFormData(prev => ({ ...prev, telefono: e.target.value }))}
                placeholder="+54 9 11 1234-5678"
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Número con código de país para recibir mensajes de WhatsApp
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Provincia
              </label>
              <select
                value={formData.provincia || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, provincia: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Seleccionar...</option>
                {PROVINCIAS_ARGENTINA.map(prov => (
                  <option key={prov} value={prov}>{prov}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ciudad
              </label>
              <input
                type="text"
                value={formData.ciudad || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, ciudad: e.target.value }))}
                placeholder="Ciudad"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, activo: !prev.activo }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                formData.activo ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  formData.activo ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm text-gray-700">
              Agente {formData.activo ? 'activo' : 'inactivo'}
            </span>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  {agente ? 'Guardar Cambios' : 'Crear Agente'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Modal de confirmación de eliminación
interface DeleteConfirmModalProps {
  agenteName: string
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}

function DeleteConfirmModal({ agenteName, onConfirm, onCancel, loading }: DeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
          <AlertCircle className="w-6 h-6 text-red-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
          ¿Eliminar agente?
        </h3>
        <p className="text-gray-600 text-center mb-6">
          ¿Estás seguro de que deseas eliminar a <strong>{agenteName}</strong>? 
          {' '}Si tiene reportes asociados, será desactivado en lugar de eliminado.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            Eliminar
          </button>
        </div>
      </div>
    </div>
  )
}
