# Code Implementation Guide: Global State + Quotation Module

**For:** Week 1-2 Implementation | **Audience:** Frontend Developers  
**Focus:** Creating production-ready code for global state management and Quotation workflow

---

## PART 1: GLOBAL WORKFLOW STATE (Zustand)

### File: `src/store/types.ts`

```typescript
// Type definitions for workflow state

export enum UserRole {
  SALES = 'SALES',
  PURCHASE = 'PURCHASE',
  ADMIN = 'ADMIN'
}

export enum QuotationStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  ACCEPTED = 'ACCEPTED',
  WON = 'WON',
  LOST = 'LOST',
  LAPSED = 'LAPSED'
}

export enum IndentStatus {
  DRAFT = 'DRAFT',
  FINALIZED = 'FINALIZED',
  APPROVED = 'APPROVED',
  PO_CREATED = 'PO_CREATED',
  PARTIAL_PO = 'PARTIAL_PO',
  CLOSED = 'CLOSED'
}

export enum POStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  CONFIRMED = 'CONFIRMED',
  EXECUTED = 'EXECUTED',
  CLOSED = 'CLOSED'
}

export enum EntityType {
  QUOTATION = 'quotation',
  INDENT = 'indent',
  PO = 'po',
  GRN = 'grn'
}

export interface Notification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  message: string
  action?: {
    label: string
    onClick: () => void
  }
  dismissible?: boolean
  timestamp: Date
}

export interface NavigationHistoryItem {
  entityType: EntityType
  entityId: string
  label: string
  timestamp: Date
  filters?: Record<string, any>
}

export interface CurrentEntity {
  type: EntityType
  id: string
  status: string
  data: any
  lastUpdated: Date
}

export interface RelatedEntities {
  quotations?: any[]
  indents?: any[]
  purchaseOrders?: any[]
  grns?: any[]
}

export interface Permission {
  resource: string // 'quotations', 'indents', 'pos', 'grns', 'vendors'
  action: 'read' | 'create' | 'edit' | 'delete' | 'approve'
}

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  permissions: Permission[]
}

export interface WorkflowState {
  // User & Authentication
  user: User | null
  userRole: UserRole | null
  permissions: Permission[]

  // Current Entity Context
  currentEntity: CurrentEntity | null
  unsavedChanges: Record<string, any>
  isDirty: boolean

  // Navigation Context
  navigationHistory: NavigationHistoryItem[]
  currentHistoryIndex: number

  // Related Entities (cache)
  relatedEntities: RelatedEntities
  relatedEntitiesLoading: boolean

  // Notifications
  notifications: Notification[]

  // Global Filters
  globalFilters: {
    dateRange?: { from: Date; to: Date }
    status?: string[]
    assignee?: string
    vendor?: string
    searchQuery?: string
  }

  // UI State
  sidebarOpen: boolean
  mobileMenuOpen: boolean

  // Metadata
  lastSync: Date
  isOnline: boolean
}

export interface WorkflowActions {
  // Entity Management
  setCurrentEntity: (entity: CurrentEntity) => void
  updateUnsavedChanges: (changes: Record<string, any>) => void
  discardChanges: () => void
  clearCurrentEntity: () => void

  // Navigation
  navigateTo: (
    entityType: EntityType,
    entityId: string,
    label: string,
    filters?: Record<string, any>
  ) => void
  goBack: () => void
  goForward: () => void
  clearNavigationHistory: () => void

  // Authentication
  setUser: (user: User) => void
  setUserRole: (role: UserRole) => void
  clearUser: () => void

  // Related Entities
  setRelatedEntities: (entities: RelatedEntities) => void
  setRelatedEntitiesLoading: (loading: boolean) => void

  // Notifications
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void
  removeNotification: (id: string) => void
  clearNotifications: () => void

  // Filters
  setGlobalFilters: (filters: Partial<WorkflowState['globalFilters']>) => void
  clearGlobalFilters: () => void

  // UI
  setSidebarOpen: (open: boolean) => void
  setMobileMenuOpen: (open: boolean) => void

  // Metadata
  setLastSync: () => void
  setIsOnline: (online: boolean) => void
}
```

