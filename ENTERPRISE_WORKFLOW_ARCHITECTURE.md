# Enterprise Workflow Architecture: Quotation-Centric Industrial Automation ERP

**System Version:** 1.0 | **Classification:** Production Ready | **Last Updated:** April 2026

---

## EXECUTIVE SUMMARY

This is a **workflow-first, role-based, context-aware** ERP system for industrial automation. The system prioritizes:
- **Zero context loss** across navigation
- **Action-driven UI** with contextual next-step suggestions
- **Minimal clicks** (≤3 per major transition)
- **Immutability post-WON** for audit safety
- **Real industrial usability** for engineers under pressure

**Core Flow:** Quotation → Indent → Purchase Order → GRN → Execution

**Role-Based Separation:**
- **Sales Team:** Quotations + Indents (customer-facing, deal-centric)
- **Purchase Team:** POs + Vendors + GRN (vendor-facing, cost-optimized)
- **Admin:** System-wide oversight, approvals, settings

---

## PART 1: WORKFLOW ARCHITECTURE

### 1.1 State Machine Definition

```
QUOTATION States:
├── DRAFT (Sales creates, can edit freely)
├── SENT (Sent to customer, can recall)
├── ACCEPTED (Customer approved, cannot edit)
├── WON (Officially won, IMMUTABLE)
├── LOST (Customer rejected, ARCHIVED)
└── LAPSED (No response after 30 days, ARCHIVED)

INDENT States:
├── DRAFT (Sales initiated, incomplete)
├── FINALIZED (All items specified, ready for sourcing)
├── APPROVED (Management approved, sent to purchase)
├── PO_CREATED (PO generated for items)
├── PARTIAL_PO (Some items have POs, others pending)
└── CLOSED (All items received & executed)

PURCHASE ORDER States:
├── DRAFT (Purchase creating, incomplete)
├── SENT (Sent to vendor, awaiting confirmation)
├── CONFIRMED (Vendor accepted, cannot edit)
├── EXECUTED (Items received in GRN)
└── CLOSED (Payment processed)

GRN (Goods Receiving Note) States:
├── DRAFT (Created from PO)
├── PARTIAL_RECEIPT (Some items received)
├── COMPLETE (All items received)
└── INSPECTED (QA verified)

Transition Rules:
- Quotation WON → Can create Indent (independent)
- Indent FINALIZED → Can create Purchase Orders
- Quotation status does NOT block PO creation (allow parallel execution)
- Post-WON quotations IMMUTABLE (audit trail)
- PO CONFIRMED → Cannot edit line items (cost lock)
```

### 1.2 Core Business Rules

**Rule 1: Quotation Independence**
```
Indent Creation: Independent of Quotation status
Trigger: Sales team initiates → Does NOT require quotation
Context: Can create indent from scratch OR linked quotation
Benefit: Allows quick procurement without formal quot path
```

**Rule 2: Multi-Vendor Sourcing**
```
Per Indent Item Sourcing:
├── Single item can have multiple POs from different vendors
├── Purchase team evaluates best price/delivery per vendor
├── System tracks cost variance & supplier performance
└── Enables competitive sourcing within single indent
```

**Rule 3: Post-WON Immutability**
```
Quotation WON:
├── Customer name IMMUTABLE
├── Item list IMMUTABLE
├── Pricing IMMUTABLE
├── Quote version LOCKED (historical)
└── Audit trail MANDATORY
```

**Rule 4: GRN Independence**
```
GRN creation INDEPENDENT of PO status:
├── Can receive partial before full delivery
├── Can receive from multiple vendors simultaneously
├── Inspections trigger quality gates
└── Payment release tied to inspection completion
```

---

## PART 2: UI/UX FLOW ARCHITECTURE

### 2.1 Navigation Model: Context-Aware Breadcrumb Trail

```
Sales Flow:
Dashboard 
  → Quotations List 
    → Quotation Detail (primary context)
      → Create Indent (linked to quot)
      → View Related Indents
      → View Related POs (read-only)

Purchase Flow:
Dashboard 
  → Purchase Orders List
    → PO Detail (primary context)
      → Create GRN
      → View Related Indent
      → View Related Quotation (reference)

Cross-Functional View (Admin Dashboard):
Dashboard
  → Pipeline View (all quotations)
  → Indent Sourcing Board
  → PO Execution Dashboard
  → GRN & Receivables

CRITICAL: Every detail page shows:
- Breadcrumb chain (quot → indent → po → grn)
- Related records with quick links
- Status badges with next action prompts
- Timeline of state changes
```

### 2.2 Role-Based Page Visibility

```
SALES TEAM Can See:
✓ Quotations (create, edit, send, track status)
✓ Indents (create from quot, modify while draft)
✓ POs (read-only, quantity/delivery visibility)
✗ Vendor master (cannot manage)
✗ GRN (cannot create)
✗ Price audits

PURCHASE TEAM Can See:
✓ POs (create, edit, confirm, execute)
✓ Vendors (create, manage, track performance)
✓ GRN (create, inspect, close)
✓ Indent items (sourcing details only)
✗ Quotations (reference only in PO detail)
✗ Customer negotiation history
✗ Deal margins

ADMIN TEAM Can See:
✓ Everything (dashboards, reports, audits)
✓ Approval workflows
✓ System settings
✓ User management
✓ Audit logs
```

### 2.3 Action-Driven UI (Next Step Suggestions)

