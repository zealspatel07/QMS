# QMS Frontend - Visual Workflow Reference

## 🎨 Component Interaction Map

```
┌──────────────────────────────────────────────────────────────────────┐
│                           App.tsx                                     │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │         <WorkflowProvider>  ← Wraps entire app               │  │
│  │                                                                │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │    Layout Component (Header/Sidebar/Footer)           │  │  │
│  │  │                                                        │  │  │
│  │  │  ┌──────────────────────────────────────────────────┐ │  │  │
│  │  │  │  <Breadcrumbs />                                │ │  │  │
│  │  │  │  Home / Quotations / Quote #123               │ │  │  │
│  │  │  └──────────────────────────────────────────────────┘ │  │  │
│  │  │                                                        │  │  │
│  │  │  ┌──────────────────────────────────────────────────┐ │  │  │
│  │  │  │  Page Content (Quotations / Indents / POs)     │ │  │  │
│  │  │  │                                                │ │  │  │
│  │  │  │  Uses:                                         │ │  │  │
│  │  │  │  ├─ SmartTable                                 │ │  │  │
│  │  │  │  ├─ SmartActionBar                            │ │  │  │
│  │  │  │  └─ WorkflowStepper (on detail pages)         │ │  │  │
│  │  │  │                                                │ │  │  │
│  │  │  └──────────────────────────────────────────────────┘ │  │  │
│  │  │                                                        │  │  │
│  │  │  ┌──────────────────────────────────────────────────┐ │  │  │
│  │  │  │  <WorkflowDrawer />  ← Listens to context      │ │  │  │
│  │  │  │  (Opens when drawer state changes)              │ │  │  │
│  │  │  └──────────────────────────────────────────────────┘ │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘

Shared State via useWorkflow():
  ┌────────────────────────────────┐
  │ currentQuotationId             │
  │ currentIndentId                │
  │ currentPOId                    │
  │ lastActiveEntity               │
  │ viewingDrawer { type, id }     │
  └────────────────────────────────┘
         ↓ persists to ↓
      localStorage
   (qms_workflow_state)
```

---

## 🔄 Data Flow - Quotation to PO Workflow

### Step 1: User Views Quotations List
```
┌─────────────────────────────────┐
│      Quotations List            │
│                                 │
│  [SmartTable]                   │
│  ├─ Quotation #100              │
│  ├─ Quotation #101              │
│  ├─ Quotation #102 ← user clicks │
│  └─ Quotation #103              │
│                                 │
│  Row Actions:                   │
│  ├─ [View] ← Default action    │
│  └─ [Create Indent]             │
└─────────────────────────────────┘
           ↓ onRowClick
  workflow.setCurrentQuotationId(102)
  workflow.openDrawer('quotation', 102)
           ↓
```

### Step 2: Drawer Opens (No Navigation!)
```
List (70%)              │  Drawer (30%)
                        │
Quotation #100          │  ┌──────────────────────┐
Quotation #101          │  │ Quote #102 Preview   │
Quotation #102 ← open   │  │                      │
Quotation #103          │  │ Customer: ABC        │
Quotation #104          │  │ Amount: ₹50,000      │
Quotation #105          │  │ Status: Pending      │
                        │  │                      │
                        │  │ Items:               │
                        │  │ • Product A (10 qty) │
                        │  │ • Product B (5 qty)  │
                        │  │                      │
                        │  │ [Create Indent] ← ★ │
                        │  │ [View Indents]       │
                        │  │ [Export PDF]         │
                        │  │                      │
                        │  │ [Close] ✕            │
                        │  └──────────────────────┘

List stays visible + interactive while drawer shows preview!
```

### Step 3: User Clicks "Create Indent"
```
Drawer Actions:
  Click [Create Indent]
           ↓
  1. workflow.setCurrentQuotationId(102) ← Already set
  2. workflow.closeDrawer()
  3. navigate('/create-indent', { 
       state: { 
         quotationId: 102, 
         quotationData: {...}
       } 
     })
           ↓
  Navigate to IndentForm with context pre-filled
```

