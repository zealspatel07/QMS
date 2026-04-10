# Implementation Roadmap: From Current State to Enterprise Architecture

**Status: PLANNING PHASE**  
**Current Build: Clean (Exit Code 0)**  
**Next: Architecture Foundation Setup (1-2 weeks)**

---

## Current System State vs. Target Architecture

### What Exists (Production-Ready)
```
✅ CreatePO.tsx        - Professional product dropdown, modal workflows
✅ EditPO.tsx          - Refactored, consistent with CreatePO
✅ PurchaseOrders.tsx  - List view with filtering
✅ CreateIndent.tsx    - Indent creation (partial implementation)
✅ Vendors.tsx         - Vendor master management
✅ Products.tsx        - Product catalog management
✅ Backend APIs        - All CRUD endpoints working
✅ Auth middleware     - Role-based access control infrastructure
✅ DB schema           - Supports quotations, indents, POs, GRNs
```

### What's Missing (Must Build)
```
❌ Quotation module         - Entry point for sales workflow (CRITICAL)
❌ Global workflow state    - Currently using local useState
❌ Breadcrumb navigation    - Context trail across pages
❌ Action-driven UI         - Next-step suggestions not implemented
❌ Related entities panel   - Linking indents/POs/GRNs
❌ Approval workflows       - Multi-level approvals
❌ Audit trails             - Immutability enforcement
❌ GRN module               - Goods receiving workflow
❌ Material Timeline        - Activity log component
❌ Role-based visibility    - Enforced throughout UI
❌ Vendor negotiation       - Price adjustment workflow
❌ Quality exceptions       - Defect tracking
❌ Admin dashboard          - System-wide oversight
```

---

## IMPLEMENTATION PRIORITY (Next 8 Weeks)

### WEEK 1-2: Foundation (Critical Path Item #1)
**Goal:** Implement global state + Quotation module (unblocks everything)

```
Task 1.1: Setup Global Workflow Store
├─ Install Zustand (state management)
├─ Define WorkflowState interface (types/)
├─ Create workflowStore.ts with actions:
│  ├─ setCurrentEntity()
│  ├─ navigateTo()
│  ├─ goBack() / goForward()
│  ├─ addNotification()
│  └─ updateRelatedEntities()
├─ Create useWorkflow() hook
└─ Integrate into root layout
|  └─ Wrap App with StoreProvider

Task 1.2: Create Quotation Module (Sales Entry Point)
├─ PAGES:
│  ├─ pages/Quotations.tsx (list + filters)
│  │  ├─ Search by customer name
│  │  ├─ Filter by status (DRAFT, SENT, WON, LOST, LAPSED)
│  │  ├─ Sort by date, customer, value
│  │  └─ Bulk actions (delete draft, export, archive)
│  │
│  └─ pages/QuotationDetail.tsx (single quotation)
│     ├─ Status badge + timeline
│     ├─ Tabs: Overview, Items, Timeline, Audit
│     ├─ Action bar (next-step driven)
│     ├─ Related indents panel (right sidebar)
│     └─ Create/Edit modals
│
├─ COMPONENTS:
│  ├─ CreateQuotationModal.tsx
│  │  ├─ Customer dropdown (with create new)
│  │  ├─ Items grid (add/remove lines)
│  │  ├─ Pricing section
│  │  └─ Save + Send options
│  │
│  ├─ EditQuotationModal.tsx
│  │  ├─ Only editable if DRAFT
│  │  ├─ Show diff if recalled (version comparison)
│  │  └─ Audit reason field
│  │
│  └─ QuotationItems Table.tsx
│     ├─ Columns: Item name, qty, unit price, discount, total
│     ├─ Sum row at bottom
│     └─ Edit/delete row actions
│
├─ API INTEGRATION:
│  ├─ POST /api/quotations (create)
│  ├─ GET /api/quotations (list + filters)
│  ├─ GET /api/quotations/:id (detail + related)
│  ├─ PATCH /api/quotations/:id (update draft)
│  ├─ POST /api/quotations/:id/send (send to customer)
│  ├─ POST /api/quotations/:id/accept (mark WON)
│  └─ DELETE /api/quotations/:id/draft (discard)
│
├─ IMMUTABILITY ENFORCEMENT:
│  ├─ Disable edit button if status === WON
│  ├─ Show warning badge: "IMMUTABLE"
│  ├─ Audit trail shows all changes (even post-WON versions)
│  └─ Backend refuses PATCH if WON
│
└─ TESTING:
   ├─ Create quotation
   ├─ Edit draft quotation
   ├─ Send quotation
   ├─ Accept quotation (mark WON)
   ├─ Attempt to edit WON quotation (should fail)
   └─ Verify audit trail
```