```
Quotation Detail Page:
Status: DRAFT
├── Primary CTA: "Send to Customer"
├── Secondary: "Preview as PDF"
├── tertiary: "Save Draft"
└── Suggestion Bar: "📧 Create indent first before sending"

Quotation Detail Page:
Status: SENT
├── Primary CTA: "Recall Quote"
├── Secondary: "View Status"
├── Tertiary: "Customer Follow-up"
└── Suggestion Bar: "⏰ 7 days until lapse. Follow up now?"

Quotation Detail Page:
Status: WON
├── Primary CTA: "Create Indent" (green, prominent)
├── Secondary: "View Indent" (if already created)
├── Tertiary: "Track PO Status"
└── Suggestion Bar: "✅ Quote won! Create indent to start sourcing"
└── Warning Badge: "IMMUTABLE - Cannot edit after acceptance"

Indent Detail Page:
Status: DRAFT
├── Primary CTA: "Add Items" / "Finalize"
├── Secondary: "Duplicate" / "Link Quotation"
└── Suggestion Bar: "👥 Not all items have sourcing strategy"

Indent Detail Page:
Status: FINALIZED
├── Primary CTA: "Create Purchase Order"
├── Secondary: "View Sourcing Board"
├── Tertiary: "Approve & Send to Purchase"
└── Suggestion Bar: "📦 Ready to source. Create PO with preferred vendor"

PO Detail Page:
Status: DRAFT
├── Primary CTA: "Send to Vendor"
├── Secondary: "Request Quote"
└── Suggestion Bar: "✓ Review vendor payment terms"

PO Detail Page:
Status: CONFIRMED
├── Primary CTA: "Create GRN" (yellow - waiting for goods)
├── Secondary: "Track Shipment"
└── Suggestion Bar: "📅 Delivery expected on 2026-04-15"

GRN Detail Page:
Status: PARTIAL_RECEIPT
├── Primary CTA: "Mark Complete & Inspect"
├── Secondary: "Add More Items"
└── Suggestion Bar: "⚠️  3 items pending, 2 more boxes expected"
```

### 2.4 Minimal-Click Navigation (≤3 Clicks)

```
SCENARIO 1: Sales received quotation acceptance, need to source
Click 1: Dashboard → Quotation (filtered: WON status)
Click 2: Quotation Detail → "Create Indent" (auto-populates customer, items)
Click 3: Indent Detail → "Finalize & Submit" → DONE

SCENARIO 2: Purchase team needs to create PO for accepted indent
Click 1: Indent List → Find Indent (or receive from Sales notification)
Click 2: Indent Detail → "Create PO" → Opens pre-populated form
Click 3: Review + Send to Vendor → DONE

SCENARIO 3: Goods received, need GRN
Click 1: PO Detail (notification alert: "shipment received") 
Click 2: "Create GRN" → Pre-filled with PO items
Click 3: Check items + "Complete" → DONE

SCENARIO 4: Vendor has issue, need price revision
Click 1: PO Detail → "Request Price Adjustment"
Click 2: Modal opens → Adjust line items → "Send to Vendor"
Click 3: Approval notification → DONE
```

---

## PART 3: COMPONENT ARCHITECTURE

### 3.1 Layout Structure (All Pages)

```
┌─────────────────────────────────────────────────────┐
│ Header: Logo | Search | Notifications | User Menu   │
├──────────────────────────────────────────────────────┤
│ Breadcrumb: Home > Quotations > QT-2026-001          │
├──────────────────────────────────────────────────────┤
│ ┌─ Context Card (Entity Summary) ──────────────────┐ │
│ │ [Status Badge] [Priority] [Timeline] [Owner]     │ │
│ └──────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────┤
│ ┌─ Action Bar ────────────────────────────────────┐ │
│ │ [Primary CTA] [Secondary] [More Actions ▼]      │ │
│ │ 💡 Suggestion: "Next step recommendations"      │ │
│ └──────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────┤
│ ┌─────────────────┐ ┌──────────────────────────────┐ │
│ │ Sidebar:        │ │ Main Content Area:           │ │
│ │ ├─ Details      │ │ ├─ Tabs (Overview/Items)     │ │
│ │ ├─ Related      │ │ ├─ Data Grid                 │ │
│ │ ├─ Timeline     │ │ ├─ Modal Overlays            │ │
│ │ └─ Audit Log    │ │ └─ Forms                     │ │
│ └─────────────────┘ └──────────────────────────────┘ │
├──────────────────────────────────────────────────────┤
│ Footer: Status indicators | Last Updated | Help       │
└──────────────────────────────────────────────────────┘
```

### 3.2 Reusable Components

```
1. StatusBadge Component
   - Props: status, workflowType (quotation|indent|po|grn)
   - Shows: Color-coded status + icon + tooltip
   - Use: Every detail page header

2. ContextCard Component
   - Props: entity, relatedEntities
   - Shows: Summary, timeline, owners, key metrics
   - Use: Every detail page top section

3. SuggestionBar Component
   - Props: currentStatus, role, metrics
   - Shows: Next-step recommendation
   - Use: Every detail page action bar

4. RelatedEntitiesPanel Component
   - Props: entityId, entityType
   - Shows: Linked quotations, indents, POs, GRNs
   - Use: Right sidebar of detail pages

5. WorkflowTimeline Component
   - Props: entityId, activityLog
   - Shows: Status changes, comments, who changed what when
   - Use: Activity tab on detail pages

6. DataGrid Component (Generic)
   - Props: columns, data, actions, onRowClick
   - Shows: Sortable, filterable table
   - Use: List pages, line items table

7. FormBuilder Component
   - Props: schema, validation rules, onSubmit
   - Shows: Dynamic form from metadata
   - Use: Create/Edit modals

8. QuickActionMenu Component
   - Props: actions, context
   - Shows: Dropdown with contextual actions
   - Use: "More Actions" button everywhere

9. ApprovalWorkflow Component
   - Props: requestId, approvers, currentLevel
   - Shows: Multi-level approval UI
   - Use: PO confirmation, Indent approval

10. AuditTrailComponent
    - Props: entityId, changes
    - Shows: Who changed what, when, why (reason)
    - Use: Audit log tab
```

### 3.3 Modal/Dialog Patterns

