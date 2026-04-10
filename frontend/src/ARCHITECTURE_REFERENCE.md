# QMS Frontend - New Architecture Reference

## 📦 Complete Component Documentation

### Core Infrastructure Components

---

## 1. WorkflowContext (✅ Created)

**File:** `src/context/WorkflowContext.tsx`

**Purpose:** Global state management for workflow tracking across pages

**Features:**
- Tracks 3 main IDs: `currentQuotationId`, `currentIndentId`, `currentPOId`
- Tracks `lastActiveEntity` for "Resume Work" functionality
- Tracks `viewingDrawer` state (which entity preview is open)
- Persists to localStorage (survives page refreshes)
- Auto-hydrates on app startup
- Clears on logout

**Exports:**
```typescript
useWorkflow() // Hook to access workflow state

WorkflowProvider // Wrapper component for App.tsx
```

**Usage:**
```tsx
import { useWorkflow } from '../context/WorkflowContext';

const workflow = useWorkflow();

// Set IDs when navigating or creating entities
workflow.setCurrentQuotationId(123);
workflow.setCurrentIndentId(456);
workflow.setCurrentPOId(789);

// Open side drawer preview
workflow.openDrawer('quotation', 123);
workflow.closeDrawer();

// Clear all state (e.g., on logout)
workflow.clearWorkflow();
```

**Data Structure:**
```typescript
{
  currentQuotationId: number | null;
  currentIndentId: number | null;
  currentPOId: number | null;
  lastActiveEntity: 'quotation' | 'indent' | 'po' | null;
  viewingDrawer: {
    type: 'quotation' | 'indent' | 'po' | null;
    id: number | null;
  };
}
```

---

## 2. SmartActionBar (✅ Created)

**File:** `src/components/SmartActionBar.tsx`

**Purpose:** Dynamic, context-aware action buttons for workflow progression

**Features:**
- Automatically determines next best action based on entity type
- Respects user permissions
- Shows primary action (button) + secondary actions (outline buttons)
- Disabled state with tooltips
- Used on all major pages

**Props:**
```typescript
interface SmartActionBarProps {
  entityType: 'quotation' | 'indent' | 'po' | 'dashboard';
  entityId?: number | null;
  entityData?: any;
  onActionComplete?: () => void;
}
```

**Behavior by Entity Type:**

| Entity | Primary Action | Secondary Actions |
|--------|---|---|
| **Quotation** | Create Indent | View Indents, Export PDF |
| **Indent** | Create PO | View POs, View Source Quotation |
| **PO** | Record Goods Receipt | Edit PO, View Source Indent |
| **Dashboard** | Resume Last Work | New Quotation, New Indent, New PO |

**Usage:**
```tsx
import SmartActionBar from '../components/SmartActionBar';

<SmartActionBar
  entityType="quotation"
  entityId={123}
  entityData={quotationObject}
  onActionComplete={() => workflow.closeDrawer()}
/>
```

---

## 3. SmartTable (✅ Created)

**File:** `src/components/SmartTable.tsx`

**Purpose:** Reusable, workflow-aware table component for lists

**Features:**
- Row click behavior (opens drawer by default)
- Inline action buttons
- Expandable rows for details
- Sticky header & action columns
- Loading state
- Empty state handling
- Full TypeScript support

**Props:**
```typescript
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
```

**Column Definition:**
```typescript
interface TableColumn<T = any> {
  key: keyof T;
  label: string;
  width?: string;
  render?: (value: any, row: T) => ReactNode;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
}
```

**Row Action Definition:**
```typescript
interface RowAction<T = any> {
  label: string;
  onClick: (row: T) => void;
  icon?: string;
  hidden?: (row: T) => boolean;
  disabled?: (row: T) => boolean;
}
```

**Usage:**
```tsx
import SmartTable, { TableColumn, RowAction } from '../components/SmartTable';

<SmartTable
  data={quotations}
  columns={[
    { key: 'quotation_no', label: 'Quote #' },
    { key: 'customer', label: 'Customer' },
    { key: 'status', label: 'Status' }
  ]}
  rowActions={[
    {
      label: 'Create Indent',
      onClick: (row) => navigate('/create-indent', { state: { quotationId: row.id } })
    }
  ]}
  onRowClick={(row) => workflow.openDrawer('quotation', row.id)}
  entityType="quotation"
  expandable={true}
  renderExpanded={(row) => <ItemDetails items={row.items} />}
/>
```