**Deliverable:** Fully functional Quotation module with status machine working

---

### WEEK 3-4: Navigation & Context (Critical Path Item #2)
**Goal:** Implement breadcrumb trail + related entities + context preservation

```
Task 2.1: Breadcrumb Component + Navigation History
├─ CREATE: components/common/Breadcrumb.tsx
│  ├─ Input: navigationStack from global store
│  ├─ Display: Home > Quotations > QT-2026-001
│  ├─ Clickable: Go back to any level
│  ├─ Show: Entity name + ID + status
│  └─ Responsive: Truncate on mobile
│
├─ UPDATE: useWorkflow() hook to track history
│  ├─ Push current page to navigationStack
│  ├─ Limit history to 10 items (UI not memory hog)
│  └─ Clear on logout
│
└─ TEST:
   ├─ Navigate: Quot → Indent → PO → back to Quot
   ├─ Breadcrumb shows correct path
   └─ Click breadcrumb, go back to previous page

Task 2.2: Related Entities Panel
├─ CREATE: components/RelatedEntitiesPanel.tsx
│  ├─ Input: currentEntity (quota/indent/po/grn)
│  ├─ Display related:
│  │  ├─ If quotation: Show linked indents + POs created from it
│  │  ├─ If indent: Show quotation + POs created from it
│  │  ├─ If PO: Show indent + quotation (for reference)
│  │  └─ If GRN: Show PO + indent
│  ├─ Each relation: ID, status, total, link
│  └─ Quick actions: Open, preview, export
│
├─ API INTEGRATION:
│  ├─ GET /api/quotations/:id/indents
│  ├─ GET /api/indents/:id/pos
│  ├─ GET /api/po/:id/grn
│  └─ Batch these calls (React Query)
│
└─ TEST:
   ├─ Create quotation
   ├─ Create indent from quotation
   ├─ Open quotation detail, verify indent shows in related panel
   ├─ Open indent detail, verify PO shows in related panel

Task 2.3: Context Preservation on Navigation
├─ UPDATE: All detail pages to use global store
├─ When navigating to detail page:
│  ├─ setCurrentEntity() in useEffect
│  ├─ Fetch related entities
│  ├─ Cache results in relatedEntities
│  └─ Restore on back navigation (from history)
│
└─ TEST:
   ├─ Navigate: Quo detail → Indent detail → back to Quo detail
   ├─ Quotation state fully restored (no re-fetch)
```

**Deliverable:** Users can navigate freely + see current context always

---

### WEEK 5-6: Indent & PO Workflow Enhancement (Functional Flow)
**Goal:** Create → Finalize → Source → Order flow with pre-populated forms