```
Create Entity Modal:
├── Auto-populate from context (e.g., customer from quotation)
├── Validation inline (highlight errors)
├── Save + Continue option (stay in modal)
├── Save + Close option (quick exit)
└── Quick template selection (optional)

Edit Entity Modal:
├── Show current values highlighted
├── Diff view (what changed)
├── Reason for change field (audit)
├── Preview changes impact (e.g., cost delta)
└── Approval notification if permission-dependent

Confirmation Modal:
├── Plain language explanation
├── Cost/timeline impact summary
├── "Cancel" vs "Confirm" buttons
└── Never destructive (always reversible)

Bulk Action Modal:
├── Preview affected entities (count + sample)
├── Dry-run option (see what changes before committing)
├── Batch progress indicator
└── Rollback option post-completion
```

---

## PART 4: STATE MANAGEMENT STRATEGY

### 4.1 Global Workflow Context (Redux/Zustand Pattern)

```typescript
// Global Workflow Store
interface WorkflowState {
  // Current Context
  currentEntity: {
    type: 'quotation' | 'indent' | 'po' | 'grn'
    id: string
    status: string
    data: any
  }
  
  // Navigation Trail (undo/redo support)
  navigationStack: Array<{
    entityType: string
    entityId: string
    timestamp: Date
    filters?: any
  }>
  
  // User Role Context
  userRole: 'sales' | 'purchase' | 'admin'
  permissions: string[]
  
  // Unsaved Changes
  unsavedChanges: Map<string, any>
  isDirty: boolean
  
  // Notifications
  notifications: Array<{
    id: string
    type: 'info' | 'success' | 'warning' | 'error'
    message: string
    action?: { label: string; onClick: () => void }
  }>
  
  // Related Entities Cache
  relatedEntities: {
    quotations?: Quotation[]
    indents?: Indent[]
    purchaseOrders?: PurchaseOrder[]
    grns?: GRN[]
  }
  
  // Global Filters (persist across navigation)
  filters: {
    dateRange?: { from: Date; to: Date }
    status?: string[]
    assignee?: string
    vendor?: string
  }
}

// Actions
interface WorkflowActions {
  setCurrentEntity(entity: any)
  navigateTo(entityType: string, entityId: string)
  goBack()
  goForward()
  updateUnsavedChanges(changes: any)
  discardChanges()
  setUserRole(role: string)
  addNotification(notification: Notification)
  removeNotification(id: string)
  updateRelatedEntities(type: string, data: any)
}
```

### 4.2 Local Component State Rules

```
USE GLOBAL STATE FOR:
✓ Current entity being viewed
✓ Navigation history
✓ User role & permissions
✓ System-wide notifications
✓ Global filters
✓ Related entities (cross-functional)

USE LOCAL STATE FOR:
✓ Form field values (during edit)
✓ Modal open/close state
✓ UI toggles (sidebar collapse, etc.)
✓ Transient states (hover, focus)
✓ List pagination position
✓ Grid column width preferences

USE REACT QUERY FOR:
✓ Server data fetching
✓ Caching strategies
✓ Background refetch
✓ Optimistic updates
✓ Error retry logic
```

### 4.3 Data Flow Example: Creating PO from Indent

```
User Action: Click "Create PO" on Indent Detail

1. UI Trigger:
   └─ Button onClick → Action dispatches INIT_PO_CREATION

2. Global State Change:
   ├─ Store receives INIT_PO_CREATION
   ├─ currentEntity.indent.status = FINALIZING
   ├─ relatedEntities.purchaseOrders = [] (empty, new form)
   └─ notifications = ["Ready to create PO"]

3. Component Update:
   └─ CreatePOModal mounts, receives:
       ├─ Indent data from store
       ├─ User role (permissions check)
       └─ Vendor list (filtered to indent suppliers)

4. User Fills Form:
   └─ Local state (formData) tracks changes
      ├─ Line items auto-copied from indent
      ├─ Totals calculated on change
      └─ Vendor selection triggers price lookup

5. User Submits:
   ├─ Validation runs
   ├─ API call: POST /po (optimistic update)
   ├─ Global state PENDING
   └─ UI shows loading

6. Success Response:
   ├─ Store updates: relatedEntities.po + new PO
   ├─ Global state: po.status = DRAFT
   ├─ Notification: "PO created successfully"
   └─ Auto-navigate to PO detail (optional)

7. API Error:
   ├─ Store: error message
   ├─ Notification: error + retry button
   └─ Form preserves user input
```

---

## PART 5: BACKEND ALIGNMENT REQUIREMENTS

### 5.1 API Response Shape (Consistent Across All Endpoints)

```json
// Success Response
{
  "success": true,
  "code": "QUOTATION_CREATED",
  "data": {
    "id": "QT-2026-001",
    "status": "DRAFT",
    "createdAt": "2026-04-07T10:30:00Z",
    ...entity data...
  },
  "metadata": {
    "totalRecords": 150,
    "page": 1,
    "pageSize": 25,
    "timestamp": "2026-04-07T10:30:00Z"
  },
  "relatedEntities": {
    "indents": [{ id: "IT-001", status: "DRAFT" }],
    "purchaseOrders": [],
    "grns": []
  }
}

// Error Response
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Customer email is required",
  "errors": {
    "customerEmail": "This field is required"
  },
  "suggestion": "Add customer email before saving"
}

// List Response
{
  "success": true,
  "code": "QUOTATIONS_FETCHED",
  "data": [...array of entities...],
  "filters": {
    "applied": { "status": "WON" },
    "available": {
      "status": ["DRAFT", "SENT", "WON", "LOST"],
      "owner": ["John", "Sarah"],
      "dateRange": { "from": "2026-01-01", "to": "2026-04-07" }
    }
  },
  "metadata": { ... }
}
```

### 5.2 Critical API Endpoints