### Step 4: Navigate to Indent Form
```
┌─────────────────────────────────┐
│      Create Indent Form         │
│                                 │
│  Breadcrumbs:                   │
│  Home / Quotations / Quote #102 │
│                                 │
│  From Quotation #102:           │
│  ✓ Customer: ABC (pre-filled)   │
│  ✓ Items loaded from quote      │
│                                 │
│  [Form inputs]                  │
│  ├─ Customer: ABC               │
│  ├─ Items: (checkbox list)      │
│  │  ☑ Product A (10 qty)        │
│  │  ☑ Product B (5 qty)         │
│  └─ Notes: [__________]         │
│                                 │
│  [Submit] → Creates Indent      │
└─────────────────────────────────┘
           ↓
  After submit:
  - New Indent created (#45)
  - workflow.setCurrentIndentId(45)
```

### Step 5: Navigate to Indent Detail
```
┌────────────────────────────────────┐
│      Indent #45 Detail             │
│                                    │
│  Breadcrumbs:                      │
│  Home / Indents / Indent #45       │
│                                    │
│  [WorkflowStepper]                 │
│  ① Quotation #102 ✓ Complete      │
│  ② Indent #45 🔵 Current          │
│  ③ PO ⚪ Not Started              │
│                                    │
│  Left Panel (70%)    │ Right (30%) │
│  ├─ Details          │ SmartActBar │
│  ├─ Items            │ [Create PO] │
│  └─ Timeline         │ [View POs]  │
│                      │ [Close]     │
│                      │             │
│                      │ Related:    │
│                      │ > Quote #102│
└────────────────────────────────────┘
           ↓ Click [Create PO]
  Similar flow as above...
```

### Step 6: Workflow Complete
```
Dashboard Resume Work Section:
╔════════════════════════════════════╗
║  Resume Work                        ║
║  Last active: indent               ║
║                                    ║
║  ✓ Quotation #102 (Done)           ║
║  ✓ Indent #45 (Done)               ║
║  ⏳ PO #89 (In Progress)            ║
║                                    ║
║  [Continue where you left off] ←   ║
║  Button: View PO #89               ║
╚════════════════════════════════════╝
```

---

## 🎯 SmartActionBar - Logic Decision Tree

```
SmartActionBar receives:
├─ entityType: 'quotation'|'indent'|'po'|'dashboard'
├─ entityId: number
├─ entityData: object
└─ permissions: {...}

         ↓
    Route on entityType
         ↓
    ┌────┴────┬────────┬────────┬───────────┐
    ↓         ↓        ↓        ↓           ↓
quotation   indent     po    dashboard   unknown
    ↓         ↓        ↓        ↓
[Primary]  [Primary] [Primary] [Primary]
Create     Create     Record   Resume
Indent     PO         Receipt  Work
    ↓         ↓        ↓        ↓
[Secondary][Secondary][Sec]  [Secondary]
View       View       Edit    New
Indents    POs        PO      Quotation
          View                New
          Quotation           Indent
                              New PO
    ∧         ∧        ∧        ∧
    └─────────┴────────┴────────┘
 Check permissions
 before enabling
```

---

## 📱 Layout Evolution

### Before Refactoring
```
┌─────────────────────────────────┐
│        Header                   │
├──────────────┬──────────────────┤
│              │                  │
│  Sidebar     │  Main Content    │
│              │  (max-width      │
│              │   constraints)   │
│              │                  │
│              │  Full page loads │
│              │  on every action │
└──────────────┴──────────────────┘
```

### After Refactoring (Phase 1)
```
┌─────────────────────────────────┐
│     Breadcrumbs                 │
│  Home / Quotations / Quote #123 │
├──────────────────────────────────┤
│                                  │
│  Sidebar  │  Page 1   │ Drawer   │
│           │  (70%)    │ (30%)    │
│           │           │ Preview  │
│           │ Full width│ Non-     │
│           │ minus 30% │ blocking │
│           │           │          │
└──────────────────────────────────┘
```

