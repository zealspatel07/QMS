import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWorkflow } from '../context/WorkflowContext';
import Button from './Button';

/**
 * SmartActionBar - Context-aware workflow action component
 * 
 * Dynamically displays the next best action based on:
 * - Current page/entity
 * - User permissions
 * - Workflow state
 * 
 * Usage:
 * <SmartActionBar 
 *   entityType="quotation"
 *   entityId={123}
 *   entityData={quotationData}
 * />
 */

interface SmartActionBarProps {
  entityType: 'quotation' | 'indent' | 'po' | 'dashboard';
  entityId?: number | null;
  entityData?: any; // Quotation, Indent, or PO object
  onActionComplete?: () => void;
}

interface ActionItem {
  label: string;
  icon?: string;
  action: () => void;
  disabled?: boolean;
  disabledReason?: string;
  variant?: 'primary' | 'secondary' | 'outline';
}

export const SmartActionBar: React.FC<SmartActionBarProps> = ({
  entityType,
  entityId,
  entityData,
  onActionComplete,
}) => {
  const navigate = useNavigate();
  const { permissions } = useAuth() || { permissions: {} };
  const workflow = useWorkflow();

  const actions = useMemo<ActionItem[]>(() => {
    const result: ActionItem[] = [];

    switch (entityType) {
      case 'quotation':
        // For quotation: primary action is Create Indent
        if (permissions.canCreateIndent !== false) {
          result.push({
            label: 'Create Indent',
            action: () => {
              workflow.setCurrentQuotationId(entityId || null);
              navigate('/create-indent', { state: { quotationId: entityId, quotationData: entityData } });
              onActionComplete?.();
            },
            variant: 'primary',
          });
        }

        // Secondary: View related indents
        if (permissions.canViewIndents !== false) {
          result.push({
            label: 'View Indents',
            action: () => {
              workflow.setCurrentQuotationId(entityId || null);
              navigate(`/indents?quotation=${entityId}`);
              onActionComplete?.();
            },
            variant: 'outline',
          });
        }
        break;

      case 'indent':
        // For indent: primary action is Create PO
        if (permissions.canCreatePO !== false) {
          result.push({
            label: 'Create Purchase Order',
            action: () => {
              workflow.setCurrentIndentId(entityId || null);
              navigate('/create-po', { state: { indentId: entityId, indentData: entityData } });
              onActionComplete?.();
            },
            variant: 'primary',
          });
        }

        // Secondary: View POs for this indent
        if (permissions.canViewPurchaseOrders !== false) {
          result.push({
            label: 'View POs',
            action: () => {
              workflow.setCurrentIndentId(entityId || null);
              navigate(`/purchase-orders?indent=${entityId}`);
              onActionComplete?.();
            },
            variant: 'outline',
          });
        }

        // Tertiary: View source quotation
        if (entityData?.quotation_id && permissions.canViewQuotations !== false) {
          result.push({
            label: 'View Source Quotation',
            action: () => {
              workflow.openDrawer('quotation', entityData.quotation_id);
            },
            variant: 'outline',
          });
        }
        break;

      case 'po':
        // For PO: show completion/next steps
        if (entityData?.status !== 'closed' && permissions.canCreatePO !== false) {
          result.push({
            label: 'Record Goods Receipt',
            action: () => {
              if (entityId) workflow.openDrawer('po', entityId);
              navigate(`/purchase-orders/${entityId}/receive`);
            },
            variant: 'primary',
          });
        }

        // View related indent
        if (entityData?.indent_id && permissions.canViewIndents !== false) {
          result.push({
            label: 'View Source Indent',
            action: () => {
              workflow.openDrawer('indent', entityData.indent_id);
            },
            variant: 'outline',
          });
        }

        // Edit PO
        if (permissions.canCreatePO !== false) {
          result.push({
            label: 'Edit PO',
            action: () => {
              navigate(`/purchase-orders/${entityId}/edit`);
            },
            variant: 'outline',
          });
        }
        break;

      case 'dashboard':
        // For dashboard: Resume work or start new
        if (workflow.lastActiveEntity && workflow.currentIndentId) {
          result.push({
            label: 'Resume Last Work',
            action: () => {
              if (workflow.lastActiveEntity === 'quotation' && workflow.currentQuotationId) {
                navigate(`/quotation-view/${workflow.currentQuotationId}`);
              } else if (workflow.lastActiveEntity === 'indent' && workflow.currentIndentId) {
                navigate(`/indent-view/${workflow.currentIndentId}`);
              } else if (workflow.lastActiveEntity === 'po' && workflow.currentPOId) {
                navigate(`/purchase-orders/${workflow.currentPOId}`);
              }
            },
            variant: 'primary',
          });
        }

        // Start new quotation
        if (permissions.canCreateQuotation !== false) {
          result.push({
            label: 'New Quotation',
            action: () => {
              navigate('/create-quotation');
            },
            variant: 'primary',
          });
        }

        // Start new indent
        if (permissions.canCreateIndent !== false) {
          result.push({
            label: 'New Indent',
            action: () => {
              navigate('/create-indent');
            },
            variant: 'secondary',
          });
        }

        // Create PO
        if (permissions.canCreatePO !== false) {
          result.push({
            label: 'New Purchase Order',
            action: () => {
              navigate('/create-po');
            },
            variant: 'secondary',
          });
        }
        break;
    }

    return result;
  }, [entityType, entityId, entityData, permissions, workflow, navigate, onActionComplete]);

  if (actions.length === 0) {
    return null;
  }

  // Primary action (first)
  const primaryAction = actions[0];
  const secondaryActions = actions.slice(1);

  return (
    <div className="flex flex-wrap gap-2 p-4 bg-gray-50 border-t border-gray-200 rounded-lg">
      {/* Primary CTA */}
      <Button
        onClick={primaryAction.action}
        disabled={primaryAction.disabled}
        title={primaryAction.disabledReason}
        className="px-4 py-2"
      >
        {primaryAction.label}
      </Button>

      {/* Secondary actions as outline buttons */}
      {secondaryActions.map((action, idx) => (
        <Button
          key={idx}
          onClick={action.action}
          disabled={action.disabled}
          variant="outline"
          title={action.disabledReason}
          className="px-4 py-2"
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
};

export default SmartActionBar;