```
QUOTATIONS:
GET    /api/quotations                    (list, filters)
GET    /api/quotations/:id                (detail + related)
POST   /api/quotations                    (create)
PATCH  /api/quotations/:id                (update draft)
POST   /api/quotations/:id/send           (send to customer)
POST   /api/quotations/:id/accept         (mark WON)
POST   /api/quotations/:id/versions       (audit trail)
DELETE /api/quotations/:id/draft          (discard draft)

INDENTS:
GET    /api/indents                       (list)
GET    /api/indents/:id                   (detail + related)
POST   /api/indents                       (create, optional quotation_id)
PATCH  /api/indents/:id                   (update before finalize)
POST   /api/indents/:id/finalize          (lock for sourcing)
POST   /api/indents/:id/approve           (management approval)
GET    /api/indents/:id/sourcing-board    (vendor availability + pricing)
GET    /api/indents/:id/related-pos       (linked purchase orders)

PURCHASE ORDERS:
GET    /api/purchase-orders               (list, filters)
GET    /api/purchase-orders/:id           (detail + related)
POST   /api/purchase-orders               (create, auto-links indent)
PATCH  /api/purchase-orders/:id           (edit before confirm)
POST   /api/purchase-orders/:id/send      (send to vendor)
POST   /api/purchase-orders/:id/confirm   (vendor accepted, immutable)
POST   /api/purchase-orders/:id/price-adjust (negotiation)
GET    /api/purchase-orders/:id/vendor-performance (analytics)

GRN (Goods Receiving Notes):
GET    /api/grn                           (list)
GET    /api/grn/:id                       (detail)
POST   /api/grn                           (create from PO)
PATCH  /api/grn/:id/items                 (add received items)
POST   /api/grn/:id/inspect               (QA verification)
POST   /api/grn/:id/complete              (close GRN)
GET    /api/grn/:id/payment-schedule      (trigger payment)

VENDORS:
GET    /api/vendors                       (list)
GET    /api/vendors/:id                   (detail + performance)
POST   /api/vendors                       (create)
PATCH  /api/vendors/:id                   (update)
GET    /api/vendors/:id/pricing-history   (negotiation data)

RELATED ENTITIES:
GET    /api/quotations/:id/indents        (all indents from quot)
GET    /api/indents/:id/pos               (all POs from indent)
GET    /api/po/:id/grn                    (all GRNs from PO)

NOTIFICATIONS:
GET    /api/user/notifications            (unread)
POST   /api/notifications/:id/read        (mark read)
GET    /api/user/activity-feed            (timeline view)
```

### 5.3 Critical Business Logic on Backend

```
1. Immutability Enforcement:
   BEFORE accepting Quotation as WON:
   ├─ Store snapshot of current state
   ├─ Set IMMUTABLE flag
   ├─ All subsequent edits create new version (audit)
   └─ Return error if edit attempted on WON quotation

2. Indent-Quotation Linking:
   WHEN creating indent with quotation_id:
   ├─ Validate quotation exists & is WON
   ├─ Auto-copy customer, items, pricing (snapshot)
   ├─ Link reference (can unlink before finalize)
   └─ Track lineage for audit

3. Multi-Vendor PO Creation:
   WHEN creating PO from indent:
   ├─ Validate indent is FINALIZED
   ├─ Allow selecting subset of items (multi-PO support)
   ├─ Add vendor reference
   ├─ Calculate cost variance vs. indent baseline
   └─ Return sourcing recommendations

4. GRN Partial Receipt Handling:
   WHEN creating GRN:
   ├─ Auto-populate all PO items
   ├─ Allow partial quantities
   ├─ Track received vs. pending
   ├─ Calculate delivery variance
   └─ Hold payment release until complete

5. Approval Workflow:
   BEFORE confirming PO amount > threshold:
   ├─ Route to approver (role-based)
   ├─ Set approval_pending flag
   ├─ Notify approver (email + in-app)
   ├─ Track approval chain (time, who, when)
   └─ Auto-escalate if pending > 48h

6. Audit Trail Requirements:
   EVERY state change must record:
   ├─ who (user_id, role)
   ├─ what (entity, field, old_value, new_value)
   ├─ when (timestamp)
   ├─ why (reason field from user)
   └─ context (ip, session, app_version)
```

---

## PART 6: REAL-WORLD INDUSTRIAL SCENARIOS

### Scenario 1: Quote Won on Friday 5pm, Need PO by Monday 9am

```
Business Context:
- Customer approved quotation for $250K project
- Production line in factory starts Monday
- Your team is offline Friday evening

System Response:
1. Notification at Friday 5:15pm:
   ├─ Alert: "Quotation QT-2026-089 WON!"
   ├─ Suggestion: "Create indent to start sourcing"
   └─ Quick action: One-tap "Create Indent"

2. Sales Team (On-Call) Action:
   └─ Tap "Create Indent" in notification
     ├─ Auto-populated with customer, items
     ├─ Selects delivery window: "Urgent - Delivery by Monday"
     └─ Taps "Finalize & Submit to Purchase"

3. System Auto-Notifies Purchase Team:
   ├─ Real-time alert: "Urgent indent created"
   ├─ Pre-calculates: 48h delivery window
   ├─ Suggests: "Call vendor ABC for rush order"
   └─ Shows cost delta: "+$5K for 2-day shipping"

4. Purchase Manager Response:
   ├─ Opens Indent sourcing board
   ├─ Sees vendor availability & rush pricing
   ├─ Creates PO with ABC vendor (rush delivery selected)
   ├─ Vendor confirmation auto-triggers
   └─ GRN template prepared (ready for delivery)

5. Production Timeline:
   ├─ Sunday evening: Vendor delivers partial shipment
   ├─ GRN created automatically (shipment notification)
   ├─ Monday 7am: QA inspects + approves partial
   ├─ Monday 8am: Remaining shipment arrives
   ├─ Monday 8:30am: GRN completed, payment released
   └─ Production starts: 9:00am (ON TIME)

Key Features That Make This Possible:
✓ One-tap indent creation from quotation
✓ Context-aware suggestions in real-time
✓ Role-based notifications + permissions
✓ Pre-populated forms (0 manual data entry)
✓ GRN auto-creation on shipment notification
✓ Offline-first mobile app capability
```

### Scenario 2: Vendor Price Increase Mid-Project

