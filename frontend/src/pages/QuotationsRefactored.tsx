/**
 * ============================================================================
 * QUOTATIONS REFACTORED - WORKFLOW INTEGRATION EXAMPLE
 * ============================================================================
 * 
 * This is a REFERENCE implementation showing how to enhance the existing
 * Quotations.tsx with workflow features while maintaining all existing functionality.
 * 
 * WHAT'S DIFFERENT:
 * ✅ Uses SmartTable for cleaner code
 * ✅ Tracks current quotation in WorkflowContext
 * ✅ Row click opens side drawer (no navigation required)
 * ✅ Inline "Create Indent" action
 * ✅ Workflow status column (shows related indents + POs)
 * ✅ Same data loading, filtering, permissions as original
 * 
 * INTEGRATION: Gradually migrate this. Start with SmartActionBar on existing table.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Layout from '../components/layout/Layout';
import SmartTable, { type TableColumn, type RowAction } from '../components/SmartTable';
import { useWorkflow } from '../context/WorkflowContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { formatDateDDMMYYYY } from '../utils/date';

interface QuotationRow {
  id: number;
  quotation_no: string;
  customer?: { id: number; company_name: string };
  contact?: { id: number; name: string };
  items?: any[];
  salesperson_name?: string;
  total_value?: number | string;
  status?: string;
  created_at?: string;
  validity?: {
    validity_state: 'valid' | 'due' | 'overdue' | 'expired';
    remaining_days?: number;
  };
  indent_count?: number;
  po_count?: number;
}

export default function QuotationsRefactored() {
  const navigate = useNavigate();
  const workflow = useWorkflow();
  const { permissions } = useAuth() || { permissions: {} };

  const [quotations, setQuotations] = useState<QuotationRow[]>([]);
  const [loading, setLoading] = useState(false);

  // State for filtering/search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'pending' | 'won' | 'lost'>('all');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  // Load quotations
  useEffect(() => {
    loadQuotations();
  }, [statusFilter]);

  const loadQuotations = async () => {
    setLoading(true);
    try {
      const data = await api.getQuotations({
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      setQuotations(Array.isArray(data) ? data : data?.data ?? []);
    } catch (err) {
      console.error('Failed to load quotations:', err);
      toast.error('Failed to load quotations');
    } finally {
      setLoading(false);
    }
  };

  // Filtered data
  const filtered = useMemo(() => {
    let list = quotations;

    // Status filter
    if (statusFilter !== 'all') {
      list = list.filter((q) => (q.status || '').toLowerCase() === statusFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (row) =>
          (row.quotation_no || '').toLowerCase().includes(q) ||
          (row.customer?.company_name || '').toLowerCase().includes(q) ||
          (row.salesperson_name || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [quotations, statusFilter, searchQuery]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageData = filtered.slice((page - 1) * perPage, page * perPage);

  // Table columns
  const columns: TableColumn<QuotationRow>[] = [
    {
      key: 'quotation_no',
      label: 'Quote #',
      width: '100px',
      render: (val, row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-gray-900">{val}</span>
          <span className="text-xs text-gray-500 mt-1">
            {row.created_at ? formatDateDDMMYYYY(row.created_at) : 'N/A'}
          </span>
        </div>
      ),
    },
    {
      key: 'customer',
      label: 'Customer',
      render: (val, row) => (
        <div className="flex flex-col">
          <span className="font-medium text-gray-800">{val?.company_name || 'N/A'}</span>
          <span className="text-xs text-gray-500 mt-1">{row.contact?.name || '-'}</span>
        </div>
      ),
    },
    {
      key: 'total_value',
      label: 'Amount',
      align: 'right',
      render: (val) => <span className="font-semibold text-emerald-600">₹{Number(val || 0).toLocaleString('en-IN')}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (val) => {
        const colors: Record<string, string> = {
          draft: 'bg-gray-100 text-gray-700',
          pending: 'bg-blue-100 text-blue-700',
          won: 'bg-green-100 text-green-700',
          lost: 'bg-red-100 text-red-700',
        };
        return (
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${colors[val] || 'bg-gray-100'}`}>
            {val?.toUpperCase() || 'N/A'}
          </span>
        );
      },
    },
    {
      key: 'validity',
      label: 'Validity',
      render: (val) => {
        if (!val?.validity_state) return '-';
        const colors: Record<string, string> = {
          valid: 'bg-green-100 text-green-800',
          due: 'bg-yellow-100 text-yellow-800',
          overdue: 'bg-orange-100 text-orange-800',
          expired: 'bg-red-100 text-red-800',
        };
        return (
          <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${colors[val.validity_state]}`}>
            {val.validity_state.toUpperCase()}
            {val.remaining_days !== undefined && ` (${val.remaining_days}d)`}
          </span>
        );
      },
    },
    {
      key: 'indent_count',
      label: 'Indents',
      align: 'center',
      render: (val) => <span className="text-gray-900 font-medium">{val || 0}</span>,
    },
    {
      key: 'po_count',
      label: 'POs',
      align: 'center',
      render: (val) => <span className="text-gray-900 font-medium">{val || 0}</span>,
    },
  ];

  // Row actions
  const rowActions: RowAction<QuotationRow>[] = [
    {
      label: 'View',
      onClick: (row) => {
        workflow.setCurrentQuotationId(row.id);
        navigate(`/quotation-view/${row.id}`);
      },
    },
    {
      label: 'Create Indent',
      onClick: (row) => {
        workflow.setCurrentQuotationId(row.id);
        navigate('/create-indent', { state: { quotationId: row.id, quotationData: row } });
      },
      disabled: () => permissions.canCreateIndent === false,
    },
  ];

  

  return (
    <Layout>
      <div className="max-w-full px-6 pb-8">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Quotations</h1>
            <p className="text-gray-600 mt-2">Manage and track quotations through your sales workflow</p>
          </div>
          {permissions.canCreateQuotation && (
            <button
              onClick={() => navigate('/create-quotation')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
            >
              + New Quotation
            </button>
          )}
        </div>

        {/* Search & Filter */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <input
              placeholder="Search quotation, customer, salesperson..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              title="Filter by status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setPage(1);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="pending">Pending</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>
            <select
              title="Items per page"
              value={perPage}
              onChange={(e) => setPerPage(Number(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
              <option value={50}>50 per page</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <SmartTable
          data={pageData}
          columns={columns}
          rowActions={rowActions}
          onRowClick={(row) => {
            workflow.setCurrentQuotationId(row.id);
            workflow.openDrawer('quotation', row.id);
          }}
          loading={loading}
          emptyMessage="No quotations found"
        />

        {/* Pagination */}
        <div className="mt-6 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Showing {pageData.length > 0 ? (page - 1) * perPage + 1 : 0}–
            {Math.min(page * perPage, filtered.length)} of {filtered.length}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
            >
              ← Prev
            </button>
            <div className="px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm font-medium">
              {page} / {pageCount}
            </div>
            <button
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page === pageCount}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