```
Task 3.1: Enhanced Indent Workflow
├─ UPDATE: pages/IndentDetail.tsx
│  ├─ New tab: "Sourcing Board"
│  │  ├─ Show: All items needing PO
│  │  ├─ Display: Vendor options + pricing + lead time
│  │  ├─ Allow: Create multi-vendor POs from here
│  │  └─ Suggestion: "Create PO for item X with vendor Y"
│  │
│  ├─ Action bar improvements:
│  │  ├─ DRAFT status: "Finalize & Submit"
│  │  ├─ FINALIZED: "Create PO" (primary CTA)
│  │  ├─ PARTIAL_PO: "Create PO for Remaining Items"
│  │  └─ CLOSED: View-only mode
│  │
│  └─ Pre-population logic:
│     ├─ Create indent from quotation: Auto-copy items
│     ├─ Create PO from indent: Auto-copy subset of items
│     └─ Create GRN from PO: Auto-copy all items + quantities
│
├─ NEW MODALS:
│  ├─ CreateIndentFromQuotation
│  │  ├─ Auto-populate: Customer, items, pricing
│  │  ├─ Allow: Qty adjustment, item removal
│  │  └─ Link back to quotation
│  │
│  └─ CreatePOFromIndent
│     ├─ Auto-populate: Items from indent
│     ├─ Allow: Vendor selection, qty override
│     ├─ Show: Cost vs. indent budget
│     └─ Suggest: "PO total $5K under budget, proceed?"
│
└─ TEST:
   ├─ Create indent from quotation WON
   ├─ Verify items auto-populated
   ├─ Create PO from indent
   ├─ Verify items auto-populated + vendor selectable
   ├─ Create multi-vendor POs for same indent
```

Task 3.2: GRN Creation & Goods Receiving
├─ CREATE: pages/GRN.tsx (list) + GRNDetail.tsx (detail)
│  ├─ List view:
│  │  ├─ Filter by status (DRAFT, PARTIAL, COMPLETE)
│  │  ├─ Show: PO ref, items count, received vs. expected
│  │  └─ Quick action: "Receive more" (add items)
│  │
│  └─ Detail view:
│     ├─ Header: PO ref, vendor, delivery date expected
│     ├─ Items table: Ordered qty, Received qty, Variance
│     ├─ Status: Shows % received
│     ├─ Actions: 
│     │  ├─ "Add Items" (partial receipt)
│     │  ├─ "Mark Complete" (all received)
│     │  ├─ "Begin Inspection" (QA workflow)
│     │  └─ "Create Replacement PO" (if short receipt)
│     └─ Audit: Who received, when, signature
│
├─ API:
│  ├─ POST /api/grn (create from PO)
│  ├─ PATCH /api/grn/:id/items (add received items)
│  ├─ POST /api/grn/:id/inspect (quality check)
│  ├─ POST /api/grn/:id/complete (close GRN)
│  └─ GET /api/grn/:id/payment-schedule (trigger payment)
│
└─ TEST:
   ├─ Create GRN from confirmed PO
   ├─ Receive partial quantity
   ├─ Mark complete
   ├─ Verify payment triggered
```

**Deliverable:** Full quotation → indent → PO → GRN workflow working end-to-end

---

### WEEK 7: Action-Driven UI & Suggestions (User Guidance)
**Goal:** System tells users what to do next at every step

```
Task 4.1: SuggestionBar Component
├─ CREATE: components/SuggestionBar.tsx
│  ├─ Input: currentStatus, userRole, metrics
│  ├─ Logic: Based on status → show suggestion
│  │  ├─ Quotation DRAFT: "Send to customer to start closing deal"
│  │  ├─ Quotation SENT: "5 days until lapse. Follow up now?"
│  │  ├─ Quotation WON: "Create indent to start sourcing (2 clicks)"
│  │  ├─ Indent DRAFT: "All items specified? Finalize to proceed"
│  │  ├─ Indent FINALIZED: "Create PO with preferred vendor"
│  │  ├─ PO DRAFT: "Review vendor terms, then send"
│  │  ├─ PO SENT: "Awaiting vendor confirmation"
│  │  ├─ PO CONFIRMED: "Goods expected on [date]. Create GRN when received"
│  │  └─ GRN PARTIAL: "3 items pending. When more arrive, update GRN"
│  │
│  ├─ Style: Light blue background, icon + text
│  └─ Action: Most suggestions have quick-click CTA
│
├─ INTEGRATION:
│  ├─ Add SuggestionBar to every detail page
│  ├─ Update in real-time as status changes
│  └─ Dismiss option (user preference)
│
└─ TEST:
   ├─ View suggestion on each status
   ├─ Click suggestion CTA, verify action executes
   ├─ Verify suggestion updates on status change