```
Business Context:
1. PO confirmed 2 weeks ago for 2-week delivery at $50K
2. Vendor calls: "Steel price increased 15%, can we adjust price?"
3. Delivery date already passed but items still arriving

System Response:
1. Vendor initiates price adjustment via vendor portal:
   ├─ Uploads new quote
   ├─ Provides reason (steel commodity increase)
   ├─ Requests: $7.5K additional payment
   └─ Delivery timeline: still on track

2. Purchase Manager Receives Notification:
   ├─ Alert: "Price adjustment requested for PO-2026-345"
   ├─ Show: Comparison view (original vs. new)
   ├─ Cost impact: "$7,500 increase (15% delta)"
   ├─ Timeline impact: "Still on schedule"
   └─ Suggested action: "Request approval"

3. Approval Workflow:
   └─ Purchase Manager routes to CFO (approval required > $5K)
     ├─ Email + in-app notification
     ├─ Shows: Cost analysis, vendor negotiations
     ├─ Approval options: "Approve" / "Request Reduction" / "Cancel"
     └─ Timer: "CFO decision due in 24h"

4. CFO Decision (2 hours later):
   ├─ Approves: "Market driven, competitor rates similar"
   ├─ Adds note: "Process rate lock mechanism for future"
   └─ System triggers: Payment adjustment order

5. System Response:
   ├─ Vendor receives approval immediately
   ├─ PO updated: new total amount, new line prices
   ├─ GRN pricing adjusted automatically
   ├─ Budget tracker updated (finance dashboard)
   ├─ Audit trail: Full negotiation history + approval
   └─ Invoice paid via adjusted amount

Key Features That Make This Possible:
✓ Vendor negotiation workflow (not email back-and-forth)
✓ Cost variance tracking & visualization
✓ Multi-level approval routing
✓ Real-time audit trail of negotiations
✓ Automatic cascading updates (PO → GRN → Invoice)
✓ Mobile-first notifications for approvers
```

### Scenario 3: Partial Delivery, Quality Issue Found

```
Business Context:
1. PO for 10 items arrives: 5 items received, 5 pending
2. QA inspection finds 2 items are defective (wrong grade steel)
3. Production line stalled, can't proceed without all items

System Response:
1. Warehouse Receives Goods:
   ├─ Scans items into GRN
   ├─ Records: "5 items received (XYZ batch), 5 pending"
   └─ Auto-triggers: QA inspection workflow

2. QA Inspector Action:
   ├─ Reviews GRN partial receipt
   ├─ Inspects item batch
   ├─ Finds defect: "Wrong chemical composition"
   ├─ Creates quality exception
   ├─ Uploads inspection photos
   └─ Recommends: "Reject batch, request replacement"

3. System Auto-Triggers:
   ├─ Alert to Purchase Manager
   ├─ Alert to Vendor (immediate)
   ├─ Alert to Production Manager (blocked, can't proceed)
   ├─ Alert to CFO (payment hold until resolved)
   └─ Escalates: "Production impact in 24h"

4. Purchase Manager Response:
   ├─ Reviews quality exception with photos
   ├─ Contacts vendor: "Defective, need replacement ASAP"
   ├─ Creates Corrective Action Request (CAR)
   ├─ Vendor priority: Set to "CRITICAL"
   └─ Options: "Return for credit" vs "Request replacement"

5. Vendor Response (Same Day):
   ├─ Accepts quality exception
   ├─ Authorizes return + replacement ship
   ├─ Expedites replacement (overnight delivery)
   ├─ Offers: "5% discount for inconvenience"
   └─ System records: Vendor responsiveness score

6. System Workflow Progression:
   ├─ GRN status: "PARTIAL + DEFECT"
   ├─ Payment status: "HOLD (quality issue)"
   ├─ Retro invoice created: Return credit (5 items)
   ├─ Approval triggered: Return authorization
   ├─ Replacement PO created: Auto-links to original
   └─ Updated delivery: Wednesday (Tuesday delivery)

7. Replacement Arrives Wednesday:
   ├─ QA inspection successful
   ├─ GRN updated: All items received (including replacement)
   ├─ Status: "COMPLETE"
   ├─ Payment authorized: Original + replacement (net of return credit)
   ├─ Invoice sequence: Return credit then retro invoice
   └─ Production: Can proceed (48h delay recovered)

Key Features That Make This Possible:
✓ Partial GRN receipt workflow
✓ Quality exception management with photo upload
✓ Automatic multi-party notifications
✓ Payment hold triggers on quality issues
✓ Corrective Action Request (CAR) system
✓ Return authorization workflow
✓ Replacement PO auto-linking
✓ Timeline impact visibility (for production planning)
✓ Vendor scorecard tracking (responsiveness, defect rate)
✓ Automatic invoice adjustments (returns + replacements)
```

### Scenario 4: Quote Lapsed, Customer Wants to Revive Deal (60 Days Later)

