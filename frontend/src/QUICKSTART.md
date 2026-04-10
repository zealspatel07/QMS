# QMS Frontend Refactoring - Quick Start Guide

## 🚀 Start Here: 5-Minute Setup

This guide gets you from 0 to basic workflow integration in under an hour.

---

## ✅ PHASE 1: Foundation Setup (20 minutes)

### Step 1: Verify New Files Exist

Check that these files have been created:

```bash
# Run this check
ls -la src/context/WorkflowContext.tsx
ls -la src/components/SmartActionBar.tsx
ls -la src/components/SmartTable.tsx
ls -la src/components/WorkflowDrawer.tsx
ls -la src/components/WorkflowStepper.tsx
ls -la src/components/Breadcrumbs.tsx
```

All 6 files should exist. ✅

### Step 2: Update App.tsx

**File:** `src/App.tsx`

Find your main `<App>` or `<ProtectedApp>` component and wrap it with `WorkflowProvider`:

```tsx
import { WorkflowProvider } from './context/WorkflowContext';

// Find your main app component (could be App, ProtectedApp, or Router wrapper)

// BEFORE:
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* routes */}
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

// AFTER:
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WorkflowProvider>  {/* ADD THIS */}
          <Routes>
            {/* routes */}
          </Routes>
        </WorkflowProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
```

**Purpose:** Makes `useWorkflow()` available to all pages

✅ **Test:** App should still load without errors

---

### Step 3: Update Layout.tsx

**File:** `src/components/layout/Layout.tsx`

Add the WorkflowDrawer at the bottom:

```tsx
import WorkflowDrawer from '../WorkflowDrawer';
import Breadcrumbs from '../Breadcrumbs';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col h-screen bg-white">
      <Header />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        
        <main className="flex-1 overflow-y-auto">
          <div className="px-6 py-4">
            <Breadcrumbs />  {/* ADD BREADCRUMBS */}
            {children}
          </div>
        </main>
      </div>

      <Footer />
      
      {/* ADD DRAWER AT THE END */}
      <WorkflowDrawer />
    </div>
  );
}
```

**Purpose:**
- Breadcrumbs show workflow navigation
- WorkflowDrawer enables side-panel previews

✅ **Test:** 
- Load any page
- Should see breadcrumbs at top (all "Home")
- Should see no errors in console

---

## ✅ PHASE 2: Dashboard Enhancement (20 minutes)

### Step 4: Update Dashboard

**File:** `src/pages/Dashboard.tsx` (or `SalesDashboard.tsx`)

Add "Resume Work" section:

```tsx
import { useWorkflow } from '../context/WorkflowContext';
import SmartActionBar from '../components/SmartActionBar';

export default function Dashboard() {
  const workflow = useWorkflow();
  
  // ... existing dashboard logic ...

  return (
    <Layout>
      {/* NEW: Resume Work Section */}
      {workflow.lastActiveEntity && (
        <div className="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Resume Work</h2>
            <span className="text-sm text-gray-600">Last active: {workflow.lastActiveEntity}</span>
          </div>
          
          <SmartActionBar 
            entityType="dashboard"
            entityData={{
              lastEntity: workflow.lastActiveEntity,
              lastQuotationId: workflow.currentQuotationId,
              lastIndentId: workflow.currentIndentId,
              lastPOId: workflow.currentPOId,
            }}
          />
        </div>
      )}

      {/* Existing KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* ... existing cards ... */}
      </div>

      {/* Rest of dashboard ... */}
    </Layout>
  );
}
```

✅ **Test:**
1. Navigate to a quotation
2. Go back to dashboard
3. Should see "Resume Work" section with button
4. Click button should go back to quotation

---

## ✅ PHASE 3: Add to One List Page (20 minutes)

### Step 5: Enhance Quotations List (or Indents/POs)

**File:** `src/pages/Quotations.tsx`

Add workflow tracking:

```tsx
import { useWorkflow } from '../context/WorkflowContext';

export default function Quotations() {
  const navigate = useNavigate();
  const workflow = useWorkflow();  // ADD THIS
  
  // ... existing state and logic ...

  // Find where rows are clicked on table
  // BEFORE:
  // <tr onClick={() => navigate(`/quotations/${r.id}`)}>

  // AFTER:
  // <tr onClick={() => {
  //   workflow.setCurrentQuotationId(r.id);  // ADD THIS LINE
  //   navigate(`/quotations/${r.id}`);
  // }}>

  return (
    <Layout>
      {/* existing table code, but update row click */}
      <table>
        <tbody>
          {quotations.map(r => (
            <tr
              key={r.id}
              onClick={() => {
                workflow.setCurrentQuotationId(r.id);  // ADD THIS
                navigate(`/quotations/${r.id}`);
              }}
            >
              {/* existing columns */}
            </tr>
          ))}
        </tbody>
      </table>
    </Layout>
  );
}
```

✅ **Test:**
1. Click a quotation in list
2. Should go to detail page
3. In DevTools, check localStorage key: `qms_workflow_state`
4. Should see `currentQuotationId` set

---

## ✅ PHASE 4: Add to Detail Page (20 minutes)

### Step 6: Enhance Quotation Detail Page

**File:** `src/pages/QuotationView.tsx` (or similar detail page)

Add SmartActionBar:

```tsx
import { useWorkflow } from '../context/WorkflowContext';
import SmartActionBar from '../components/SmartActionBar';
import WorkflowStepper from '../components/WorkflowStepper';
import { useParams } from 'react-router-dom';

export default function QuotationView() {
  const { id } = useParams();
  const workflow = useWorkflow();
  const [quotation, setQuotation] = useState(null);

  // Set workflow context when page loads
  useEffect(() => {
    workflow.setCurrentQuotationId(Number(id));
    loadQuotation();
  }, [id]);

  const loadQuotation = async () => {
    const data = await api.getQuotationById(Number(id));
    setQuotation(data);
  };

  return (
    <Layout>
      {/* Workflow Progress */}
      <WorkflowStepper
        current="quotation"
        quotationId={quotation?.id}
        indentId={quotation?.indent_id || null}
      />

      {/* Main Content - Two Column Layout */}
      <div className="grid grid-cols-3 gap-6">
        
        {/* Left Side: Main Content (70%) */}
        <div className="col-span-2">
          {/* Existing quotation details */}
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h1 className="text-2xl font-bold mb-4">{quotation?.quotation_number}</h1>
            <p className="text-gray-600 mb-6">Customer: {quotation?.customer?.company_name}</p>
            {/* ... more details ... */}
          </div>
        </div>

        {/* Right Side: Actions & Context (30%) */}
        <div className="col-span-1 space-y-4">
          {/* Smart Action Bar */}
          <SmartActionBar
            entityType="quotation"
            entityId={quotation?.id}
            entityData={quotation}
          />

          {/* Related Indents */}
          {quotation?.indents && quotation.indents.length > 0 && (
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-3">Related Indents</h3>
              <div className="space-y-2">
                {quotation.indents.map(indent => (
                  <button
                    key={indent.id}
                    onClick={() => workflow.openDrawer('indent', indent.id)}
                    className="block w-full text-left p-2 hover:bg-blue-50 rounded transition"
                  >
                    <div className="font-medium text-blue-600">{indent.indent_number}</div>
                    <div className="text-xs text-gray-500">{indent.status}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
```

✅ **Test:**
1. Navigate to quotation detail
2. Should see workflow stepper at top
3. Should see "Create Indent" button on right panel
4. Should see related indents (if any) - click them to preview in drawer

---

## 🎯 Testing Checklist

### Unit Tests

- [ ] WorkflowContext persists to localStorage
- [ ] WorkflowContext clears on logout
- [ ] SmartActionBar shows button for quotation entity
- [ ] SmartTable renders without errors
- [ ] WorkflowDrawer opens/closes

### Integration Tests

