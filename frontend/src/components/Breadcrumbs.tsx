import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useWorkflow } from '../context/WorkflowContext';

/**
 * Breadcrumbs - Contextual navigation breadcrumbs
 * 
 * Shows current location in workflow:
 * Home / Quotations / Quote #123 / Indents / Indent #456 / etc.
 * 
 * Usage:
 * <Breadcrumbs />
 */

export const Breadcrumbs: React.FC = () => {
  const location = useLocation();
  const workflow = useWorkflow();

  // Build breadcrumb path based on current route and workflow state
  const breadcrumbs: Array<{
    label: string;
    path?: string;
    onClick?: () => void;
  }> = [];

  // Home
  breadcrumbs.push({
    label: 'Home',
    path: '/',
  });

  // Determine current page and add breadcrumbs accordingly
  const pathname = location.pathname;

  if (pathname.includes('quotations') || pathname.includes('quotation')) {
    breadcrumbs.push({
      label: 'Quotations',
      path: '/quotations',
    });

    if (workflow.currentQuotationId) {
      breadcrumbs.push({
        label: `Quote #${workflow.currentQuotationId}`,
        onClick: () => workflow.openDrawer('quotation', workflow.currentQuotationId!),
      });
    }
  }

  if (pathname.includes('indents') || pathname.includes('indent')) {
    if (!breadcrumbs.some((b) => b.label === 'Quotations')) {
      breadcrumbs.push({
        label: 'Indents',
        path: '/indents',
      });
    }

    if (workflow.currentIndentId) {
      breadcrumbs.push({
        label: `Indent #${workflow.currentIndentId}`,
        onClick: () => workflow.openDrawer('indent', workflow.currentIndentId!),
      });
    }
  }

  if (pathname.includes('purchase-orders') || pathname.includes('po')) {
    breadcrumbs.push({
      label: 'Purchase Orders',
      path: '/purchase-orders',
    });

    if (workflow.currentPOId) {
      breadcrumbs.push({
        label: `PO #${workflow.currentPOId}`,
        onClick: () => workflow.openDrawer('po', workflow.currentPOId!),
      });
    }
  }

  if (pathname.includes('dashboard') || pathname === '/') {
    // Dashboard is home, no need for duplicate
  }

  return (
    <nav className="flex items-center gap-1 text-sm mb-6">
      {breadcrumbs.map((crumb, idx) => (
        <React.Fragment key={idx}>
          {crumb.path ? (
            <Link to={crumb.path} className="text-blue-600 hover:text-blue-900 hover:underline transition">
              {crumb.label}
            </Link>
          ) : crumb.onClick ? (
            <button
              onClick={crumb.onClick}
              className="text-blue-600 hover:text-blue-900 hover:underline transition"
            >
              {crumb.label}
            </button>
          ) : (
            <span className="text-gray-600">{crumb.label}</span>
          )}

          {idx < breadcrumbs.length - 1 && <span className="text-gray-400 mx-1">/</span>}
        </React.Fragment>
      ))}
    </nav>
  );
};

export default Breadcrumbs;