```
Business Context:
1. Quotation QT-2026-050 sent 60 days ago
2. No response from customer
3. System auto-archived as LAPSED (per business rules)
4. Customer calls: "We still want to proceed, but timeline has changed"

System Response:
1. Sales Rep Logs Call + Records Context:
   ├─ Customer update: "Production delay, now ready for Q3 delivery"
   ├─ Asks: "Can you provide updated quote with new timeline?"
   └─ Notes: "Reduced from 100 units to 80 units"

2. System Presents Options:
   ├─ Option A: "Revive original quote (QT-2026-050)"
   │  ├─ Shows: Original pricing, items, timeline
   │  └─ Note: "80 units now, was 100. Requires repricing"
   │
   ├─ Option B: "Create new quote from original" (best practice)
   │  ├─ Copies items from original (for consistency)
   │  ├─ Starts as DRAFT with new pricing
   │  ├─ References: "Supersedes QT-2026-050"
   │  └─ Links relationship for audit trail
   │
   └─ Option C: "Duplicate with amendments"
      ├─ Creates new quote
      ├─ Shows diff vs. original
      ├─ Highlights changes (items removed, timeline shifted)
      └─ Requires explicit sign-off on changes

3. Sales Rep (Selects Option B):
   ├─ Creates quote QT-2026-051 (linked to original)
   ├─ Updates: Quantity 80 units, Delivery Q3-2026
   ├─ Adjusts pricing: Volume discount applied
   ├─ Ratio-calculates: 80% of original price (volume impact)
   ├─ Final Price: $45K (was $50K for 100 units)
   └─ Margin: Better due to reduced costs

4. System Audit Trail Shows:
   ├─ Original quote: QT-2026-050 (LAPSED)
   ├─ Relationship: "Superseded by QT-2026-051"
   └─ New quote: QT-2026-051
      ├─ Items: Reduced set from original
      ├─ Pricing: Updated for new scope
      ├─ Timeline: Extended to Q3
      ├─ Status: DRAFT
      ├─ Created on: 2026-04-07 (60 days after original)
      └─ Reason: "Customer revival after lapse"

5. Sales Rep Sends New Quote:
   ├─ Includes cover note referencing original: "Updates to your quote from February..."
   ├─ Highlights changes: "100 units → 80 units, new pricing $45K"
   ├─ Explains reasoning: "Volume adjustment + market pricing update"
   └─ Request deadline: 10 days (shorter than original 30 days)

6. Customer Response (3 Days Later):
   ├─ Approves quote QT-2026-051
   ├─ System status: WON
   ├─ Original quote: Marked SUPERSEDED (audit trail)
   ├─ Sales rep creates indent immediately
   ├─ Indent: New but references both quotations
   └─ Timeline shows: Procurement needs to complete by Q3-2025

Key Features That Make This Possible:
✓ Lapsed quote recovery workflow
✓ Quote versioning + relationship mapping
✓ Automatic margin impact calculation on scope changes
✓ Reason-based audit trail ("Customer revival")
✓ Visual diff between original and new quote
✓ Timeline impact awareness
✓ Supersession tracking (original not deleted, marked related)
✓ Cost analysis showing what changed & why
```

---

## PART 7: EDGE CASE HANDLING

### Critical Edge Cases & Solutions

```
1. MULTIPLE QUOTE VERSIONS FOR SAME CUSTOMER
   Problem: Customer asks for revised price before acceptance
   Solution:
   ├─ Quotation versioning system
   ├─ Only latest version can be sent
   ├─ Previous versions: ARCHIVED with clear lineage
   ├─ Recall mechanism: Can recall sent version if not yet accepted
   └─ Audit: All versions preserved for legal

2. INDENT WITHOUT LINKED QUOTATION
   Problem: Sales creates indent directly (no quote)
   Solution:
   ├─ Allow indent creation without quotation_id
   ├─ Optional field: "Link to existing quote"
   ├─ Can link later if quotation is created
   ├─ GRN/PO workflow unchanged
   └─ Financial tracking independent

3. PO EXCEEDS BUDGET (Vendor Raises Price)
   Problem: During PO confirm, vendor quotes higher price
   Solution:
   ├─ Show budget vs. quoted comparison
   ├─ Flag if exceeds by > threshold (e.g., 10%)
   ├─ Require approval from finance if > threshold
   ├─ Option to negotiate or cancel
   └─ Audit trail of decision

4. GRN ITEMS != PO ITEMS (Over/Under Delivery)
   Problem: Vendor delivers 5 units, PO specifies 10
   Solution:
   ├─ GRN allows partial quantities
   ├─ System calculates: Delivered vs. Expected
   ├─ Auto-creates back order for missing items
   ├─ Payment prorated (only for delivered)
   ├─ Follow-up PO created for remainder
   └─ Customer notification if impacts timeline

5. CIRCULAR REFERENCE (Indent links Quote links Indent)
   Problem: Data integrity issue
   Solution:
   ├─ Validation: Prevent circular links at API level
   ├─ Backend check on every relationship save
   ├─ Error message: "This would create a circular reference"
   └─ System prevents UI from showing this option

6. CONCURRENT EDITS (Two users editing same quote draft)
   Problem: Last-save-wins data loss
   Solution:
   ├─ Implement optimistic locking
   ├─ Track last_modified_by + timestamp
   ├─ If editing: Lock for user (30 min timeout)
   ├─ Notification: "User X is editing this, try again in 5 min"
   ├─ Merge option: Show conflicts if both save
   └─ Audit trail shows who saved what when

7. DELETION REVERSAL (User deletes draft quote by mistake)
   Problem: Important quote lost
   Solution:
   ├─ Soft delete: Mark as deleted (not removed)
   ├─ Grace period: 30 days to restore
   ├─ Trash bin (available for restore)
   ├─ Notification: "Quote moved to trash, recover within 30 days"
   ├─ Permanent delete after 30 days (scheduled job)
   └─ Audit trail preserved (even after permanent delete)

8. APPROVAL DEADLOCK (Approver unavailable)
   Problem: PO pending for 5 days, production stalled
   Solution:
   ├─ Escalation rules: Auto-escalate after 48h
   ├─ Higher authority gets notification
   ├─ Option to "Emergency approve" with reason
   ├─ Temporary approval (time-limited) available
   ├─ Notification to absent approver (return from vacation soon?)
   └─ Audit trail shows escalation reason

9. VENDOR GOES OFFLINE (Can't receive PO confirmation)
   Problem: PO sent, vendor email down, vendor never confirms
   Solution:
   ├─ Multiple notification channels: Email + SMS + Portal
   ├─ Manual confirmation option: Call vendor, record call
   ├─ System status: "Pending vendor confirmation"
   ├─ Escalation: After 48h, call vendor or halt PO
   ├─ GRN can still be created (goods received = confirmation)
   └─ Audit trail of all contact attempts

10. CURRENCY FLUCTUATION (Quote in USD, Vendor in EUR)
    Problem: Price volatility during PO creation
    Solution:
    ├─ Auto-fetch current exchange rate
    ├─ Calculate: Indent cost in primary currency
    ├─ Show: Vendor currency × rate = Local equivalent
    ├─ Lock rate: Once PO confirmed
    ├─ Adjust: If delivery delayed > 30 days (renegotiate)
    └─ Finance tracking: Variance analysis
```