---

## 💾 LocalStorage State Lifecycle

```
App Starts
    ↓
localStorage.getItem('qms_workflow_state')
    ↓
Found?
├─ Yes → Parse JSON → Hydrate WorkflowContext
│          Workflow state restored! ✅
│          (User resume where they left off)
│          
└─ No → Use default empty state
       (First time or cleared)
    ↓
User Navigates
    ↓
   workflow.setCurrentQuotationId(123)
    ↓
   useEffect() saves to localStorage
    ↓
   localStorage.setItem('qms_workflow_state', JSON.stringify(state))
    ↓
   State persisted ✅
    ↓
User Logs Out
    ↓
   workflow.clearWorkflow()
    ↓
   localStorage.removeItem('qms_workflow_state')
    ↓
   Clean state ✅
```

---

## 🎬 Animation Flow - Drawer Opening

```
Timeline: 0ms → 500ms

0ms:     Drawer Closed
         ┌─────────┐
         │ Overlay │ opacity: 0
         └─────────┘

100ms:   Drawer Starting
         Content still loading
         
300ms:   Drawer Sliding In
         ┌─────────────┐
         │ Drawer      │
         │ transform:  │
         │ translateX  │
         │ (right)     │
         └─────────────┘

500ms:   Drawer Open & Content Loaded
         ┌──────────────────┐
         │  Quote Details   │
         │  [Action Buttons]│
         ├──────────────────┤
         │  [SmartActionBar]│
         │  [Create Indent])│
         └──────────────────┘
         
Interaction: Smooth, non-blocking
```

---

## 🔍 Permissions Check Flow

```
SmartActionBar renders action buttons
    ↓
For each potential action:
    ├─ Check permissions[action]
    │
    ├─ canCreateIndent?
    │  ├─ true  → Button enabled, clickable
    │  └─ false → Button disabled, tooltip shown
    │
    ├─ canCreatePO?
    │  ├─ true  → Button enabled, clickable
    │  └─ false → Button disabled, grayed out
    │
    └─ canViewIndents?
       ├─ true  → Show action
       └─ false → Hide action completely
    ↓
All permission checks done
Button state reflects actual permissions ✅
```

---

## 📊 Data Model - Workflow State

```
WorkflowContext State:
{
  // Current entity IDs
  currentQuotationId: 123 | null,     // Active quotation
  currentIndentId: 456 | null,        // Active indent
  currentPOId: 789 | null,            // Active PO

  // For Resume functionality
  lastActiveEntity: 'quotation' | 'indent' | 'po' | null,

  // Drawer state
  viewingDrawer: {
    type: 'quotation' | 'indent' | 'po' | null,  // What's open?
    id: 123 | null                               // Which entity?
  }
}

  ↓ Persisted to ↓

localStorage['qms_workflow_state'] = JSON.stringify(state)

  ↓ On page like /quotation-view/123 ↓

useEffect(() => {
  workflow.setCurrentQuotationId(123)  // Set context
}, [id])

  ↓ Displayed in ↓

<WorkflowStepper
  current="quotation"
  quotationId={123}
  indentId={456}
/>

Shows: ① Quotation #123 🔵 Current
       ② Indent #456 ✓ Done
       ③ PO ⚪ Not Started
```

---

## 🎯 Component Usage Examples

