# QMS Frontend Refactoring - Comprehensive Integration Guide

## 📑 TABLE OF CONTENTS
1. [Architecture Overview](#architecture-overview)
2. [Component Map](#component-map)
3. [Step-by-Step Integration](#step-by-step-integration)
4. [Updated App Structure](#updated-app-structure)
5. [API Requirements](#api-requirements)
6. [Testing Checklist](#testing-checklist)

---

## ARCHITECTURE OVERVIEW

### Workflow Sequence
```
Quotation (Optional) → Indent → Purchase Order(s) → Delivery
```

### Key Features

#### 1. **Global WorkflowContext**
- Tracks: `currentQuotationId`, `currentIndentId`, `currentPOId`, `lastActiveEntity`
- Persists to `localStorage` for resume capability
- Auto-hydrates on app load
- Clears on logout

#### 2. **SmartActionBar Component**
- Displays next available action based on context
- Role-aware (checks user permissions)
- Auto-hidden if no actions available
- Used on all major pages

#### 3. **SmartTable Component**
- Replaces standard HTML tables
- Features:
  - Row click auto-opens side drawer
  - Inline actions (View, Create Indent, etc.)
  - Expandable rows for item details
  - Sticky header & actions column
  - Full type safety with TypeScript

#### 4. **WorkflowDrawer System**
- Right-side drawer (30% screen width)
- Shows entity preview (Quotation/Indent/PO)
- Quick-access actions without navigation
- Non-blocking (keeps list visible)

#### 5. **Breadcrumb Navigation**
- Shows current location in workflow
- Context-aware (changes per entity)
- Supports drilling down and back

---

## COMPONENT MAP

### New Components (Create These)

```
src/components/
├── SmartActionBar.tsx          ✅ CREATED
├── SmartTable.tsx              ✅ CREATED
├── WorkflowDrawer.tsx          ✅ CREATED
├── Breadcrumbs.tsx             📝 TO CREATE
├── WorkflowStepper.tsx         📝 TO CREATE (for detail pages)
├── QuotationPreviewCard.tsx    📝 TO CREATE
├── IndentPreviewCard.tsx       📝 TO CREATE
├── POPreviewCard.tsx           📝 TO CREATE
└── ResumeWorkCard.tsx          📝 TO CREATE

src/context/
├── AuthContext.tsx             ✅ EXISTS (no changes)
└── WorkflowContext.tsx         ✅ CREATED

src/pages/
├── Quotations.tsx              ✅ EXISTS (enhance gradually)
├── QuotationsRefactored.tsx    ✅ EXAMPLE
├── Indents.tsx                 ✅ EXISTS (enhance gradually)
├── IndentsRefactored.tsx       ✅ EXAMPLE
└── PurchaseOrders.tsx          ✅ EXISTS (enhance gradually)
```

---

## STEP-BY-STEP INTEGRATION

### PHASE 1: Setup (1-2 hours)

#### Step 1.1: Add WorkflowProvider to App.tsx

**File:** `src/App.tsx`

```tsx
import { WorkflowProvider } from './context/WorkflowContext';

function App() {
  return (
    <WorkflowProvider>
      {/* existing routes */}
    </WorkflowProvider>
  );
}
```

**Why:** Enables WorkflowContext access to all pages

#### Step 1.2: Add WorkflowDrawer to main Layout

**File:** `src/components/layout/Layout.tsx`

```tsx
import WorkflowDrawer from './WorkflowDrawer';

export default function Layout({ children }) {
  return (
    <div>
      {/* existing header, sidebar, etc */}
      {children}
      <WorkflowDrawer />  {/* Add this at bottom */}
    </div>
  );
}
```

**Why:** Drawer must be present on all pages for context switching

---

### PHASE 2: Dashboard Enhancement (2-3 hours)

#### Step 2.1: Update Dashboard to show "Resume Work"

**File:** `src/pages/Dashboard.tsx` (or SalesDashboard.tsx)

Add at the top of dashboard cards:

```tsx
import { useWorkflow } from '../context/WorkflowContext';
import SmartActionBar from '../components/SmartActionBar';

export default function Dashboard() {
  const workflow = useWorkflow();

  // In the JSX:
  return (
    <Layout>
      <div>
        {/* Resume Work Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Resume Work</h2>
          {workflow.lastActiveEntity ? (
            <SmartActionBar 
              entityType="dashboard"
              entityData={{ 
                lastEntity: workflow.lastActiveEntity,
                lastQuotationId: workflow.currentQuotationId,
                lastIndentId: workflow.currentIndentId,
                lastPOId: workflow.currentPOId,
              }}
            />
          ) : (
            <div className="text-gray-600">No recent activity</div>
          )}
        </div>

        {/* Existing KPI Cards */}
        {/* ... */}
      </div>
    </Layout>
  );
}
```

**Why:** Enables one-click resume from dashboard

---

### PHASE 3: Quotation Module (3-4 hours)

#### Step 3.1: Enhance QuotationList

**File:** `src/pages/Quotations.tsx`

**Strategy:** Add features incrementally to existing component

```tsx
import { useWorkflow } from '../context/WorkflowContext';
import SmartActionBar from '../components/SmartActionBar';

export default function Quotations() {
  const workflow = useWorkflow();
  // ... existing code ...

  // Add workflow tracking on row click
  const handleRowClick = (quotation: Q) => {
    workflow.setCurrentQuotationId(quotation.id);
    navigate(`/quotations/${quotation.id}`);
  };

  // Update JSX: existing table rows
  // Change: onClick={() => navigate(`/quotations/${r.id}`)}
  // To:      onClick={() => handleRowClick(r)}

  // Add new column: "Indent Status" + "PO Count"
  // Add new action buttons: inline "Create Indent"
}
```

**Alternatively:** Use the `QuotationsRefactored.tsx` as a complete example

#### Step 3.2: Enhance QuotationDetail Page

**File:** `src/pages/QuotationView.tsx` (or similar)

Add:

```tsx
import { useWorkflow } from '../context/WorkflowContext';
import SmartActionBar from '../components/SmartActionBar';
import WorkflowStepper from '../components/WorkflowStepper';

export default function QuotationView() {
  const { id } = useParams();
  const workflow = useWorkflow();
  const [quotation, setQuotation] = useState(null);

  useEffect(() => {
    // Load quotation
    workflow.setCurrentQuotationId(Number(id));
  }, [id]);

  return (
    <Layout>
      <div className="grid grid-cols-3 gap-6">
        {/* Main content: 70% width */}
        <div className="col-span-2">
          {/* Workflow Stepper */}
          <WorkflowStepper
            current="quotation"
            quotationId={quotation?.id}
            indentId={quotation?.indent_id}
            poId={quotation?.po_id}
          />

          {/* Quotation Details */}
          {/* ... existing content ... */}
        </div>

        {/* Right Panel: 30% width - Related Entities */}
        <div className="col-span-1 space-y-4">
          <SmartActionBar
            entityType="quotation"
            entityId={Number(id)}
            entityData={quotation}
          />

          {/* Related Indents Section */}
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h3 className="font-semibold mb-3">Related Indents</h3>
            {quotation?.indents?.map(indent => (
              <button
                key={indent.id}
                onClick={() => workflow.openDrawer('indent', indent.id)}
                className="block w-full text-left p-2 hover:bg-gray-100 rounded text-sm"
              >
                {indent.indent_number} ({indent.status})
              </button>
            ))}
          </div>

          {/* Related POs Section */}
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h3 className="font-semibold mb-3">Purchase Orders</h3>
            {quotation?.pos?.map(po => (
              <button
                key={po.id}
                onClick={() => workflow.openDrawer('po', po.id)}
                className="block w-full text-left p-2 hover:bg-gray-100 rounded text-sm"
              >
                {po.po_number} ({po.status})
              </button>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
```

---

### PHASE 4: Indent Module (3-4 hours)

#### Step 4.1: Enhance IndentList

**File:** `src/pages/Indent.tsx`

```tsx
import SmartTable, { TableColumn, RowAction } from '../components/SmartTable';
import { useWorkflow } from '../context/WorkflowContext';

export default function Indent() {
  const workflow = useWorkflow();

  // Add columns:
  const columns: TableColumn[] = [
    { key: 'indent_number', label: 'Indent #' },
    { 
      key: 'quotation_number', 
      label: 'Quotation',
      render: (val, row) => (
        <button
          onClick={() => workflow.openDrawer('quotation', row.quotation_id)}
          className="text-blue-600 hover:underline"
        >
          {val || 'Direct'}
        </button>
      )
    },
    { key: 'po_count', label: 'POs Created' },
    { key: 'status', label: 'Status' },
  ];

  // Add actions:
  const rowActions: RowAction[] = [
    {
      label: 'Create PO',
      onClick: (row) => {
        workflow.setCurrentIndentId(row.id);
        navigate('/create-po', { state: { indentId: row.id } });
      }
    }
  ];

  return (
    <SmartTable
      data={indents}
      columns={columns}
      rowActions={rowActions}
      expandable={true}
      renderExpanded={(row) => <ItemDetails items={row.items} />}
    />
  );
}
```

---

### PHASE 5: Purchase Order Module (2-3 hours)

#### Step 5.1: Enhance PurchaseOrderList

**File:** `src/pages/PurchaseOrders.tsx`

```tsx
const columns: TableColumn[] = [
  { key: 'po_number', label: 'PO #' },
  { 
    key: 'indent_number', 
    label: 'Indent',
    render: (val, row) => (
      <button
        onClick={() => workflow.openDrawer('indent', row.indent_id)}
        className="text-blue-600 hover:underline"
      >
        {val}
      </button>
    )
  },
  { 
    key: 'quotation_number', 
    label: 'Quotation (via Indent)',
    render: (val, row) => (
      <span className="text-gray-600">
        {row.quotation_number || '—'}
      </span>
    )
  },
  { key: 'vendor_name', label: 'Vendor' },
  { key: 'status', label: 'Status' },
];
```

---

### PHASE 6: Layout Improvements (2-3 hours)

#### Step 6.1: Update Global Layout for Full-Width

**File:** `src/components/layout/Layout.tsx`

```tsx
export default function Layout({ children }) {
  return (
    <div className="flex flex-col h-screen">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        {/* Remove max-width constraint */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
        {/* Drawer overlay will appear here */}
      </div>
      <Footer />
    </div>
  );
}
```

#### Step 6.2: Create Breadcrumb Component

**File:** `src/components/Breadcrumbs.tsx`

```tsx
import { useWorkflow } from '../context/WorkflowContext';
import { Link } from 'react-router-dom';

export const Breadcrumbs = () => {
  const workflow = useWorkflow();

  const breadcrumbs = [];

  if (workflow.currentQuotationId) {
    breadcrumbs.push({
      label: `Quotation #${workflow.currentQuotationId}`,
      action: () => workflow.openDrawer('quotation', workflow.currentQuotationId!),
    });
  }

  if (workflow.currentIndentId) {
    breadcrumbs.push({
      label: `Indent #${workflow.currentIndentId}`,
      action: () => workflow.openDrawer('indent', workflow.currentIndentId!),
    });
  }

  if (workflow.currentPOId) {
    breadcrumbs.push({
      label: `PO #${workflow.currentPOId}`,
      action: () => workflow.openDrawer('po', workflow.currentPOId!),
    });
  }

  return (
    <nav className="flex items-center gap-2 text-sm mb-4">
      <Link to="/" className="text-gray-600 hover:text-gray-900">Home</Link>
      {breadcrumbs.map((crumb, idx) => (
        <React.Fragment key={idx}>
          <span className="text-gray-400">/</span>
          <button
            onClick={crumb.action}
            className="text-blue-600 hover:text-blue-900"
          >
            {crumb.label}
          </button>
        </React.Fragment>
      ))}
    </nav>
  );
};

export default Breadcrumbs;
```

---

## UPDATED APP STRUCTURE

### Complete File Tree After Refactoring

```
frontend/src/
├── api.ts                          (no changes)
├── App.tsx                         ⭐ UPDATED (add WorkflowProvider)
├── context/
│   ├── AuthContext.tsx             (no changes)
│   └── WorkflowContext.tsx         ✅ NEW
├── components/
│   ├── SmartActionBar.tsx          ✅ NEW
│   ├── SmartTable.tsx              ✅ NEW
│   ├── WorkflowDrawer.tsx          ✅ NEW
│   ├── Breadcrumbs.tsx             📝 NEW (create)
│   ├── WorkflowStepper.tsx         📝 NEW (create)
│   ├── layout/
│   │   └── Layout.tsx              ⭐ UPDATED (add drawer, breadcrumbs)
│   └── ... existing components
├── pages/
│   ├── Quotations.tsx              ⭐ ENHANCED (gradually)
│   ├── QuotationsRefactored.tsx    📚 REFERENCE (optional)
│   ├── Indents.tsx                 ⭐ ENHANCED (gradually)
│   ├── IndentsRefactored.tsx       📚 REFERENCE (optional)
│   ├── PurchaseOrders.tsx          ⭐ ENHANCED (gradually)
│   └── ... existing pages
└── utils/
    └── ... existing utilities
```

---

## API REQUIREMENTS

### Required API Methods

Ensure these exist in `api.ts`:

```typescript
// Quotations
api.getQuotations(filters?: { status?: string }) ✅
api.getQuotationById(id: number) - ensure it returns linked indents/pos
api.deleteQuotation(id: number)

// Indents
api.getIndents(filters?: { status?: string, quotation_id?: number })
api.getIndentById(id: number) - ensure it returns items + po_count
api.createIndent(data: any)

// POs
api.getPOs(filters?: { status?: string, indent_id?: number })
api.getPOById(id: number)
api.createPO(data: any)
```

### Recommended API Enhancements

Add to existing API calls to support drawer functionality:

```typescript
// Quotation response should include:
{
  id: number;
  quotation_number: string;
  // ... existing fields ...
  indent_count?: number;              // NEW
  po_count?: number;                  // NEW
  indents?: Array<{ id, indent_number, status }>;  // NEW
  purchase_orders?: Array<{ id, po_number, status }>;  // NEW
}

// Indent response should include:
{
  id: number;
  indent_number: string;
  // ... existing fields ...
  quotation_id?: number;              // ENSURE exists
  quotation_number?: string;          // NEW
  po_count?: number;                  // NEW
  po_status?: string;                 // NEW (aggregated)
  purchase_orders?: Array<{ id, po_number, status }>;  // NEW
}

// PO response should include:
{
  id: number;
  po_number: string;
  // ... existing fields ...
  indent_id?: number;                 // ENSURE exists
  indent_number?: string;             // NEW
  quotation_id?: number;              // NEW
  quotation_number?: string;          // NEW
}
```

**Note:** If API changes require backend updates, those are out of scope. Focus on using existing API data.

---

## TESTING CHECKLIST

### ✅ Functional Tests

- [ ] WorkflowContext persists to localStorage
- [ ] Workflow state resets on logout
- [ ] SmartActionBar shows correct next action per page
- [ ] Row click opens side drawer (not navigation)
- [ ] Drawer preview loads data correctly
- [ ] Breadcrumbs navigate to correct entities
- [ ] Create Indent from Quotation preserves ID in context
- [ ] Create PO from Indent preserves ID in context
- [ ] Dashboard "Resume Work" button works
- [ ] Permissions correctly hide/show actions

### ✅ UX Tests

- [ ] Quotation → Indent in ≤ 3 clicks
- [ ] Indent → PO in ≤ 3 clicks
- [ ] No page refresh needed for state updates
- [ ] Drawer doesn't block main list view
- [ ] Back navigation doesn't lose context
- [ ] Can open multiple drawer previews in sequence

### ✅ Mobile/Responsive Tests

- [ ] Drawer appears correctly on mobile (full height)
- [ ] Table columns stack properly on small screens
- [ ] Actions remain accessible on touch devices
- [ ] Breadcrumbs collapse on small screens

### ✅ Performance Tests

- [ ] SmartTable renders 1000+ rows smoothly
- [ ] Drawer opens/closes without jank
- [ ] No recursive rendering in useEffect
- [ ] No memory leaks in localStorage

---

## MIGRATION STRATEGY

### Recommended Order

1. **Step 1:** Add WorkflowProvider & WorkflowDrawer (foundation)
2. **Step 2:** Update Dashboard with SmartActionBar
3. **Step 3:** Add Breadcrumbs to Layout
4. **Step 4:** Enhance Quotations list + detail
5. **Step 5:** Enhance Indents list + detail
6. **Step 6:** Enhance POs list + detail
7. **Step 7:** Test end-to-end workflow
8. **Step 8:** Remove reference components (QuotationsRefactored, IndentsRefactored)

### Low-Risk Approach

- Keep existing pages intact
- Add new components side-by-side
- Test new features on parallel routes before migration
- Use feature flags if needed: `if (useNewWorkflow) { ... }`

---

## SUMMARY

### Key Files to Create (✅ = Done)

- ✅ `WorkflowContext.tsx` - Global state management
- ✅ `SmartActionBar.tsx` - Context-aware actions
- ✅ `SmartTable.tsx` - Reusable table component
- ✅ `WorkflowDrawer.tsx` - Side panel system
- 📝 `Breadcrumbs.tsx` - Navigation crumbs
- 📝 `WorkflowStepper.tsx` - Status indicator

### Files to Modify

- 🔄 `App.tsx` - Add WorkflowProvider
- 🔄 `Layout.tsx` - Add WorkflowDrawer + Breadcrumbs
- 🔄 `Quotations.tsx` - Add tracking + actions
- 🔄 `Indents.tsx` - Add linked quotations + PO creation
- 🔄 `PurchaseOrders.tsx` - Show source indent

### Estimated Timeline

- Phase 1 (Setup): 1-2 hours
- Phase 2 (Dashboard): 2-3 hours
- Phase 3 (Quotations): 3-4 hours
- Phase 4 (Indents): 3-4 hours
- Phase 5 (POs): 2-3 hours
- Phase 6 (Layout): 2-3 hours
- Testing: 2-3 hours

**Total: ~18-26 hours** of development work

---

## SUCCESS METRICS

✅ Quotation → PO in ≤ 3 clicks  
✅ No context loss between pages  
✅ Each page suggests next action  
✅ System feels like connected workflow, not separate modules  
✅ Mobile responsive  
✅ No background errors in console  
✅ Drawer doesn't break existing functionality  

---

**Next Step:** Start with Phase 1 (Setup) to establish the context foundation.
