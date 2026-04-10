import React from 'react';

/**
 * WorkflowStepper - Visual workflow progress indicator
 * 
 * Shows current position in: Quotation → Indent → PO → Delivery
 * 
 * Usage:
 * <WorkflowStepper
 *   current="indent"
 *   quotationId={123}
 *   indentId={456}
 *   poId={789}
 *   showDelivery={false}
 * />
 */

interface WorkflowStepperProps {
  current: 'quotation' | 'indent' | 'po' | 'delivery' | null;
  quotationId?: number | null;
  indentId?: number | null;
  poId?: number | null;
  showDelivery?: boolean;
}

export const WorkflowStepper: React.FC<WorkflowStepperProps> = ({
  current,
  quotationId,
  indentId,
  poId,
  showDelivery = false,
}) => {
  const steps: Array<{
    key: 'quotation' | 'indent' | 'po' | 'delivery';
    label: string;
    completed: boolean;
    current: boolean;
    id?: number;
  }> = [
    {
      key: 'quotation',
      label: 'Quotation',
      completed: quotationId !== null && quotationId !== undefined,
      current: current === 'quotation',
      id: quotationId || undefined,
    },
    {
      key: 'indent',
      label: 'Indent',
      completed: indentId !== null && indentId !== undefined,
      current: current === 'indent',
      id: indentId || undefined,
    },
    {
      key: 'po',
      label: 'PO',
      completed: poId !== null && poId !== undefined,
      current: current === 'po',
      id: poId || undefined,
    },
  ];

  if (showDelivery) {
    steps.push({
      key: 'delivery',
      label: 'Delivery',
      completed: false,
      current: current === 'delivery',
    });
  }

  return (
    <div className="flex items-center justify-between mb-8">
      {steps.map((step, idx) => (
        <React.Fragment key={step.key}>
          {/* Step Circle */}
          <div className="flex flex-col items-center">
            <div
              className={`
                w-10 h-10 rounded-full flex items-center justify-center font-semibold
                transition-all
                ${
                  step.current
                    ? 'bg-blue-600 text-white ring-4 ring-blue-200'
                    : step.completed
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-400'
                }
              `}
            >
              {step.completed && !step.current ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : (
                <span>{idx + 1}</span>
              )}
            </div>
            <span className={`mt-2 text-sm font-medium ${step.current ? 'text-blue-600' : step.completed ? 'text-green-600' : 'text-gray-600'}`}>
              {step.label}
              {step.id && <div className="text-xs text-gray-500">#{step.id}</div>}
            </span>
          </div>

          {/* Connector Line */}
          {idx < steps.length - 1 && (
            <div className="flex-1 h-1 bg-gray-200 mx-2 mb-8">
              {step.completed && (
                <div className="h-full bg-green-400 transition-all" />
              )}
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default WorkflowStepper;