### SmartTable Example
```jsx
<SmartTable
  data={quotations}
  columns={[
    { key: 'quotation_no', label: 'Quote #', width: '100px' },
    { key: 'customer', label: 'Customer' },
    { key: 'status', label: 'Status' }
  ]}
  rowActions={[
    { label: 'View', onClick: (row) => navigate(`/quote/${row.id}`) },
    { label: 'Create Indent', onClick: (row) => navigate('/indent/new', { state: { quotationId: row.id } }) }
  ]}
  onRowClick={(row) => workflow.openDrawer('quotation', row.id)}
/>

Output:
┌──────────────────────────────────────────────────────┐
│ Quote # │ Customer    │ Status  │ Actions            │
├──────────────────────────────────────────────────────┤
│ 100     │ ABC Corp    │ Pending │ [View] [Create...] │  ← Hover shows actions
│ 101     │ XYZ Ltd     │ Draft   │ [View] [Create...] │
│ 102     │ DEF Inc     │ Won     │ [View] [Create...] │
└──────────────────────────────────────────────────────┘
When row clicked: Drawer opens with preview
When action clicked: Navigate to form with context
```

### SmartActionBar Example
```jsx
<SmartActionBar
  entityType="indent"
  entityId={456}
  entityData={indentObject}
/>

Logic:
indentObject exists?
  Yes → Show "Create PO" primary button
        Show secondary: "View POs", "View Quotation"
  No → No buttons (hidden)

permissions.canCreatePO?
  Yes → Button enabled
  No → Button disabled + grayed

Output:
┌─────────────────────────────────────────┐
│ [Create Purchase Order]                 │ Primary = Blue
│ [View POs] [View Source Quotation]      │ Secondary = Outline
└─────────────────────────────────────────┘
```

---

## 🚀 Performance Profile (Expected)

```
Operation                   │ Time    │ Impact
────────────────────────────┼─────────┼────────────
App Load (with context)     │ ~0ms    │ Negligible
SmartTable render (10 rows) │ ~50ms   │ Fast
SmartTable render (100 rows)│ ~200ms  │ Acceptable
Drawer open (with fetch)    │ ~300ms  │ Smooth
localStorage save           │ ~20ms   │ Negligible
localStorage load           │ ~10ms   │ Negligible
Navigation (page change)    │ ~500ms  │ No change
                            │         │ (from app)

Cumulative app startup:
Bootstrap    : ~100ms
Context load : ~10ms  ← NEW, minimal
Page render  : ~200ms
Total        : ~310ms (minimal impact)
```

---

## ✅ Verification Checklist (Developers)

After implementing each phase:

- [ ] No TypeScript errors
- [ ] No console warnings/errors
- [ ] localStorage has `qms_workflow_state` key
- [ ] Breadcrumbs appear on all pages
- [ ] Drawer opens/closes smoothly
- [ ] SmartActionBar shows buttons
- [ ] SmartTable rows are clickable
- [ ] Drawer stays visible when list scrolls
- [ ] Permissions respected (buttons disabled appropriately)
- [ ] Context persists after page refresh
- [ ] Mobile view responsive (no broken layout)

---

## 🎓 Common Patterns Explained

### Pattern 1: Context-Aware Rendering
```jsx
// SmartActionBar checks entity type and shows appropriate actions
const actions = useMemo(() => {
  switch(entityType) {
    case 'quotation':
      return [{ label: 'Create Indent', ... }];
    case 'indent':
      return [{ label: 'Create PO', ... }];
    // ...
  }
}, [entityType, permissions]);
```

### Pattern 2: Drawer State Management
```jsx
// Open drawer by updating context
workflow.openDrawer('quotation', 123);

// WorkflowDrawer listens to state
useEffect(() => {
  if (viewingDrawer.type) {
    fetchData(viewingDrawer.id);  // Auto-load when drawer opens
  }
}, [viewingDrawer])
```

### Pattern 3: Session Context Passing
```jsx
// Navigate with pre-filled context
navigate('/create-indent', {
  state: {
    quotationId: 123,
    quotationData: quotationObject  // Pass data too
  }
});

// In form page, also set context
workflow.setCurrentQuotationId(123);
```

---

**End of Visual Reference Guide** 📚

For detailed implementation, see:
- `QUICKSTART.md` - Get started in 20 min
- `WORKFLOW_INTEGRATION_GUIDE.md` - Complete guide
- `ARCHITECTURE_REFERENCE.md` - Component details