---

## PART 8: PERFORMANCE & SCALABILITY

### 8.1 Frontend Performance

```
Load Time Targets:
├─ Dashboard load: < 2 seconds
├─ Detail page load: < 1.5 seconds
├─ List page load: < 1 second
├─ Modal open: < 500ms
└─ Search results: < 500ms

Optimization Strategies:
1. Code Splitting:
   ├─ Split by route (lazy load pages)
   ├─ Split by feature (modals load on-demand)
   └─ Vendor chunks for large lists

2. Caching Strategy:
   ├─ React Query: Cache entity data (5 min TTL)
   ├─ localStorage: User preferences (infinite until logout)
   ├─ sessionStorage: Transient state (current page, filters)
   └─ Service Worker: Offline list views

3. Virtual Scrolling:
   ├─ For lists > 500 items
   ├─ Renders only visible rows (improves DOM performance)
   └─ Smooth scroll with indicator

4. Image Optimization:
   ├─ Compress inspection photos (WebP format)
   ├─ Lazy load images until visible
   ├─ Thumbnails in lists, full in modals
   └─ CDN for static assets

5. API Request Batching:
   ├─ Combine multiple related entity fetches in one request
   ├─ Use GraphQL or endpoint that returns related data
   └─ Reduce waterfall loading
```

### 8.2 Backend Scalability

```
Database Optimization:
1. Indexing Strategy:
   ├─ Primary: entity_id (all tables)
   ├─ Foreign keys: quotation_id, indent_id, po_id, vendor_id
   ├─ Filters: status, created_date, owner_id
   ├─ Search: customer_name, item_description
   └─ Composite: (owner_id, status, created_date DESC)

2. Partitioning:
   ├─ By date: Quotations, Indents, POs (yearly)
   ├─ Archive old records (> 2 years) to cold storage
   ├─ Retain audit trail forever

3. Query Optimization:
   ├─ Avoid N+1 queries (use JOINs)
   ├─ Paginate lists (never fetch all)
   ├─ Use aggregates for dashboards (not transaction tables)
   └─ Cache expensive queries (hourly refresh)

API Rate Limiting:
├─ Per user: 100 requests/min
├─ Per IP: 1000 requests/min
├─ Burst allowance: 10 concurrent requests
└─ Graceful degradation: Queue requests if limit reached

Asynchronous Processing:
├─ GRN processing (async job):
│  ├─ Receive goods → Create GRN (async)
│  ├─ Calculate impact on budget
│  └─ Trigger payment workflow
├─ Approval notifications (queue-based)
├─ PDF generation (background job)
└─ Email/SMS dispatch (message queue)

Microservices Architecture (Future):
├─ Quotation Service (Sales team)
├─ Procurement Service (POs, Vendors)
├─ Inventory Service (GRN, Receiving)
├─ Finance Service (Invoicing, Payments)
├─ Audit Service (Immutable event log)
└─ Notification Service (Email, SMS, push)
```

### 8.3 Multi-Tenancy Support (Enterprise SaaS)

```
Database Isolation:
├─ Tenant ID in every table (soft multi-tenancy)
├─ Row-level security (RLS) at database level
├─ All queries auto-filtered by tenant_id
└─ Audit trail includes tenant context

API Security:
├─ Extract tenant from JWT token
├─ Validate tenant_id in request matches token
├─ Log all cross-tenant attempts (security flag)
└─ Rate limit per tenant (shared pool)

Data Backup & Recovery:
├─ Tenant-specific backups (hourly)
├─ GDPR compliance: Right to deletion (request → 30 day grace)
└─ Data export: JSON/CSV (user-initiated)
```

---

## PART 9: DEVELOPER MAINTAINABILITY

### 9.1 Code Organization

```
/src
├── /pages                    (page components, one per route)
│   ├── Dashboard.tsx
│   ├── Quotations.tsx
│   ├── QuotationDetail.tsx
│   ├── Indents.tsx
│   ├── IndentDetail.tsx
│   ├── PurchaseOrders.tsx
│   ├── PurchaseOrderDetail.tsx
│   ├── GRN.tsx
│   ├── Vendors.tsx
│   └── AdminPanel.tsx
│
├── /components               (reusable components)
│   ├── /common              (shared UI)
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── SuggestionBar.tsx
│   │   └── ...
│   ├── /modals              (modal dialogs)
│   │   ├── CreateQuotationModal.tsx
│   │   ├── CreateIndentModal.tsx
│   │   ├── CreatePOModal.tsx
│   │   └── ...
│   ├── /forms               (form builders)
│   │   ├── QuotationForm.tsx
│   │   ├── IndentForm.tsx
│   │   ├── POForm.tsx
│   │   └── ...
│   └── /workflows           (workflow-specific)
│       ├── QuotationWorkflow.tsx (status → UI mapping)
│       ├── IndentSourcingBoard.tsx
│       └── ...
│
├── /store                   (global state)
│   ├── workflowStore.ts     (Zustand store definition)
│   ├── /slices              (Redux if using Redux)
│   │   ├── entitySlice.ts
│   │   ├── navigationSlice.ts
│   │   └── ...
│   └── hooks.ts             (useWorkflow, useEntity, etc.)
│
├── /api                     (API calls)
│   ├── quotations.ts
│   ├── indents.ts
│   ├── purchaseOrders.ts
│   ├── grn.ts
│   ├── vendors.ts
│   └── client.ts            (axios/fetch wrapper)
│
├── /hooks                   (custom React hooks)
│   ├── useWorkflowNavigation.ts
│   ├── useEntityDetail.ts
│   ├── useRelatedEntities.ts
│   ├── useUserRole.ts
│   └── useNotifications.ts
│
├── /types                   (TypeScript interfaces)
│   ├── entities.ts          (Quotation, Indent, PO, GRN)
│   ├── workflow.ts          (WorkflowState, Status enums)
│   ├── api.ts               (API response shapes)
│   └── common.ts            (common types)
│
├── /utils                   (helpers)
│   ├── dates.ts
│   ├── currency.ts
│   ├── validation.ts
│   ├── formatting.ts
│   └── statusColors.ts
│
└── /config                  (constants)
    ├── roles.ts             (SALES, PURCHASE, ADMIN)
    ├── workflow.ts          (status definitions)
    └── api.ts               (endpoints, auth)
```

