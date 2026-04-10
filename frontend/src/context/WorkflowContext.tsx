import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

/**
 * WorkflowContext - Global workflow state management
 * 
 * Tracks the current user's position in the CRM workflow:
 * Quotation → Indent → Purchase Order → Delivery
 * 
 * Features:
 * - Persists to localStorage (resume capability)
 * - Role-aware workflow steps
 * - Supports flexible paths (quotation optional)
 * - Maintains context across pages
 */

export interface WorkflowState {
  currentQuotationId: number | null;
  currentIndentId: number | null;
  currentPOId: number | null;
  lastActiveEntity: 'quotation' | 'indent' | 'po' | null;
  viewingDrawer: {
    type: 'quotation' | 'indent' | 'po' | null;
    id: number | null;
  };
}

interface WorkflowContextType extends WorkflowState {
  setCurrentQuotationId: (id: number | null) => void;
  setCurrentIndentId: (id: number | null) => void;
  setCurrentPOId: (id: number | null) => void;
  setLastActiveEntity: (entity: 'quotation' | 'indent' | 'po' | null) => void;
  openDrawer: (type: 'quotation' | 'indent' | 'po', id: number) => void;
  closeDrawer: () => void;
  clearWorkflow: () => void;
  setWorkflow: (state: Partial<WorkflowState>) => void;
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined);

const WORKFLOW_STORAGE_KEY = 'qms_workflow_state';

export const WorkflowProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<WorkflowState>({
    currentQuotationId: null,
    currentIndentId: null,
    currentPOId: null,
    lastActiveEntity: null,
    viewingDrawer: { type: null, id: null },
  });

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(WORKFLOW_STORAGE_KEY);
    if (stored) {
      try {
        setState(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to hydrate workflow state:', e);
      }
    }
  }, []);

  // Persist to localStorage whenever state changes
  useEffect(() => {
    localStorage.setItem(WORKFLOW_STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const setCurrentQuotationId = (id: number | null) => {
    setState((prev) => ({
      ...prev,
      currentQuotationId: id,
      lastActiveEntity: id !== null ? 'quotation' : prev.lastActiveEntity,
    }));
  };

  const setCurrentIndentId = (id: number | null) => {
    setState((prev) => ({
      ...prev,
      currentIndentId: id,
      lastActiveEntity: id !== null ? 'indent' : prev.lastActiveEntity,
    }));
  };

  const setCurrentPOId = (id: number | null) => {
    setState((prev) => ({
      ...prev,
      currentPOId: id,
      lastActiveEntity: id !== null ? 'po' : prev.lastActiveEntity,
    }));
  };

  const setLastActiveEntity = (entity: 'quotation' | 'indent' | 'po' | null) => {
    setState((prev) => ({
      ...prev,
      lastActiveEntity: entity,
    }));
  };

  const openDrawer = (type: 'quotation' | 'indent' | 'po', id: number) => {
    setState((prev) => ({
      ...prev,
      viewingDrawer: { type, id },
    }));
  };

  const closeDrawer = () => {
    setState((prev) => ({
      ...prev,
      viewingDrawer: { type: null, id: null },
    }));
  };

  const clearWorkflow = () => {
    setState({
      currentQuotationId: null,
      currentIndentId: null,
      currentPOId: null,
      lastActiveEntity: null,
      viewingDrawer: { type: null, id: null },
    });
    localStorage.removeItem(WORKFLOW_STORAGE_KEY);
  };

  const setWorkflow = (newState: Partial<WorkflowState>) => {
    setState((prev) => ({
      ...prev,
      ...newState,
    }));
  };

  return (
    <WorkflowContext.Provider
      value={{
        ...state,
        setCurrentQuotationId,
        setCurrentIndentId,
        setCurrentPOId,
        setLastActiveEntity,
        openDrawer,
        closeDrawer,
        clearWorkflow,
        setWorkflow,
      }}
    >
      {children}
    </WorkflowContext.Provider>
  );
};

export const useWorkflow = () => {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error('useWorkflow must be used within WorkflowProvider');
  }
  return context;
};