```

Task 4.2: Action Bar (Primary CTA)
├─ UPDATE: All detail page action bars
│  ├─ Analyze current status
│  ├─ Determine valid next actions
│  ├─ Highlight primary CTA (bold, bright color)
│  ├─ Secondary CTAs (normal buttons)
│  └─ More Actions menu (dropdown)
│
├─ Example (Quotation WON):
│  ├─ Primary: "Create Indent" (green, prominent)
│  ├─ Secondary: "View Related Indents" | "Download PDF"
│  ├─ More: "Recall Quote" | "Archive" | "Share"
│  └─ Never show "Edit" (immutable)
│
└─ TEST:
   ├─ Verify correct primary CTA shown per status
   ├─ Verify disabled/grayed actions (based on role)
```

**Deliverable:** Users always know what to do next (no guessing)

---

### WEEK 8: Role-Based Access & Visibility (Enterprise Security)
**Goal:** Sales sees Sales, Purchase sees Purchase, Admin sees All

```
Task 5.1: Role-Based Page Visibility
├─ UPDATE: Router + Layout to enforce roles
│  ├─ Create: ProtectedRoute component
│  │  ├─ Check userRole in global store
│  │  ├─ If unauthorized: Redirect to 403 + message
│  │  └─ Log attempt (security audit)
│  │
│  └─ Routes:
│     ├─ /quotations → SALES, ADMIN only
│     ├─ /indents → SALES, ADMIN only
│     ├─ /purchase-orders → PURCHASE, ADMIN only
│     ├─ /grn → PURCHASE, ADMIN only
│     ├─ /vendors → PURCHASE, ADMIN only
│     ├─ /admin → ADMIN only
│     └─ /dashboard → ALL (but content customized)
│
├─ UPDATE: Sidebar to show only accessible pages
│  └─ Each menu item checks role permission
│
└─ TEST:
   ├─ Login as Sales, verify no PO options visible
   ├─ Login as Purchase, verify no Quotation options
   ├─ Login as Admin, verify everything visible
```

Task 5.2: Element-Level Visibility
├─ UPDATE: Components to hide based on role
│  ├─ Buttons: Hide "Delete" for non-admin
│  ├─ Fields: Hide vendor payments (PURCHASE only)
│  ├─ Tabs: Hide "Audit" for non-admin
│  ├─ Modals: Hide "Bulk edit" for non-admin
│  └─ Data: Filter lists by owner (see own + team items)
│
├─ Example: Quotation Detail
│  ├─ SALES sees: Edit, Send, Recall, Create Indent
│  ├─ PURCHASE sees: View-only, Related POs
│  ├─ ADMIN sees: Everything + Delete, Reassign, Override
│
└─ TEST:
   ├─ Element visibility matches role expectations
   ├─ No API data leaks (backend also filters)
```

**Deliverable:** Clean role separation (security + UX)

---

## Phase 2 Quick-Wins (Optional, But Impactful)

### High-Impact, Low-Effort Improvements
```
1. PDF Export (Quote → PDF)
   ├─ Use: html2pdf library
   ├─ Template: Professional quotation format
   ├─ Include: Items, totals, terms
   └─ Time: 4 hours

2. Email Templates
   ├─ When quotation sent: Email customer with PDF
   ├─ When PO created: Notify vendor via email
   ├─ Template variables: Customer name, items, total
   └─ Time: 6 hours

3. Dashboard Customization (by Role)
   ├─ Sales dashboard: Win rate, pipeline value, quotes sent
   ├─ Purchase dashboard: On-time delivery %, cost variance
   ├─ Admin dashboard: System health, user activity
   └─ Time: 8 hours