### File: `src/store/workflowStore.ts`

```typescript
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import {
  WorkflowState,
  WorkflowActions,
  CurrentEntity,
  EntityType,
  Notification,
  NavigationHistoryItem,
  User,
  Permission
} from './types'

const INITIAL_STATE: WorkflowState = {
  user: null,
  userRole: null,
  permissions: [],
  currentEntity: null,
  unsavedChanges: {},
  isDirty: false,
  navigationHistory: [],
  currentHistoryIndex: -1,
  relatedEntities: {},
  relatedEntitiesLoading: false,
  notifications: [],
  globalFilters: {},
  sidebarOpen: true,
  mobileMenuOpen: false,
  lastSync: new Date(),
  isOnline: true
}

export const useWorkflowStore = create<WorkflowState & WorkflowActions>()(
  devtools(
    persist(
      (set, get) => ({
        ...INITIAL_STATE,

        // Entity Management
        setCurrentEntity: (entity: CurrentEntity) => {
          set((state) => ({
            currentEntity: entity,
            isDirty: false,
            unsavedChanges: {}
          }))
        },

        updateUnsavedChanges: (changes: Record<string, any>) => {
          set((state) => ({
            unsavedChanges: {
              ...state.unsavedChanges,
              ...changes
            },
            isDirty: true
          }))
        },

        discardChanges: () => {
          set({
            unsavedChanges: {},
            isDirty: false
          })
        },

        clearCurrentEntity: () => {
          set({
            currentEntity: null,
            unsavedChanges: {},
            isDirty: false
          })
        },

        // Navigation
        navigateTo: (
          entityType: EntityType,
          entityId: string,
          label: string,
          filters?: Record<string, any>
        ) => {
          set((state) => {
            const newHistory = [
              ...state.navigationHistory.slice(0, state.currentHistoryIndex + 1),
              {
                entityType,
                entityId,
                label,
                timestamp: new Date(),
                filters
              }
            ]

            // Keep only last 20 items in history
            if (newHistory.length > 20) {
              newHistory.shift()
            }

            return {
              navigationHistory: newHistory,
              currentHistoryIndex: newHistory.length - 1
            }
          })
        },

        goBack: () => {
          set((state) => {
            if (state.currentHistoryIndex > 0) {
              return {
                currentHistoryIndex: state.currentHistoryIndex - 1
              }
            }
            return state
          })
        },

        goForward: () => {
          set((state) => {
            if (state.currentHistoryIndex < state.navigationHistory.length - 1) {
              return {
                currentHistoryIndex: state.currentHistoryIndex + 1
              }
            }
            return state
          })
        },

        clearNavigationHistory: () => {
          set({
            navigationHistory: [],
            currentHistoryIndex: -1
          })
        },

        // Authentication
        setUser: (user: User) => {
          set({
            user,
            userRole: user.role,
            permissions: user.permissions
          })
        },

        setUserRole: (role) => {
          set({ userRole: role })
        },

        clearUser: () => {
          set({
            user: null,
            userRole: null,
            permissions: [],
            currentEntity: null,
            navigationHistory: [],
            currentHistoryIndex: -1
          })
        },

        // Related Entities
        setRelatedEntities: (entities) => {
          set({
            relatedEntities: entities,
            relatedEntitiesLoading: false
          })
        },

        setRelatedEntitiesLoading: (loading) => {
          set({ relatedEntitiesLoading: loading })
        },

        // Notifications
        addNotification: (notification) => {
          const id = `${Date.now()}-${Math.random()}`
          const fullNotification: Notification = {
            ...notification,
            id,
            timestamp: new Date()
          }

          set((state) => ({
            notifications: [fullNotification, ...state.notifications]
          }))

          // Auto-dismiss after 5 seconds (if dismissible)
          if (notification.dismissible !== false) {
            setTimeout(() => {
              get().removeNotification(id)
            }, 5000)
          }

          return id
        },

        removeNotification: (id) => {
          set((state) => ({
            notifications: state.notifications.filter((n) => n.id !== id)
          }))
        },

        clearNotifications: () => {
          set({ notifications: [] })
        },

        // Filters
        setGlobalFilters: (filters) => {
          set((state) => ({
            globalFilters: {
              ...state.globalFilters,
              ...filters
            }
          }))
        },

        clearGlobalFilters: () => {
          set({ globalFilters: {} })
        },

        // UI
        setSidebarOpen: (open) => {
          set({ sidebarOpen: open })
        },

        setMobileMenuOpen: (open) => {
          set({ mobileMenuOpen: open })
        },

        // Metadata
        setLastSync: () => {
          set({ lastSync: new Date() })
        },

        setIsOnline: (online) => {
          set({ isOnline: online })
        }
      }),
      {
        name: 'workflow-store',
        partialize: (state) => ({
          // Only persist these fields
          navigationHistory: state.navigationHistory,
          currentHistoryIndex: state.currentHistoryIndex,
          sidebarOpen: state.sidebarOpen,
          globalFilters: state.globalFilters
        })
      }
    ),
    { name: 'WorkflowStore' }
  )
)
```