---

## 4. WorkflowDrawer (✅ Created)

**File:** `src/components/WorkflowDrawer.tsx`

**Purpose:** Right-side panel system for entity previews without navigation

**Features:**
- 30% screen width (right-aligned)
- Smooth overlay under drawer
- Loads entity data automatically
- Shows quick-access SmartActionBar
- Expandable sections (Details, Items, Related Entities)
- Auto-opens based on `viewingDrawer` state

**Components Inside:**
- `DrawerContent` - Entity-specific preview
- `Section` - Reusable content section
- `DetailRow` - Label-value row
- `StatusBadge` - Status indicator

**Data Displayed:**

**Quotation Preview:**
- Quote number, customer, date, amount
- Status badge
- Item list (first 5)
- Validity date

**Indent Preview:**
- Indent number, linked quotation, date
- Status badge
- Item list
- PO count & status

**PO Preview:**
- PO number, vendor, indent, date
- Amount, status
- Item list
- Goods receipt info (if applicable)

**Usage:**
```tsx
// In main Layout.tsx
<WorkflowDrawer /> {/* Place at bottom of Layout */}

// Trigger from anywhere
const workflow = useWorkflow();
workflow.openDrawer('quotation', 123);
```

---

## 5. WorkflowStepper (✅ Created)

**File:** `src/components/WorkflowStepper.tsx`

**Purpose:** Visual workflow progress indicator

**Features:**
- Shows 4-step workflow: Quotation → Indent → PO → (Delivery)
- Indicates completion status
- Shows current step highlight
- Displays related IDs
- Optional delivery step

**Props:**
```typescript
interface WorkflowStepperProps {
  current: 'quotation' | 'indent' | 'po' | 'delivery' | null;
  quotationId?: number | null;
  indentId?: number | null;
  poId?: number | null;
  showDelivery?: boolean;
}
```

**Visual States:**
- ⭕ Current step (blue with ring)
- ✅ Completed step (green checkmark)
- ⚪ Pending step (gray)

**Usage:**
```tsx
import WorkflowStepper from '../components/WorkflowStepper';

<WorkflowStepper
  current="indent"
  quotationId={123}
  indentId={456}
  poId={null}
  showDelivery={false}
/>
```

---

## 6. Breadcrumbs (✅ Created)

**File:** `src/components/Breadcrumbs.tsx`

**Purpose:** Contextual navigation breadcrumbs showing current location

**Features:**
- Auto-builds path from current route
- Shows workflow entities (Quotation, Indent, PO)
- Clickable entities open drawer
- Responsive and mobile-friendly

**Usage:**
```tsx
import Breadcrumbs from '../components/Breadcrumbs';

<Breadcrumbs /> {/* Add at top of pages */}
```

**Example Output:**
```
Home / Quotations / Quote #123 / Indents / Indent #456
```

---

## Integration Patterns

### Pattern 1: List Page with Workflow

```tsx
// pages/Quotations.tsx
import SmartTable from '../components/SmartTable';
import SmartActionBar from '../components/SmartActionBar';
import { useWorkflow } from '../context/WorkflowContext';

export default function Quotations() {
  const workflow = useWorkflow();
  const [quotations, setQuotations] = useState([]);

  return (
    <Layout>
      <Breadcrumbs />
      
      {/* Use SmartTable */}
      <SmartTable
        data={quotations}
        columns={[...]}
        rowActions={[...]}
        onRowClick={(row) => {
          workflow.setCurrentQuotationId(row.id);
          workflow.openDrawer('quotation', row.id); // No navigation!
        }}
      />
    </Layout>
  );
}
```

**Result:**
- ✅ Row click opens side drawer (no page navigation)
- ✅ List stays visible while previewing
- ✅ User can "Create Indent" from action bar inside drawer
- ✅ Navigation is only when they commit to creating/editing

