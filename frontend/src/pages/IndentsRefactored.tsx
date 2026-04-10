/**
 * ============================================================================
 * INDENTS REFACTORED - WORKFLOW INTEGRATION EXAMPLE
 * ============================================================================
 * 
 * ENHANCEMENTS:
 * ✅ Show linked quotation (with link to preview)
 * ✅ Show PO count + status
 * ✅ Inline "Create PO" action
 * ✅ Row expansion for item details
 * ✅ WorkflowContext tracking
 * ✅ SmartTable integration
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import Layout from '../components/layout/Layout';
import SmartTable, { type TableColumn, type RowAction } from '../components/SmartTable';
import { useWorkflow } from '../context/WorkflowContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { formatDateDDMMYYYY } from '../utils/date';
import { Eye, Plus } from 'lucide-react';

interface IndentItem {
  product_name: string;
  quantity: number;
  unit_price?: number;
  total_price?: number;
}

interface IndentRow {
  id: number;
  indent_number: string;
  quotation_id?: number;
  quotation_number?: string;
  indent_date?: string;
  status?: string;
  items?: IndentItem[];
  total_amount?: number;
  po_count?: number;
  po_status?: string;
}

export default function IndentsRefactored() {
  const navigate = useNavigate();
  const workflow = useWorkflow();
  const { permissions } = useAuth() || { permissions: {} };
  const [searchParams] = useSearchParams();

  const [indents, setIndents] = useState<IndentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('all');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const quotationFilter = searchParams.get('quotation');

  useEffect(() => {
    loadIndents();
  }, [statusFilter, quotationFilter]);

  const loadIndents = async () => {
    setLoading(true);
    try {
      const data = await api.getIndents();
      setIndents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load indents:', err);
      toast.error('Failed to load indents');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let list = indents;

    if (statusFilter !== 'all') {
      list = list.filter((i) => (i.status || '').toLowerCase() === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (row) =>
          (row.indent_number || '').toLowerCase().includes(q) ||
          (row.quotation_number || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [indents, statusFilter, searchQuery]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageData = filtered.slice((page - 1) * perPage, page * perPage);

  const columns: TableColumn<IndentRow>[] = [
    {
      key: 'indent_number',
      label: 'Indent #',
      width: '120px',
      render: (val, row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-gray-900">{val}</span>
          <span className="text-xs text-gray-500 mt-1">
            {row.indent_date ? formatDateDDMMYYYY(row.indent_date) : 'N/A'}
          </span>
        </div>
      ),
    },
    {
      key: 'quotation_number',
      label: 'Quotation',
      render: (val, row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (row.quotation_id) {
              workflow.openDrawer('quotation', row.quotation_id);
            }
          }}
          className="text-blue-600 hover:text-blue-900 hover:underline font-medium"
        >
          {val || 'Direct Indent'}
        </button>
      ),
    },
    {
      key: 'total_amount',
      label: 'Amount',
      align: 'right',
      render: (val) => <span className="font-semibold text-emerald-600">₹{Number(val || 0).toLocaleString('en-IN')}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (val) => {
        const colors: Record<string, string> = {
          active: 'bg-green-100 text-green-700',
          closed: 'bg-gray-100 text-gray-700',
          pending: 'bg-yellow-100 text-yellow-700',
        };
        return (
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${colors[val] || 'bg-gray-100'}`}>
            {val?.toUpperCase() || 'N/A'}
          </span>
        );
      },
    },
    {
      key: 'po_count',
      label: 'POs',
      align: 'center',
      render: (val, row) => (
        <div className="flex items-center justify-center gap-2">
          <span className="font-medium text-gray-900">{val || 0}</span>
          {row.po_status && <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">{row.po_status}</span>}
        </div>
      ),
    },
  ];

  const rowActions: RowAction<IndentRow>[] = [
    {
      label: 'View',
      onClick: (row: IndentRow) => {
        workflow.setCurrentIndentId(row.id);
        navigate(`/indent-view/${row.id}`);
      },
      icon: <Eye size={16} />,
      className: "inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
    },
    {
      label: 'Create PO',
      onClick: (row: IndentRow) => {
        workflow.setCurrentIndentId(row.id);
        navigate('/create-po', { state: { indentId: row.id, indentData: row } });
      },
      icon: <Plus size={16} />,
      disabled: () => permissions.canCreatePO === false,
      className: "inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    },
  ];

  return (
    <Layout>
      <div className="max-w-full px-6 pb-8">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Indents</h1>
            <p className="text-gray-600 mt-2">Track indents and create purchase orders</p>
          </div>
          {permissions.canCreateIndent && (
            <button
              onClick={() => navigate('/create-indent')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
            >
              + New Indent
            </button>
          )}
        </div>

        {/* Search & Filter */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <input
              placeholder="Search indent or quotation number..."
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
              <option value="active">Active</option>
              <option value="closed">Closed</option>
            </select>
            <select
              title="Items per page"
              value={perPage}
              onChange={(e) => setPerPage(Number(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <SmartTable
          data={pageData}
          columns={columns}
          rowActions={rowActions}
          onRowClick={(row) => {
            workflow.setCurrentIndentId(row.id);
            workflow.openDrawer('indent', row.id);
          }}
          loading={loading}
          emptyMessage="No indents found"
          expandable={true}
          renderExpanded={(row) => (
            <div className="space-y-2">
              <h4 className="font-semibold text-gray-900">Items:</h4>
              <div className="grid grid-cols-1 gap-2">
                {row.items?.map((item: IndentItem, idx: number) => (
                  <div key={idx} className="flex justify-between text-sm p-2 bg-gray-50 rounded">
                    <span className="text-gray-900 font-medium">{item.product_name}</span>
                    <span className="text-gray-600">
                      {item.quantity} × ₹{Number(item.unit_price || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
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