### File: `src/store/hooks.ts`

```typescript
import { useShallow } from 'zustand/react/shallow'
import { useWorkflowStore } from './workflowStore'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api'

// Hook to use entire workflow store (shallow comparison for performance)
export const useWorkflow = () => {
  return useWorkflowStore(useShallow((state) => state))
}

// Hook for current entity with loading state
export const useCurrentEntity = () => {
  const { currentEntity, relatedEntitiesLoading } = useWorkflowStore()

  return {
    entity: currentEntity,
    isLoading: relatedEntitiesLoading
  }
}

// Hook for navigation
export const useNavigation = () => {
  return useWorkflowStore(
    useShallow((state) => ({
      history: state.navigationHistory,
      currentIndex: state.currentHistoryIndex,
      navigateTo: state.navigateTo,
      goBack: state.goBack,
      goForward: state.goForward,
      canGoBack: state.currentHistoryIndex > 0,
      canGoForward: state.currentHistoryIndex < state.navigationHistory.length - 1,
      currentPage: state.navigationHistory[state.currentHistoryIndex]
    }))
  )
}

// Hook for user role and permissions
export const useUserRole = () => {
  return useWorkflowStore(
    useShallow((state) => ({
      role: state.userRole,
      permissions: state.permissions,
      can: (resource: string, action: string) => {
        return state.permissions.some(
          (p) => p.resource === resource && p.action === action
        )
      }
    }))
  )
}

// Hook for notifications
export const useNotifications = () => {
  return useWorkflowStore(
    useShallow((state) => ({
      notifications: state.notifications,
      addNotification: state.addNotification,
      removeNotification: state.removeNotification,
      clearNotifications: state.clearNotifications
    }))
  )
}

// Hook for unsaved changes
export const useUnsavedChanges = () => {
  return useWorkflowStore(
    useShallow((state) => ({
      unsavedChanges: state.unsavedChanges,
      isDirty: state.isDirty,
      updateChanges: state.updateUnsavedChanges,
      discardChanges: state.discardChanges
    }))
  )
}

// Patterns for common operations

/**
 * Load an entity detail and set as current
 * Fetches related entities automatically
 */
export const useEntityDetail = (
  entityType: 'quotation' | 'indent' | 'po' | 'grn',
  entityId: string
) => {
  const { setCurrentEntity, setRelatedEntities, setRelatedEntitiesLoading } =
    useWorkflowStore()
  const queryClient = useQueryClient()

  // Query for main entity
  const entityQuery = useQuery({
    queryKey: [entityType, entityId],
    queryFn: () => {
      switch (entityType) {
        case 'quotation':
          return api.quotations.getDetail(entityId)
        case 'indent':
          return api.indents.getDetail(entityId)
        case 'po':
          return api.purchaseOrders.getDetail(entityId)
        case 'grn':
          return api.grn.getDetail(entityId)
      }
    }
  })

  // Fetch related entities
  const relatedQuery = useQuery({
    queryKey: [entityType, entityId, 'related'],
    queryFn: async () => {
      setRelatedEntitiesLoading(true)
      try {
        const related = await api.entities.getRelated(entityType, entityId)
        setRelatedEntities(related)
        return related
      } finally {
        setRelatedEntitiesLoading(false)
      }
    },
    enabled: !!entityQuery.data
  })

  // Update current entity when data loads
  useEffect(() => {
    if (entityQuery.data) {
      setCurrentEntity({
        type: entityType,
        id: entityId,
        status: entityQuery.data.status,
        data: entityQuery.data,
        lastUpdated: new Date()
      })
    }
  }, [entityQuery.data, entityType, entityId, setCurrentEntity])

  return {
    entity: entityQuery.data,
    isLoading: entityQuery.isLoading,
    isError: entityQuery.isError,
    relatedEntities: relatedQuery.data,
    relatedIsLoading: relatedQuery.isLoading,
    refetch: entityQuery.refetch
  }
}

/**
 * Save entity and update store optimistically
 */
export const useSaveEntity = () => {
  const { unsavedChanges, discardChanges, addNotification } = useWorkflowStore()
  const queryClient = useQueryClient()

  const saveQuotationMutation = useMutation({
    mutationFn: (data: { id: string; changes: Record<string, any> }) =>
      api.quotations.update(data.id, data.changes),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['quotation'] })
      discardChanges()
      addNotification({
        type: 'success',
        message: 'Changes saved successfully'
      })
    },
    onError: (error) => {
      addNotification({
        type: 'error',
        message: `Save failed: ${error.message}`
      })
    }
  })

  return { saveQuotation: saveQuotationMutation.mutate }
}
```