---

### Pattern 2: Detail Page as Workflow Hub

```tsx
// pages/QuotationView.tsx
import WorkflowStepper from '../components/WorkflowStepper';
import SmartActionBar from '../components/SmartActionBar';
import { useWorkflow } from '../context/WorkflowContext';

export default function QuotationView() {
  const { id } = useParams();
  const workflow = useWorkflow();
  const [quotation, setQuotation] = useState(null);

  useEffect(() => {
    workflow.setCurrentQuotationId(Number(id));
  }, [id]);

  return (
    <Layout>
      <Breadcrumbs />
      
      {/* Workflow Progress */}
      <WorkflowStepper
        current="quotation"
        quotationId={quotation?.id}
        indentId={quotation?.indent_id}
        poId={quotation?.po_id}
      />

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content: 70% */}
        <div className="col-span-2">
          {/* Quotation Details */}
        </div>

        {/* Right Panel: 30% */}
        <div className="col-span-1 space-y-4">
          {/* Next Action */}
          <SmartActionBar
            entityType="quotation"
            entityId={quotation?.id}
            entityData={quotation}
          />

          {/* Related Indents */}
          <div className="bg-white p-4 rounded-lg border">
            <h3 className="font-semibold mb-3">Related Indents</h3>
            {quotation?.indents?.map(indent => (
              <button
                key={indent.id}
                onClick={() => workflow.openDrawer('indent', indent.id)}
                className="block w-full text-left p-2 hover:bg-gray-100"
              >
                {indent.indent_number} ({indent.status})
              </button>
            ))}
          </div>

          {/* Related POs (via Indents) */}
          <div className="bg-white p-4 rounded-lg border">
            <h3 className="font-semibold mb-3">Purchase Orders</h3>
            {quotation?.pos?.map(po => (
              <button
                key={po.id}
                onClick={() => workflow.openDrawer('po', po.id)}
                className="block w-full text-left p-2 hover:bg-gray-100"
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

**Result:**
- ✅ Workflow status visible at top
- ✅ Main content on left (70%)
- ✅ Right side shows next action + related entities
- ✅ Can click related entities to preview in drawer
- ✅ One-click "Create Indent"

---

### Pattern 3: Dashboard with Resume Work

```tsx
// pages/Dashboard.tsx
import SmartActionBar from '../components/SmartActionBar';
import { useWorkflow } from '../context/WorkflowContext';

export default function Dashboard() {
  const workflow = useWorkflow();

  return (
    <Layout>
      {/* Resume Work Section */}
      {workflow.lastActiveEntity && (
        <div className="mb-8 bg-blue-50 p-6 rounded-lg border-l-4 border-blue-500">
          <h2 className="text-lg font-semibold mb-4">Resume Work</h2>
          <SmartActionBar entityType="dashboard" />
        </div>
      )}

      {/* Regular KPI Cards */}
      {/* ... */}
    </Layout>
  );
}
```

---

## Workflow Flow Diagram

```
┌─────────────────┐
│   Dashboard     │
│ [Resume Work]   ├──────┐
└─────────────────┘      │
                         │
┌─────────────────┐       │
│  Quotations     │       │
│  (List View)    │<──────┘
│ Click row...    │
└────────┬────────┘
         │
    Opens Drawer
         │
         ▼
┌─────────────────────────┐
│ WorkflowDrawer (30%)    │
│ Shows Quote Preview     │
│ [Create Indent Button]  │
└────────┬────────────────┘
    List still visible (70%)
         │
         ▼
    Click "Create Indent"
         │
         ▼
┌─────────────────┐
│ CreateIndent    │
│  Form Page      │ ← Quotation ID pre-filled from WorkflowContext
└────────┬────────┘
         │
         ▼
    After Submit:
    workflow.setCurrentIndentId(newId)
         │
         ▼
