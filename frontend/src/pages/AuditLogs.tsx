// frontend/src/pages/AuditLogs.tsx

import { useEffect, useState } from 'react';
import { Download, Eye } from 'lucide-react';
import Layout from "../components/layout/Layout";
import toast from 'react-hot-toast';

type AuditLog = {
  id: number;
  user_id: number;
  user_email?: string;
  user_name?: string;
  action: string;
  module: string;
  entity_id?: number;
  entity_identifier?: string;
  old_values?: any;
  new_values?: any;
  changes?: any;
  ip_address?: string;
  is_success: boolean;
  error_message?: string;
  created_at: string;
};

export default function AuditLogs() {
  // ================= STATE =================
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Filters
  const [filters, setFilters] = useState({
    user_id: '',
    action: '',
    module: '',
    from_date: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10),
    to_date: new Date().toISOString().slice(0, 10),
  });

  const[pagination, setPagination] = useState({
    limit: 50,
    offset: 0,
    total: 0,
  });

  // ================= LOAD DATA =================
  useEffect(() => {
    loadLogs();
  }, [filters, pagination.offset]);

  async function loadLogs() {
    try {
      setLoading(true);

      const params = new URLSearchParams();
      if (filters.user_id) params.append('user_id', filters.user_id);
      if (filters.action) params.append('action', filters.action);
      if (filters.module) params.append('module', filters.module);
      if (filters.from_date) params.append('from_date', filters.from_date);
      if (filters.to_date) params.append('to_date', filters.to_date);
      params.append('limit', String(pagination.limit));
      params.append('offset', String(pagination.offset));

      const queryString = params.toString();
      const endpoint = `/api/audit-logs${queryString ? '?' + queryString : ''}`;
      
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setLogs(data.data || []);
      setPagination(prev => ({ ...prev, total: data.total || 0 }));
    } catch (err) {
      console.error('Audit logs fetch error:', err);
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }

  function handleFilterChange(key: string, value: string) {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, offset: 0 })); // Reset pagination
  }

  function handleReset() {
    setFilters({
      user_id: '',
      action: '',
      module: '',
      from_date: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10),
      to_date: new Date().toISOString().slice(0, 10),
    });
    setPagination(prev => ({ ...prev, offset: 0 }));
  }

  if (loading && logs.length === 0) {
    return (
      <Layout>
        <div className="p-8 space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3 animate-pulse" />
          <div className="h-64 bg-gray-200 rounded animate-pulse" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-[1400px] mx-auto px-8 py-8 space-y-8">
        {/* ================= HEADER ================= */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
            <p className="text-gray-600 mt-2">Track all user activity and system changes for compliance</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            <Download size={16} /> Export
          </button>
        </div>

        {/* ================= FILTERS ================= */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Filters</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-2">From Date</label>
              <input
                type="date"
                value={filters.from_date}
                onChange={(e) => handleFilterChange('from_date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-2">To Date</label>
              <input
                type="date"
                value={filters.to_date}
                onChange={(e) => handleFilterChange('to_date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-2">Action</label>
              <select
                value={filters.action}
                onChange={(e) => handleFilterChange('action', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">All Actions</option>
                <option value="CREATE">Create</option>
                <option value="UPDATE">Update</option>
                <option value="DELETE">Delete</option>
                <option value="APPROVE">Approve</option>
                <option value="REJECT">Reject</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-2">Module</label>
              <select
                value={filters.module}
                onChange={(e) => handleFilterChange('module', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">All Modules</option>
                <option value="QUOTATION">Quotation</option>
                <option value="PURCHASE_ORDER">PO</option>
                <option value="INDENT">Indent</option>
                <option value="CUSTOMER">Customer</option>
                <option value="USER">User</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={loadLogs}
                className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm"
              >
                Search
              </button>
              <button
                onClick={handleReset}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* ================= AUDIT TABLE ================= */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Date & Time</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">User</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Module</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Action</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Entity</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-900">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-gray-900">
                      <div>
                        <p className="font-medium">{log.user_name || 'Unknown'}</p>
                        <p className="text-xs text-gray-500">{log.user_email}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                        {log.module}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        log.action === 'CREATE' ? 'bg-green-100 text-green-700' :
                        log.action === 'UPDATE' ? 'bg-yellow-100 text-yellow-700' :
                        log.action === 'DELETE' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-900">
                      {log.entity_identifier || `ID: ${log.entity_id}`}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        log.is_success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {log.is_success ? 'Success' : 'Failed'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ================= EXPANDED DETAILS ================= */}
          {expandedId && logs.find(l => l.id === expandedId) && (
            <div className="bg-gray-50 border-t border-gray-200 p-6">
              <ExpandedDetails log={logs.find(l => l.id === expandedId)!} />
            </div>
          )}
        </div>

        {/* ================= PAGINATION ================= */}
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-600">
            Showing {pagination.offset + 1} to {Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total} logs
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPagination(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
              disabled={pagination.offset === 0}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
              disabled={pagination.offset + pagination.limit >= pagination.total}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}

// ================= COMPONENTS =================

function ExpandedDetails({ log }: { log: AuditLog }) {
  return (
    <div className="space-y-6">
      <div>
        <h4 className="font-semibold text-gray-900 mb-3">Metadata</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-600 mb-1">IP Address</p>
            <p className="font-mono text-gray-900">{log.ip_address || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600 mb-1">Timestamp</p>
            <p className="font-mono text-gray-900">{new Date(log.created_at).toISOString()}</p>
          </div>
        </div>
      </div>

      {log.changes && Object.keys(log.changes).length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-900 mb-3">Changes</h4>
          <div className="space-y-2">
            {Object.entries(log.changes).map(([field, change]: [string, any]) => (
              <div key={field} className="grid grid-cols-2 gap-4 text-sm bg-white p-3 rounded border border-gray-200">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Before ({field})</p>
                  <p className="font-mono text-gray-900 whitespace-pre-wrap break-words">
                    {JSON.stringify(change.old, null, 2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">After ({field})</p>
                  <p className="font-mono text-gray-900 whitespace-pre-wrap break-words">
                    {JSON.stringify(change.new, null, 2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {log.error_message && (
        <div>
          <h4 className="font-semibold text-gray-900 mb-3">Error Details</h4>
          <p className="text-sm text-red-700 bg-red-50 p-3 rounded border border-red-200">{log.error_message}</p>
        </div>
      )}
    </div>
  );
}
