import React, { useState, type ReactNode } from 'react';
import { useWorkflow } from '../context/WorkflowContext';

/**
 * SmartTable - Reusable workflow-aware table component
 * 
 * Features:
 * - Row click navigation with drawer opening
 * - Inline action buttons
 * - Expandable rows for details
 * - Sticky header/action column
 * - Workflow status indicators
 * - Responsive design
 * 
 * Usage:
 * <SmartTable
 *   data={quotations}
 *   columns={[
 *     { key: 'id', label: 'ID', width: '80px' },
 *     { key: 'customer_name', label: 'Customer' },
 *   ]}
 *   rowActions={[
 *     { label: 'Create Indent', onClick: (row) => ... }
 *   ]}
 *   onRowClick={(row) => openDrawer('quotation', row.id)}
 *   entityType="quotation"
 *   expandable
 *   renderExpanded={(row) => <ItemDetails items={row.items} />}
 * />
 */

export interface TableColumn<T = any> {
  key: keyof T;
  label: string;
  width?: string;
  render?: (value: any, row: T) => ReactNode;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
}

export interface RowAction<T = any> {
  label: string;
  onClick: (row: T) => void;
  icon?: ReactNode;
  hidden?: (row: T) => boolean;
  disabled?: (row: T) => boolean;
  className?: string;
}

interface SmartTableProps<T = any> {
  data: T[];
  columns: TableColumn<T>[];
  rowActions?: RowAction<T>[];
  onRowClick?: (row: T) => void;
  expandable?: boolean;
  renderExpanded?: (row: T) => ReactNode;
  entityType?: 'quotation' | 'indent' | 'po';
  loading?: boolean;
  emptyMessage?: string;
  rowKey?: string;
  hoverable?: boolean;
}

export const SmartTable = React.forwardRef<HTMLDivElement, SmartTableProps<any>>(
  (
    {
      data,
      columns,
      rowActions = [],
      onRowClick,
      expandable = false,
      renderExpanded,
      entityType,
      loading = false,
      emptyMessage = 'No data found',
      rowKey = 'id',
      hoverable = true,
    },
    ref
  ) => {
    const workflow = useWorkflow();
    const [expandedRows, setExpandedRows] = useState<Set<any>>(new Set());

    const toggleExpand = (rowId: any) => {
      setExpandedRows((prev) => {
        const next = new Set(prev);
        if (next.has(rowId)) {
          next.delete(rowId);
        } else {
          next.add(rowId);
        }
        return next;
      });
    };

    const handleRowClick = (row: any) => {
      if (onRowClick) {
        onRowClick(row);
      } else if (entityType) {
        // Auto-open drawer for workflow entities
        const id = (row as any)[rowKey];
        workflow.openDrawer(entityType, id);
      }
    };

    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading...</div>
        </div>
      );
    }

    if (data.length === 0) {
      return (
        <div className="flex items-center justify-center h-32 border border-gray-200 rounded-lg bg-gray-50">
          <div className="text-gray-500">{emptyMessage}</div>
        </div>
      );
    }

    return (
      <div ref={ref} className="w-full overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
            <tr>
              {expandable && <th className="w-12 px-4 py-3" />}
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className={`px-6 py-3 text-left text-sm font-semibold text-gray-700 ${
                    col.width ? `w-[${col.width}]` : ''
                  }`}
                  style={{ width: col.width }} // Dynamic width based on column definition
                >
                  {col.label}
                </th>
              ))}
              {rowActions.length > 0 && (
                <th className="sticky right-0 w-32 px-6 py-3 text-left text-sm font-semibold text-gray-700 bg-gray-50">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.map((row, idx) => {
              const rowId = (row as any)[rowKey];
              const isExpanded = expandedRows.has(rowId);

              return (
                <React.Fragment key={idx}>
                  <tr
                    className={`
                      ${hoverable ? 'hover:bg-gray-50 cursor-pointer' : ''}
                      transition-colors
                    `}
                    onClick={() => handleRowClick(row)}
                  >
                    {expandable && (
                      <td
                        className="w-12 px-4 py-3"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(rowId);
                        }}
                      >
                        <button title="Expand row for more details" className="p-1 text-gray-600 hover:text-gray-900">
                          <svg
                            className={`w-4 h-4 transition-transform ${
                              isExpanded ? 'rotate-90' : ''
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </button>
                      </td>
                    )}

                    {columns.map((col) => {
                      const value = (row as any)[String(col.key)];
                      return (
                        <td
                          key={`${idx}-${String(col.key)}`}
                          className={`px-6 py-4 text-sm text-gray-900 ${
                            col.align === 'center' ? 'text-center' : ''
                          } ${col.align === 'right' ? 'text-right' : ''}`}
                        >
                          {col.render ? col.render(value, row) : value}
                        </td>
                      );
                    })}

                    {rowActions.length > 0 && (
                      <td
                        className="sticky right-0 px-6 py-4 text-sm text-gray-600 bg-white border-l border-gray-200"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex gap-2">
                          {rowActions.map((action, aIdx) => {
                            if (action.hidden?.(row)) return null;
                            const isDisabled = action.disabled?.(row) || false;
                            const customClassName = action.className;

                            return (
                              <button
                                key={aIdx}
                                onClick={() => !isDisabled && action.onClick(row)}
                                disabled={isDisabled}
                                className={customClassName || `
                                  px-2 py-1 text-xs rounded
                                  transition-colors
                                  ${
                                    isDisabled
                                      ? 'opacity-50 cursor-not-allowed text-gray-400'
                                      : 'text-blue-600 hover:text-blue-900 hover:bg-blue-50'
                                  }
                                `}
                                title={action.label}
                              >
                                {action.icon && <span className="inline-block mr-1">{action.icon}</span>}
                                {action.label}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    )}
                  </tr>

                  {expandable && isExpanded && renderExpanded && (
                    <tr className="bg-gray-50">
                      <td colSpan={columns.length + (rowActions.length > 0 ? 2 : 1)}>
                        <div className="p-6">{renderExpanded(row)}</div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }
);

SmartTable.displayName = 'SmartTable';

export default SmartTable;