### 9.2 Type Safety (TypeScript)

```typescript
// types/workflow.ts

export enum QuotationStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  ACCEPTED = 'ACCEPTED',
  WON = 'WON',
  LOST = 'LOST',
  LAPSED = 'LAPSED'
}

export enum UserRole {
  SALES = 'SALES',
  PURCHASE = 'PURCHASE',
  ADMIN = 'ADMIN'
}

export interface Quotation {
  id: string
  status: QuotationStatus
  customerId: string
  customerName: string
  items: QuotationItem[]
  total: number
  createdAt: Date
  createdBy: string
  sentAt?: Date
  acceptedAt?: Date
  wonAt?: Date
  isImmutable: boolean  // true if status = WON
}

export interface WorkflowContext {
  currentEntity: Quotation | Indent | PurchaseOrder | GRN | null
  entityType: 'quotation' | 'indent' | 'po' | 'grn'
  userRole: UserRole
  permissions: Permission[]
  relatedEntities: {
    quotations?: Quotation[]
    indents?: Indent[]
    pos?: PurchaseOrder[]
  }
}

// Ensures type safety across entire app
// IDE autocomplete everywhere
// Compile-time error checking
```

### 9.3 Component Pattern Examples

```typescript
// Example: Quotation Detail Component (Workflow-Aware)
import { useParams } from 'react-router-dom'
import { useWorkflow } from '@/store/hooks'
import { useQuotationQuery } from '@/api/quotations'
import { StatusBadge, SuggestionBar, ContextCard } from '@/components/common'

export function QuotationDetail() {
  const { quotationId } = useParams()
  const { setCurrentEntity, userRole } = useWorkflow()
  const { data: quotation, isLoading } = useQuotationQuery(quotationId)

  // Determine next action based on status & role
  const nextAction = useMemo(() => {
    if (quotation?.status === 'DRAFT' && userRole === 'SALES') {
      return { 
        label: 'Send to Customer', 
        action: handleSend,
        icon: '📧'
      }
    }
    if (quotation?.status === 'WON') {
      return {
        label: 'Create Indent',
        action: handleCreateIndent,
        icon: '📦'
      }
    }
    return null
  }, [quotation?.status, userRole])

  useEffect(() => {
    setCurrentEntity(quotation)
  }, [quotation])

  if (isLoading) return <Skeleton />

  return (
    <>
      <Header breadcrumb={['Quotations', quotation?.id]} />
      
      <ContextCard entity={quotation} relatedEntities={relatedEntities} />
      
      <ActionBar>
        {nextAction && (
          <PrimaryButton onClick={nextAction.action}>
            {nextAction.icon} {nextAction.label}
          </PrimaryButton>
        )}
        <SecondaryButton>Download PDF</SecondaryButton>
        <MoreActionsMenu />
      </ActionBar>

      <SuggestionBar 
        status={quotation?.status}
        suggestion="This quote has been won! Create an indent to begin sourcing."
      />

      <Tabs>
        <Tab label="Overview">
          <QuotationOverview data={quotation} />
        </Tab>
        <Tab label="Items">
          <QuotationItemsTable data={quotation?.items} />
        </Tab>
        <Tab label="Timeline">
          <WorkflowTimeline entityId={quotation?.id} />
        </Tab>
        <Tab label="Audit">
          <AuditTrail entityId={quotation?.id} />
        </Tab>
      </Tabs>

      <Sidebar>
        <RelatedEntitiesPanel 
          entityType="quotation"
          entityId={quotation?.id}
        />
      </Sidebar>
    </>
  )
}
```

---

## PART 10: IMPLEMENTATION ROADMAP

### Phase 1: Core (Weeks 1-4)
```
✓ Define state machine (quotation, indent, PO, GRN)
✓ Build layout component (header, sidebar, footer)
✓ Create Quotation CRUD (list, detail, create, edit)
✓ Implement status badges & basic transitions
✓ Setup global state (Zustand/Redux)
✓ API integration (basic endpoints)
```

### Phase 2: Workflow (Weeks 5-8)
```
✓ Indent creation from quotation
✓ PO creation from indent (multi-vendor support)
✓ GRN creation from PO
✓ Related entities panel (linking feature)
✓ Action-driven UI (next step suggestions)
✓ Navigation history + back button
✓ Role-based visibility
```

### Phase 3: UX Polish (Weeks 9-12)
```
✓ Pre-populated forms (auto-copy data)
✓ Modal workflows (create from anywhere)
✓ Validation & error handling
✓ Notifications (in-app + email)
✓ Timeline component (activity log)
✓ Audit trails (immutability enforcement)
```

### Phase 4: Advanced (Weeks 13-16)
```
✓ Approval workflows (multi-level)
✓ Vendor negotiation (price adjustments)
✓ Quality exceptions (GRN inspections)
✓ Budget tracking & cost variance
✓ Performance optimization
✓ Analytics dashboards
```

---

## CONCLUSION

This architecture ensures:

1. **Workflow-First**: Every UI decision serves the workflow
2. **Zero Context Loss**: Breadcrumbs, history, related entities always visible
3. **Action-Driven**: System guides next step (never lost)
4. **Minimal Clicks**: ≤3 per major operation
5. **Role-Based**: Sales, Purchase, Admin see only relevant data
6. **Real Industrial**: Handles urgent timelines, quality issues, vendor problems
7. **Audit-Safe**: Immutability, full trail, approval chains
8. **Scalable**: From small team (2026) to enterprise (2030+)

**Core Philosophy**: Build for people under pressure who need to get things done, not for feature completeness.