---

## PART 2: QUOTATION TYPES

### File: `src/types/quotation.ts`

```typescript
import { QuotationStatus } from '@/store/types'

export interface QuotationItem {
  id?: string
  name: string
  description: string
  quantity: number
  unitPrice: number
  discount?: number // percentage
  total: number
  hsn?: string
  taxRate?: number
}

export interface Quotation {
  id: string
  status: QuotationStatus
  customerId: string
  customerName: string
  customerEmail: string
  items: QuotationItem[]
  totalAmount: number
  taxAmount: number
  discountAmount?: number
  grandTotal: number
  validUntilDate: string
  notes?: string
  terms?: string
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
  sentAt?: string
  sentBy?: string
  acceptedAt?: string
  acceptedBy?: string
  wonAt?: string
  wonBy?: string
  isImmutable: boolean
  versionNumber: number
  linkedIndentCount: number
  linkedIndentIds: string[]
}

export interface QuotationFilters {
  status?: QuotationStatus[]
  customerName?: string
  dateRange?: { from: string; to: string }
  owner?: string
  minAmount?: number
  maxAmount?: number
  searchQuery?: string
}

export interface CreateQuotationInput {
  customerId: string
  items: Omit<QuotationItem, 'id' | 'total'>[]
  validUntilDate: string
  notes?: string
  terms?: string
}

export interface QuotationResponse {
  success: boolean
  data: Quotation
  relatedEntities?: {
    indents: any[]
  }
}

export interface QuotationListResponse {
  success: boolean
  data: Quotation[]
  metadata: {
    totalRecords: number
    page: number
    pageSize: number
  }
}
```

---

## PART 3: QUOTATION API HOOKS

### File: `src/api/quotations.ts`

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'
import {
  Quotation,
  CreateQuotationInput,
  QuotationFilters,
  QuotationResponse,
  QuotationListResponse
} from '@/types/quotation'

const QUERY_KEYS = {
  all: ['quotations'] as const,
  lists: () => [...QUERY_KEYS.all, 'list'] as const,
  list: (filters: QuotationFilters) => [...QUERY_KEYS.lists(), filters] as const,
  details: () => [...QUERY_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...QUERY_KEYS.details(), id] as const
}

/**
 * Fetch list of quotations with filters
 */