- [ ] Can navigate Quotation → Detail → Drawer
- [ ] "Create Indent" from drawer opens form
- [ ] Resume Work section appears on dashboard
- [ ] Breadcrumbs update as you navigate
- [ ] No console errors

### User Flow Tests

- [ ] Quotation → Indent in ≤ 3 clicks ✅
- [ ] Indent → PO in ≤ 3 clicks ✅
- [ ] Can preview without navigation ✅
- [ ] Context persists after page refresh ✅

---

## 🐛 Troubleshooting

### Problem: "Cannot find module 'WorkflowContext'"
**Solution:** Verify file exists at `src/context/WorkflowContext.tsx`

### Problem: WorkflowDrawer doesn't appear
**Solution:** 
- Ensure `<WorkflowDrawer />` is in Layout.tsx
- Ensure `WorkflowProvider` wraps entire app in App.tsx

### Problem: "useWorkflow must be used within WorkflowProvider"
**Solution:** Verify App.tsx has `<WorkflowProvider>` wrapping routes

### Problem: localStorage not saving
**Solution:**
- Check browser DevTools → Storage → localStorage
- Ensure not in private/incognito mode
- Clear browser cache and try again

### Problem: Drawer opens but shows loading forever
**Solution:**
- Check that API methods exist: `getQuotationById`, `getIndentById`, `getPOById`
- Check browser console for API errors
- Verify API returns proper data structure

---

## 📊 Progress Tracking

Use this checklist as you implement:

**Foundation (Phase 1):**
- [x] Create 6 new component files
- [ ] Add WorkflowProvider to App.tsx
- [ ] Add WorkflowDrawer to Layout.tsx
- [ ] Add Breadcrumbs to Layout.tsx

**Dashboard (Phase 2):**
- [ ] Add "Resume Work" section
- [ ] Test resume functionality

**Quotations (Phase 3):**
- [ ] Add workflow tracking to list
- [ ] Add SmartActionBar to detail page
- [ ] Add related entities section

**Indents (Phase 4):**
- [ ] Show linked quotation
- [ ] Add "Create PO" action
- [ ] Show PO count

**POs (Phase 5):**
- [ ] Show source indent + quotation
- [ ] Add grouping by indent

**Testing (Phase 6):**
- [ ] Run functional tests
- [ ] Test mobile responsiveness
- [ ] Performance testing

---

## 📈 Performance Targets

After implementation, measure:

| Metric | Target |
|--------|--------|
| Drawer open time | < 500ms |
| Quotation → Indent clicks | ≤ 3 |
| Page refresh context restoration | < 100ms |
| SmartTable render (100 rows) | < 200ms |
| No console errors | 0 |

---

## 📚 Reference Files

Main integration guide:
- 📖 `WORKFLOW_INTEGRATION_GUIDE.md` - Detailed phase-by-phase instructions
- 📖 `ARCHITECTURE_REFERENCE.md` - Component documentation

Example implementations:
- 📚 `QuotationsRefactored.tsx` - Full refactored quotations list
- 📚 `IndentsRefactored.tsx` - Full refactored indents list

---

## Next Steps After Phase 1

1. ✅ Complete Phase 1 setup
2. Deploy and verify no errors
3. Get team feedback
4. Continue with Phase 2 (Dashboard)
5. Gradually roll out to all modules

---

## Time Estimate

- Phase 1 Setup: **20 min** ⏱️
- Phase 2 Dashboard: **20 min** ⏱️
- Phase 3-5 Modules: **1-2 hours** ⏱️
- Testing: **30 min** ⏱️

**Total: ~2-2.5 hours to full workflow implementation** 🚀

---

## Questions?

Refer to:
- Details → `ARCHITECTURE_REFERENCE.md`
- Implementation → `WORKFLOW_INTEGRATION_GUIDE.md`
- Examples → `QuotationsRefactored.tsx`, `IndentsRefactored.tsx`

---

**Ready? Start with Step 1 above!** 🎯