┌─────────────────┐
│  Indents        │
│  (List View)    │
│ Can see newly   │
│ created Indent  │
└─────────────────┘
```

---

## TypeScript Interfaces Reference

### Quotation
```typescript
interface Quotation {
  id: number;
  quotation_number: string;
  customer?: { id: number; company_name: string };
  contact?: { id: number; name: string };
  items: Array<{ product_name: string; quantity: number; unit_price: number }>;
  total_value: number;
  status: 'draft' | 'pending' | 'won' | 'lost';
  validity?: {
    validity_state: 'valid' | 'due' | 'overdue' | 'expired';
    remaining_days: number;
  };
  quotation_date: string;
  created_at: string;
  
  // NEW - for workflow
  indent_count?: number;
  po_count?: number;
  indents?: Array<{ id: number; indent_number: string; status: string }>;
  purchase_orders?: Array<{ id: number; po_number: string; status: string }>;
}
```

### Indent
```typescript
interface Indent {
  id: number;
  indent_number: string;
  quotation_id?: number;
  quotation_number?: string;
  items: Array<{ product_name: string; quantity: number }>;
  total_amount: number;
  status: 'active' | 'closed';
  indent_date: string;
  
  // NEW - for workflow
  po_count?: number;
  po_status?: string;
  purchase_orders?: Array<{ id: number; po_number: string; status: string }>;
}
```

### PurchaseOrder
```typescript
interface PurchaseOrder {
  id: number;
  po_number: string;
  indent_id: number;
  indent_number?: string;
  quotation_id?: number;
  quotation_number?: string;
  vendor_name: string;
  items: Array<{ product_name: string; quantity: number; unit_price: number }>;
  total_amount: number;
  status: 'open' | 'partial_received' | 'closed';
  po_date: string;
}
```

---

## Styling Notes

### Design Tokens Used
```css
/* Colors */
--primary: #2563eb (Blue)
--success: #16a34a (Green)
--warning: #ea580c (Orange)
--danger: #dc2626 (Red)
--neutral: #6b7280 (Gray)

/* Spacing */
--base: 1rem (16px)
--half: 0.5rem (8px)
--double: 2rem (32px)

/* Border Radius */
--rounded-sm: 0.375rem (6px)
--rounded-md: 0.5rem (8px)
--rounded-lg: 0.75rem (12px)
```

### Breakpoints (Tailwind)
```css
sm: 640px
md: 768px
lg: 1024px
xl: 1280px
2xl: 1536px
```

---

## Performance Considerations

### SmartTable
- ✅ Handles 1000+ rows with virtualization opportunity
- ⚠️ Consider react-window if exceeding 5000 rows
- ✅ Memoizes column/action definitions

### WorkflowDrawer
- ✅ Lazy-loads drawer content
- ✅ Overlays don't block interaction with list
- ⚠️ Close drawer to free memory

### WorkflowContext
- ✅ Uses localStorage (10MB limit typically)
- ✅ Lightweight state (3-4 small values)
- ⚠️ Don't store entire entity data, just IDs

---

## Common Issues & Solutions

### Issue: Drawer won't open
**Solution:** Ensure `WorkflowDrawer` is placed at bottom of main Layout component

### Issue: Permissions check always fails
**Solution:** Verify `AuthContext` is wrapping ApplicationProvider and permissions are loaded before rendering protected components

### Issue: Navigation doesn't update workflow
**Solution:** Call `workflow.setCurrentXId()` before `navigate()` in SmartActionBar

### Issue: Context lost on page refresh
**Solution:** WorkflowContext automatically loads from localStorage on mount

### Issue: Drawer closes unexpectedly
**Solution:** Check if `onClick` event is bubbling - use `e.stopPropagation()` on nested buttons

---

## Next Steps

1. ✅ Create all core components (DONE)
2. ✅ Create integration guide (DONE)
3. 📝 Implement Phase 1: Add WorkflowProvider to App.tsx
4. 📝 Implement Phase 2: Add WorkflowDrawer to Layout
5. 📝 Implement Phase 3: Update Quotation list + detail
6. 📝 Implement Phase 4: Update Indent list + detail
7. 📝 Implement Phase 5: Update PO list + detail
8. 📝 Test end-to-end workflows
9. 📝 Gather user feedback and iterate

---

**Status:** Architecture documentation complete. Ready for phased implementation.