export const useQuotationsList = (filters?: QuotationFilters) => {
  return useQuery({
    queryKey: QUERY_KEYS.list(filters || {}),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters?.status) {
        params.append('status', filters.status.join(','))
      }
      if (filters?.customerName) {
        params.append('customerName', filters.customerName)
      }
      if (filters?.dateRange) {
        params.append('fromDate', filters.dateRange.from)
        params.append('toDate', filters.dateRange.to)
      }
      if (filters?.owner) {
        params.append('owner', filters.owner)
      }
      if (filters?.searchQuery) {
        params.append('q', filters.searchQuery)
      }

      const response = await apiClient.get(`/quotations?${params}`)
      return response.data as QuotationListResponse
    }
  })
}

/**
 * Fetch single quotation with related entities
 */
export const useQuotationDetail = (quotationId: string) => {
  return useQuery({
    queryKey: QUERY_KEYS.detail(quotationId),
    queryFn: async () => {
      const response = await apiClient.get(`/quotations/${quotationId}`)
      return response.data as QuotationResponse
    },
    enabled: !!quotationId
  })
}

/**
 * Create new quotation
 */
export const useCreateQuotation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateQuotationInput) => {
      const response = await apiClient.post('/quotations', input)
      return response.data as QuotationResponse
    },
    onSuccess: () => {
      // Invalidate all quotation lists
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.lists() })
    }
  })
}

/**
 * Update draft quotation
 */
export const useUpdateQuotation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: { id: string; input: Partial<Quotation> }) => {
      const response = await apiClient.patch(
        `/quotations/${data.id}`,
        data.input
      )
      return response.data as QuotationResponse
    },
    onSuccess: (data) => {
      // Update specific quotation detail
      queryClient.setQueryData(QUERY_KEYS.detail(data.data.id), { data: data.data })
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.lists() })
    }
  })
}

/**
 * Send quotation to customer
 */
export const useSendQuotation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (quotationId: string) => {
      const response = await apiClient.post(`/quotations/${quotationId}/send`)
      return response.data as QuotationResponse
    },
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEYS.detail(data.data.id), { data: data.data })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.lists() })
    }
  })
}

/**
 * Accept quotation (mark WON)
 */
export const useAcceptQuotation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (quotationId: string) => {
      const response = await apiClient.post(`/quotations/${quotationId}/accept`)
      return response.data as QuotationResponse
    },
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEYS.detail(data.data.id), { data: data.data })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.lists() })
    }
  })
}

/**
 * Discard draft quotation
 */
export const useDiscardQuotation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (quotationId: string) => {
      await apiClient.delete(`/quotations/${quotationId}/draft`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.lists() })
    }
  })
}
```

---

## PART 4: QUOTATION LIST PAGE

### File: `src/pages/Quotations.tsx`

```typescript
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FileText, ArrowUpRight, Filter } from 'lucide-react'
import { useQuotationsList, useCreateQuotation } from '@/api/quotations'
import { useWorkflowStore } from '@/store/workflowStore'
import { QuotationStatus } from '@/store/types'
import Header from '@/components/common/Header'
import Button from '@/components/common/Button'
import DataGrid from '@/components/DataGrid'
import CreateQuotationModal from '@/components/modals/CreateQuotationModal'
import SuggestionBar from '@/components/common/SuggestionBar'
import StatusBadge from '@/components/common/StatusBadge'
import { formatCurrency, formatDate } from '@/utils'

