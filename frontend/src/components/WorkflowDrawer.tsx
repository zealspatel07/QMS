import React, { useEffect, useState } from 'react';
import { useWorkflow } from '../context/WorkflowContext';
import { api } from '../api';
import SmartActionBar from './SmartActionBar';

/**
 * WorkflowDrawer - Right-side drawer for entity previews
 * 
 * Shows preview of Quotation/Indent/PO without full navigation
 * - 30% screen width
 * - Non-blocking
 * - Keeps list visible
 * - Quick actions available
 */

export const WorkflowDrawer: React.FC = () => {
  const workflow = useWorkflow();
  const { viewingDrawer } = workflow;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!viewingDrawer.type || !viewingDrawer.id) {
      setData(null);
      return;
    }

    setLoading(true);
    const fetchData = async () => {
      if (!viewingDrawer.id) return;
      try {
        switch (viewingDrawer.type) {
          case 'quotation':
            const q = await api.getQuotation(viewingDrawer.id);
            setData(q);
            break;
          case 'indent':
            const i = await api.getIndent(viewingDrawer.id);
            setData(i);
            break;
          case 'po':
            const po = await api.getPurchaseOrder(viewingDrawer.id);
            setData(po);
            break;
        }
      } catch (err) {
        console.error('Failed to fetch drawer data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [viewingDrawer]);

  if (!viewingDrawer.type || !viewingDrawer.id) {
    return null;
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/20 z-30"
        onClick={() => workflow.closeDrawer()}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-[30%] max-w-md bg-white shadow-lg z-40 overflow-y-auto">
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white">
            <h2 className="text-lg font-semibold text-gray-900 capitalize">
              {viewingDrawer.type} Details
            </h2>
            <button
              title="Close drawer"
              onClick={() => workflow.closeDrawer()}
              className="p-1 text-gray-500 hover:text-gray-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-gray-500">Loading...</div>
              </div>
            ) : data ? (
              <div className="p-4 space-y-4">
                <DrawerContent type={viewingDrawer.type} data={data} />
              </div>
            ) : (
              <div className="flex items-center justify-center h-32">
                <div className="text-gray-500">No data found</div>
              </div>
            )}
          </div>

          {/* Actions */}
          {data && (
            <div className="border-t border-gray-200 p-4 bg-gray-50">
              <SmartActionBar
                entityType={viewingDrawer.type}
                entityId={viewingDrawer.id}
                entityData={data}
                onActionComplete={() => workflow.closeDrawer()}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
};

/**
 * DrawerContent - Entity-specific preview content
 */
interface DrawerContentProps {
  type: 'quotation' | 'indent' | 'po';
  data: any;
}

const DrawerContent: React.FC<DrawerContentProps> = ({ type, data }) => {
  switch (type) {
    case 'quotation':
      return (
        <div className="space-y-4">
          <Section title="Details">
            <DetailRow label="Quotation #" value={data.quotation_number} />
            <DetailRow label="Customer" value={data.customer_name} />
            <DetailRow label="Date" value={new Date(data.quotation_date).toLocaleDateString('en-IN')} />
            <DetailRow label="Amount" value={`₹${data.total_amount?.toLocaleString('en-IN')}`} />
            <DetailRow label="Status" value={<StatusBadge status={data.status} />} />
          </Section>

          <Section title="Items">
            <div className="space-y-2">
              {data.items?.slice(0, 5).map((item: any, idx: number) => (
                <div key={idx} className="text-xs text-gray-600">
                  <div className="font-medium text-gray-900">{item.product_name}</div>
                  <div>Qty: {item.quantity} × ₹{item.unit_price}</div>
                </div>
              ))}
              {data.items?.length > 5 && (
                <div className="text-xs text-gray-500 italic">+{data.items.length - 5} more items</div>
              )}
            </div>
          </Section>

          {data.validity_date && (
            <Section title="Validity">
              <DetailRow label="Valid till" value={new Date(data.validity_date).toLocaleDateString('en-IN')} />
            </Section>
          )}
        </div>
      );

    case 'indent':
      return (
        <div className="space-y-4">
          <Section title="Details">
            <DetailRow label="Indent #" value={data.indent_number} />
            <DetailRow label="Quotation" value={data.quotation_number || 'Direct Indent'} />
            <DetailRow label="Date" value={new Date(data.indent_date).toLocaleDateString('en-IN')} />
            <DetailRow label="Status" value={<StatusBadge status={data.status} />} />
          </Section>

          <Section title="Items">
            <div className="space-y-2">
              {data.items?.slice(0, 5).map((item: any, idx: number) => (
                <div key={idx} className="text-xs text-gray-600">
                  <div className="font-medium text-gray-900">{item.product_name}</div>
                  <div>Qty: {item.quantity}</div>
                </div>
              ))}
              {data.items?.length > 5 && (
                <div className="text-xs text-gray-500 italic">+{data.items.length - 5} more items</div>
              )}
            </div>
          </Section>

          {data.po_count > 0 && (
            <Section title="Purchase Orders">
              <DetailRow label="POs Created" value={data.po_count} />
              <DetailRow label="Status" value={data.po_status || 'Pending'} />
            </Section>
          )}
        </div>
      );

    case 'po':
      return (
        <div className="space-y-4">
          <Section title="Details">
            <DetailRow label="PO #" value={data.po_number} />
            <DetailRow label="Indent" value={data.indent_number} />
            <DetailRow label="Vendor" value={data.vendor_name} />
            <DetailRow label="Date" value={new Date(data.po_date).toLocaleDateString('en-IN')} />
            <DetailRow label="Amount" value={`₹${data.total_amount?.toLocaleString('en-IN')}`} />
            <DetailRow label="Status" value={<StatusBadge status={data.status} />} />
          </Section>

          <Section title="Items">
            <div className="space-y-2">
              {data.items?.slice(0, 5).map((item: any, idx: number) => (
                <div key={idx} className="text-xs text-gray-600">
                  <div className="font-medium text-gray-900">{item.product_name}</div>
                  <div>Qty: {item.quantity} @ ₹{item.unit_price}</div>
                </div>
              ))}
              {data.items?.length > 5 && (
                <div className="text-xs text-gray-500 italic">+{data.items.length - 5} more items</div>
              )}
            </div>
          </Section>

          {data.status === 'partial_received' && (
            <Section title="Goods Receipt">
              <DetailRow label="Received" value={`${data.received_qty || 0} / ${data.quantity}`} />
            </Section>
          )}
        </div>
      );

    default:
      return null;
  }
};

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, children }) => (
  <div>
    <h3 className="text-sm font-semibold text-gray-900 mb-2">{title}</h3>
    <div className="bg-gray-50 rounded p-3 text-sm space-y-2">{children}</div>
  </div>
);

interface DetailRowProps {
  label: string;
  value: React.ReactNode;
}

const DetailRow: React.FC<DetailRowProps> = ({ label, value }) => (
  <div className="flex justify-between">
    <span className="text-gray-600">{label}:</span>
    <span className="font-medium text-gray-900">{value}</span>
  </div>
);

interface StatusBadgeProps {
  status: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    closed: 'bg-gray-100 text-gray-800',
    cancelled: 'bg-red-100 text-red-800',
    partial_received: 'bg-blue-100 text-blue-800',
  };

  return (
    <span className={`inline-block px-2 py-1 text-xs font-semibold rounded ${colors[status] || 'bg-gray-100'}`}>
      {status.replace('_', ' ').toUpperCase()}
    </span>
  );
};

export default WorkflowDrawer;