4. Search + Filter Enhancements
   ├─ Global search (find any entity by ID/name)
   ├─ Smart filters (date range, status, owner, value)
   ├─ Saved filters (user can save frequently used)
   └─ Time: 6 hours

5. Mobile Optimization
   ├─ Responsive grid (stack on mobile)
   ├─ Touch-friendly buttons (larger hit area)
   ├─ Mobile-first navigation
   └─ Time: 10 hours (not critical for launch)
```

---

## Success Metrics (Track Progress)

```
FUNCTIONALITY METRICS:
├─ Quotation creation ≤ 3 clicks ✓
├─ Quotation to Indent ≤ 2 clicks ✓ (auto-populated form)
├─ Indent to PO ≤ 2 clicks ✓ (pre-filled with indent items)
├─ PO to GRN ≤ 2 clicks ✓ (auto-created from PO)
├─ All workflows ≤ 3 clicks per major transition ✓
└─ Zero context loss on navigation ✓

PERFORMANCE METRICS:
├─ Page load < 2s (dashboard)
├─ Detail page load < 1.5s
├─ List page load < 1s
├─ Modal open < 500ms
└─ Search results < 500ms

USABILITY METRICS:
├─ User completes quota → indent in < 5 min (from scratch)
├─ New user needs no training (UI is self-evident)
├─ Error messages guide next action
├─ Suggestion bar used by > 70% of users
└─ Role-based visibility reduces cognitive load

QUALITY METRICS:
├─ Zero data loss (immutability enforced)
├─ Audit trail 100% complete (every change logged)
├─ Approval workflows function correctly
├─ No N+1 queries (batch fetch all related)
└─ API response times < 200ms
```

---

## Risk Mitigation

```
RISK 1: Global state too large, performance issues
├─ Mitigation: Zustand lazy-loads entities on demand
├─ Monitoring: Track store size, optimize if > 10MB
└─ Fallback: Switch to Redux Toolkit (scales better)

RISK 2: Too many related entities, API overload
├─ Mitigation: Batch fetch in single endpoint
├─ Monitoring: Track API load, implement caching
└─ Fallback: GraphQL batching

RISK 3: Users confused by workflow states
├─ Mitigation: SuggestionBar guides every step
├─ Monitoring: Track user success rate per workflow
└─ Fallback: In-app tutorial videos

RISK 4: Role-based access implemented incorrectly
├─ Mitigation: Automated role tests (Jest + E2E)
├─ Monitoring: Audit logs for unauthorized attempts
└─ Fallback: Manual role verification audit quarterly

RISK 5: Audit trail becomes massive, slows queries
├─ Mitigation: Archive old logs (> 2 years)
├─ Monitoring: Monitor audit table size
└─ Fallback: Separate audit database (microservice)
```

---

## Next Immediate Step (Monday Morning)

**Task: Setup Global State + Quotation Module (Week 1)**

1. **Install Zustand**
   ```bash
   npm install zustand
   ```

2. **Create store structure** (2 hours)
   ```
   src/store/
   ├── workflowStore.ts       (Zustand store definition)
   ├── hooks.ts               (useWorkflow hook)
   └── index.ts               (exports)
   ```

3. **Create Quotation types** (1 hour)
   ```
   src/types/quotation.ts     (Quotation, QuotationStatus interfaces)
   ```

4. **Create Quotation pages** (6 hours)
   ```
   src/pages/
   ├── Quotations.tsx         (list)
   └── QuotationDetail.tsx    (detail)
   ```

5. **Wire API calls** (2 hours)
   ```
   src/api/quotations.ts      (API hooks + queries)
   ```

6. **Test end-to-end** (1 hour)
   - Create quotation
   - Edit draft
   - Send to customer
   - Mark WON
   - Verify immutability

**Total Effort:** 12 hours (1.5 developer days)  
**Output:** Quotation module fully functional, unblocks Indent + PO workflows

---

**Ready to start?** Create working branch:
```bash
git checkout -b feature/quotation-workflow
npm install zustand
# Then → Week 1 Codebase Changes Below
```