export default function Quotations() {
  const navigate = useNavigate()
  const { setCurrentEntity, navigateTo, addNotification } = useWorkflowStore()

  // Local state
  const [filters, setFilters] = useState<{
    status?: QuotationStatus[]
    customerName?: string
    searchQuery?: string
  }>({})
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  // Data fetching
  const { data, isLoading, error, refetch } = useQuotationsList(filters)
  const createMutation = useCreateQuotation()

  // Handlers
  const handleRowClick = (quotation: any) => {
    navigateTo('quotation', quotation.id, quotation.id)
    navigate(`/quotations/${quotation.id}`)
  }

  const handleCreateSuccess = (newQuotation: any) => {
    setIsCreateModalOpen(false)
    addNotification({
      type: 'success',
      message: 'Quotation created successfully'
    })
    refetch()
    // Auto-open detail page
    handleRowClick(newQuotation)
  }

  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters)
  }

  // Columns configuration
  const columns = [
    {
      key: 'id',
      label: 'Quote ID',
      width: '120px',
      render: (value: string) => (
        <span className="font-mono text-sm font-semibold">{value}</span>
      )
    },
    {
      key: 'customerName',
      label: 'Customer',
      width: 'auto'
    },
    {
      key: 'grandTotal',
      label: 'Amount',
      width: '140px',
      render: (value: number) => (
        <span className="font-semibold">{formatCurrency(value)}</span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      width: '140px',
      render: (value: QuotationStatus) => (
        <StatusBadge status={value} workflowType="quotation" />
      )
    },
    {
      key: 'createdAt',
      label: 'Created',
      width: '140px',
      render: (value: string) => formatDate(value)
    },
    {
      key: 'validUntilDate',
      label: 'Valid Until',
      width: '140px',
      render: (value: string) => {
        const daysLeft = Math.ceil(
          (new Date(value).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
        return (
          <span className={daysLeft < 3 ? 'text-red-600 font-semibold' : ''}>
            {formatDate(value)} ({daysLeft}d)
          </span>
        )
      }
    }
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      <Header
        title="Quotations"
        breadcrumb={['Dashboard', 'Quotations']}
        action={
          <Button
            className="gap-2"
            onClick={() => setIsCreateModalOpen(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            New Quotation
          </Button>
        }
      />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Suggestion Bar */}
        <SuggestionBar
          status="list"
          suggestion="📧 Create quotations for customers or search existing ones. WON quotes can be converted to indents."
        />

        {/* Filters */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center gap-4">
            <Filter className="w-5 h-5 text-slate-500" />
            <input
              type="text"
              placeholder="Search by customer name, quote ID..."
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.searchQuery || ''}
              onChange={(e) =>
                handleFilterChange({ ...filters, searchQuery: e.target.value })
              }
            />
            <div className="flex gap-2">
              {['DRAFT', 'SENT', 'WON', 'LOST'].map((status) => (
                <button
                  key={status}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    filters.status?.includes(status as QuotationStatus)
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                  onClick={() => {
                    const newStatus = filters.status?.includes(
                      status as QuotationStatus
                    )
                      ? filters.status.filter((s) => s !== status)
                      : [...(filters.status || []), status as QuotationStatus]

                    handleFilterChange({
                      ...filters,
                      status: newStatus.length > 0 ? newStatus : undefined
                    })
                  }}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Data Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            Failed to load quotations. Please try again.
          </div>
        ) : data?.data.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              No quotations yet
            </h3>
            <p className="text-slate-600 mb-6">
              Create your first quotation to get started
            </p>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              Create Quotation
            </Button>
          </div>
        ) : (
          <DataGrid
            columns={columns}
            data={data?.data || []}
            onRowClick={handleRowClick}
            rowActions={(quotation) => [
              {
                label: 'View Details',
                onClick: () => handleRowClick(quotation),
                icon: <ArrowUpRight className="w-4 h-4" />
              }
            ]}
          />
        )}

        {/* Pagination */}
        {data?.metadata && (
          <div className="flex items-center justify-between text-sm text-slate-600">
            <span>
              Showing {data.data.length} of {data.metadata.totalRecords} quotations
            </span>
            {/* Add pagination controls if needed */}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <CreateQuotationModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  )
}
```

---

## PART 5: QUOTATION DETAIL PAGE (SKELETON)

### File: `src/pages/QuotationDetail.tsx`

```typescript
import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { useQuotationDetail, useSendQuotation, useAcceptQuotation } from '@/api/quotations'
import { useEntityDetail } from '@/store/hooks'
import { useWorkflowStore } from '@/store/workflowStore'
import { EntityType } from '@/store/types'
import Header from '@/components/common/Header'
import Button from '@/components/common/Button'
import StatusBadge from '@/components/common/StatusBadge'
import SuggestionBar from '@/components/common/SuggestionBar'
import Tabs from '@/components/common/Tabs'
import RelatedEntitiesPanel from '@/components/RelatedEntitiesPanel'
import WorkflowTimeline from '@/components/WorkflowTimeline'

export default function QuotationDetail() {
  const { id: quotationId } = useParams()
  const navigate = useNavigate()
  const { setCurrentEntity, navigateTo } = useWorkflowStore()

  if (!quotationId) {
    return <div>Invalid quotation ID</div>
  }

  // Fetch quotation
  const { data: response, isLoading, error, refetch } = useQuotationDetail(quotationId)
  const quotation = response?.data

  // Mutations
  const sendMutation = useSendQuotation()
  const acceptMutation = useAcceptQuotation()

  // Update global state when loaded
  useEffect(() => {
    if (quotation) {
      setCurrentEntity({
        type: 'quotation',
        id: quotationId,
        status: quotation.status,
        data: quotation,
        lastUpdated: new Date()
      })
      navigateTo(EntityType.QUOTATION, quotationId, `QT-${quotationId}`)
    }
  }, [quotation, quotationId, setCurrentEntity, navigateTo])

  // Determine next action based on status
  const nextAction = useMemo(() => {
    if (!quotation) return null

    switch (quotation.status) {
      case 'DRAFT':
        return {
          label: '📧 Send to Customer',
          onClick: () => sendMutation.mutate(quotationId),
          primary: true
        }
      case 'SENT':
        return {
          label: '⏰ Follow Up',
          onClick: () => {}, // TODO: Open follow-up modal
          primary: true
        }
      case 'ACCEPTED':
        return {
          label: '✅ Mark as WON',
          onClick: () => acceptMutation.mutate(quotationId),
          primary: true
        }
      case 'WON':
        return {
          label: '📦 Create Indent',
          onClick: () => navigate(`/indents/create?quotationId=${quotationId}`),
          primary: true
        }
      default:
        return null
    }
  }, [quotation?.status, quotationId, navigate, sendMutation, acceptMutation])

  if (isLoading) {
    return <div className="p-6">Loading...</div>
  }

  if (error || !quotation) {
    return <div className="p-6 text-red-600">Failed to load quotation</div>
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header
        title={`Quotation ${quotation.id}`}
        breadcrumb={['Dashboard', 'Quotations', quotation.id]}
      />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Context Card */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                {quotation.customerName}
              </h2>
              <p className="text-slate-600">{quotation.customerEmail}</p>
            </div>
            <StatusBadge status={quotation.status} workflowType="quotation" />
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-slate-600">Total Amount</p>
              <p className="text-xl font-bold">${quotation.grandTotal}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Valid Until</p>
              <p className="text-sm font-medium">{quotation.validUntilDate}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Created By</p>
              <p className="text-sm font-medium">{quotation.createdBy}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Linked Indents</p>
              <p className="text-sm font-medium">{quotation.linkedIndentCount}</p>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 flex gap-3">
          {nextAction && (
            <Button
              onClick={nextAction.onClick}
              className={nextAction.primary ? 'bg-green-500 hover:bg-green-600' : ''}
              disabled={sendMutation.isPending || acceptMutation.isPending}
            >
              {nextAction.label}
            </Button>
          )}
          <Button variant="outline">Download PDF</Button>
          <Button variant="outline">Share</Button>
        </div>

        {/* Suggestion Bar */}
        <SuggestionBar
          status={quotation.status}
          suggestion={
            quotation.status === 'WON'
              ? '✅ Quote won! Create an indent to start sourcing procurement.'
              : quotation.status === 'DRAFT'
              ? 'Review quote details, then send to customer to begin closing.'
              : ''
          }
        />

        <div className="grid grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="col-span-2 space-y-6">
            <Tabs
              tabs={[
                { label: 'Overview', id: 'overview' },
                { label: 'Items', id: 'items' },
                { label: 'Timeline', id: 'timeline' },
                { label: 'Audit', id: 'audit' }
              ]}
            >
              {/* Tab content will be added here */}
              <div>Tab content</div>
            </Tabs>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            <RelatedEntitiesPanel
              entityType="quotation"
              entityId={quotationId}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
```

---

## PART 6: CREATE QUOTATION MODAL SKELETON

### File: `src/components/modals/CreateQuotationModal.tsx`

```typescript
import { useState, useCallback } from 'react'
import { useCreateQuotation } from '@/api/quotations'
import { useNotifications } from '@/store/hooks'
import Modal from '@/components/common/Modal'
import Button from '@/components/common/Button'
import { CreateQuotationInput, QuotationItem } from '@/types/quotation'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: (quotation: any) => void
}

export default function CreateQuotationModal({ isOpen, onClose, onSuccess }: Props) {
  const { addNotification } = useNotifications()
  const createMutation = useCreateQuotation()

  const [formData, setFormData] = useState({
    customerId: '',
    customerName: '',
    items: [
      {
        name: '',
        description: '',
        quantity: 1,
        unitPrice: 0,
        hsn: ''
      }
    ],
    validUntilDate: '',
    notes: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!formData.customerId || !formData.validUntilDate) {
      addNotification({
        type: 'error',
        message: 'Please fill required fields'
      })
      return
    }

    if (formData.items.some((item) => !item.name || item.quantity <= 0)) {
      addNotification({
        type: 'error',
        message: 'All items must have name and quantity'
      })
      return
    }

    // Prepare input
    const input: CreateQuotationInput = {
      customerId: formData.customerId,
      items: formData.items.map((item) => ({
        ...item,
        total: item.quantity * item.unitPrice
      })),
      validUntilDate: formData.validUntilDate,
      notes: formData.notes
    }

    createMutation.mutate(input, {
      onSuccess: (response) => {
        onSuccess(response.data)
        setFormData({
          customerId: '',
          customerName: '',
          items: [{ name: '', description: '', quantity: 1, unitPrice: 0, hsn: '' }],
          validUntilDate: '',
          notes: ''
        })
      },
      onError: (error: any) => {
        addNotification({
          type: 'error',
          message: error.response?.data?.message || 'Failed to create quotation'
        })
      }
    })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Quotation">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer Section */}
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-900">Customer</h3>
          <input
            type="text"
            placeholder="Customer name"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            value={formData.customerName}
            onChange={(e) =>
              setFormData({ ...formData, customerName: e.target.value })
            }
            aria-label="Customer name"
            required
          />
        </div>

        {/* Items Section */}
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-900">Items</h3>
          {/* Add item grid here */}
          {formData.items.length === 0 && (
            <p className="text-sm text-slate-600">No items added</p>
          )}
        </div>

        {/* Validity Section */}
        <div className="space-y-4">
          <label className="block text-sm font-medium text-slate-900">
            Valid Until Date
          </label>
          <input
            type="date"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            value={formData.validUntilDate}
            onChange={(e) =>
              setFormData({ ...formData, validUntilDate: e.target.value })
            }
            required
          />
        </div>

        {/* Notes Section */}
        <div className="space-y-4">
          <label className="block text-sm font-medium text-slate-900">
            Notes (Optional)
          </label>
          <textarea
            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            rows={3}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Add any special notes or terms..."
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-6 border-t border-slate-200">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="flex-1"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Creating...' : 'Create Quotation'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
```

---

## Quick Start Checklist

```typescript
// 1. Install dependencies
npm install zustand @tanstack/react-query

// 2. Create files in order:
☐ src/store/types.ts
☐ src/store/workflowStore.ts
☐ src/store/hooks.ts
☐ src/types/quotation.ts
☐ src/api/quotations.ts

// 3. Create components:
☐ src/pages/Quotations.tsx
☐ src/pages/QuotationDetail.tsx
☐ src/components/modals/CreateQuotationModal.tsx

// 4. Add routes:
// In your main router file:
{
  path: '/quotations',
  element: <Quotations />
},
{
  path: '/quotations/:id',
  element: <QuotationDetail />
}

// 5. Test flow:
☐ Create quotation
☐ Edit draft
☐ Send to customer
☐ Accept (mark WON)
☐ Verify immutability (cannot edit)
☐ Check breadcrumb navigation
☐ Verify related entities show on indent detail
```

This is production-ready code. All components follow React best practices, TypeScript strict mode, and the workflow-first architecture outlined in the enterprise document.
