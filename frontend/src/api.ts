// src/api.ts
export const API_URL = import.meta.env.VITE_API_BASE || "";
// In local dev we rely on Vite proxy (/api -> http://localhost:3001),
// so force relative URLs. In production, use VITE_API_BASE when provided.
const BASE = (import.meta as any).env?.DEV ? "" : (import.meta as any).env?.VITE_API_BASE || "";
console.log("API BASE (resolved):", BASE, "(DEV=", (import.meta as any).env?.DEV, ", VITE_API_BASE=", (import.meta as any).env?.VITE_API_BASE, ")");

/* ===== CURRENT USER ROLE HELPER ===== */
export function getCurrentUserRole(): string | null {
  try {
    const user = localStorage.getItem("user");
    if (!user) return null;

    const parsed = JSON.parse(user);
    return parsed.role ?? null;
  } catch {
    return null;
  }
}
export type JsonLike = any;
export type TokenGetter = () => string | null | undefined;
export type Username = string;

/* ================= HEADERS ================= */

function buildHeaders(customHeaders?: Record<string, string>, tokenGetter?: TokenGetter) {
  const token =
    (typeof tokenGetter === "function" ? tokenGetter() : null) ||
    (typeof localStorage !== "undefined" ? localStorage.getItem("token") : null);

  // Check if we should skip Content-Type (for FormData with files)
  const skipContentType = customHeaders?.["X-Skip-Content-Type"] === "true";

  const headers: Record<string, string> = {
    ...(skipContentType ? {} : { "Content-Type": "application/json" }),
    ...(customHeaders || {}),
  };

  // Remove the special header flag
  delete headers["X-Skip-Content-Type"];

  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
}

/* ================= REQUEST HELPERS ================= */

async function requestJson(
  path: string,
  opts: RequestInit = {},
  tokenGetter?: TokenGetter
): Promise<JsonLike> {
  const url = `${BASE}${path}`;
  const headers = buildHeaders(opts.headers as any, tokenGetter);

  const res = await fetch(url, { ...opts, headers, credentials: "include" });

  if (!res.ok) {
    const txt = await res.text();
    let body: any = txt;
    try {
      body = JSON.parse(txt);
    } catch { }

    const err = new Error(
      body?.error ? `HTTP ${res.status}: ${body.error}` : `HTTP ${res.status}: ${txt}`
    );
    (err as any).status = res.status;
    (err as any).body = body;
    throw err;
  }

  if (res.status === 204) return null;
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

async function requestBlob(
  path: string,
  opts: RequestInit = {},
  tokenGetter?: TokenGetter
): Promise<Blob> {
  const url = `${BASE}${path}`;
  const headers = buildHeaders(opts.headers as any, tokenGetter);
  const res = await fetch(url, { ...opts, headers, credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
  return res.blob();
}

async function requestFormData(
  path: string,
  formData: FormData,
  tokenGetter?: TokenGetter
): Promise<any> {
  const url = `${BASE}${path}`;

  const token =
    (typeof tokenGetter === "function" ? tokenGetter() : null) ||
    localStorage.getItem("token");

  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method: "POST",
    body: formData,
    headers, // ❗ NO Content-Type
    credentials: "include",
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt);
  }

  return res.json();
}

/* ================= API SHAPE ================= */

export interface ApiShape {
  getAuthToken?: TokenGetter;

  // admin
  createUser: (payload: {
    username: Username;
    name?: string;
    email: string;
    phone?: string;
    position?: string;
    role?: string;
    password: string;
  }) => Promise<any>;

  getUsers: () => Promise<any>;

  // users (admin)
  // users (admin)
  toggleUserStatus: (id: number, is_active: number) => Promise<any>;
  deleteUser: (id: number, options?: { force?: boolean }) => Promise<any>;


  // stats
  getStats: () => Promise<any>;

  //dahboard
  getDashboardSummary: () => Promise<any>;
  getDashboardActionQuotations: () => Promise<any[]>;
  getDashboardFollowupsDue: () => Promise<any[]>;
  getDashboardRecentActivity: (params?: { limit?: number; offset?: number }) => Promise<any[]>;

  // quotations
  getQuotations: (filters?: {
    status?: string | null;
    validity?: string | null;
    followup?: string | null;
  }) => Promise<any>;

  // purchase dashboard
  getPurchaseSummary: () => Promise<any>;
  getPendingIndents: () => Promise<any[]>;
  getOpenPOs: () => Promise<any[]>;
  getVendorActivity: () => Promise<any[]>;
  getDeliveryAlerts: () => Promise<any[]>;
  getProcurementValue: () => Promise<any>;

  //indents
  getIndent: (id: number | string) => Promise<any>;
  getIndents: () => Promise<any[]>;

  getAvailableIndentItems: (indentId: number | string) => Promise<any[]>,

  createIndent: (payload: any) => Promise<any>;
  updateIndent: (id: number | string, payload: any) => Promise<any>;
  deleteIndent: (id: number | string) => Promise<any>;
  getIndentDocuments: (indentId: number | string) => Promise<any[]>;
  downloadDocument: (documentId: number | string) => Promise<Blob>;

  // create order flow from quotation
  createOrderFromQuotation: (quotationId: number | string) => Promise<any>;

  // sales order (quotation -> sales order)
  createSalesOrderFromQuotation: (quotationId: number | string) => Promise<any>;

  // enquiries
  getEnquiries: (filters?: { status?: string; from?: string; to?: string; limit?: number; q?: string }) => Promise<any[]>;
  createEnquiry: (payload: any) => Promise<any>;
  getEnquiry: (id: number | string) => Promise<any>;
  updateEnquiry: (id: number | string, payload: any) => Promise<any>;
  deleteEnquiry: (id: number | string) => Promise<any>;
  convertEnquiryToQuotation: (id: number | string, payload?: any) => Promise<any>;

  // sales orders
  getSalesOrders: (filters?: { status?: string; from?: string; to?: string; limit?: number }) => Promise<any[]>;
  getSalesOrderById: (id: number | string) => Promise<any>;
  getSalesOrder: (id: number | string) => Promise<any>;
  createSalesOrder: (payload: any) => Promise<any>;
  updateSalesOrder: (id: number | string, payload: any) => Promise<any>;
  deleteSalesOrder: (id: number | string) => Promise<any>;

  // dispatch
  getDispatches: (filters?: { sales_order_id?: number | string; status?: string; from?: string; to?: string; limit?: number }) => Promise<any[]>;
  getDispatchById: (id: number | string) => Promise<any>;
  getDispatch: (id: number | string) => Promise<any>;
  createDispatch: (payload: any) => Promise<any>;
  updateDispatch: (id: number | string, payload: any) => Promise<any>;
  deleteDispatch: (id: number | string) => Promise<any>;

  // invoices
  getInvoices: (filters?: { payment_status?: string; status?: string; from?: string; to?: string; limit?: number }) => Promise<any[]>;
  getInvoiceById: (id: number | string) => Promise<any>;
  createInvoiceFromDispatch: (dispatchId: number | string, payload?: any) => Promise<any>;
  updateInvoicePayment: (invoiceId: number | string, payload: { amount_paid?: number; add_amount?: number }) => Promise<any>;

  // stock ledger
  getAvailableStock: (productId: number | string) => Promise<{ product_id: number; available_qty: number }>;
  getAvailableStockBulk: (productIds: Array<number | string>) => Promise<Array<{ product_id: number; available_qty: number }>>;
  getStockLedger: (filters?: { product_id?: number | string; txn_type?: string; direction?: string; from?: string; to?: string; limit?: number; offset?: number }) => Promise<any[]>;
  getInStock: (filters?: { q?: string; limit?: number; only_positive?: boolean }) => Promise<any[]>;
  postGrnFromPo: (poId: number | string, payload?: { grn_date?: string; remarks?: string }) => Promise<any>;
  postManualStockInward: (payload: { grn_date?: string; remarks?: string; items: Array<{ product_id: number; quantity: number; uom?: string; unit_cost?: number; remarks?: string }> }) => Promise<any>;

  // tally export
  exportInvoicesForTally: (filters?: { from?: string; to?: string; payment_status?: string; status?: string; limit?: number }) => Promise<any>;


  /* ================= VENDORS ================= */

  getVendors: () => Promise<any[]>;
  getVendor: (vendorId: number | string) => Promise<any>;
 updateVendor: (vendorId: number | string, payload: any) => Promise<any>;
  deleteVendor: (vendorId: number | string) => Promise<any>;
  getVendorContacts: (vendorId: number | string) => Promise<any[]>;
  getVendorPurchaseHistory: (vendorId: number | string) => Promise<any[]>;
  getVendorPerformance: (vendorId: number | string) => Promise<any>;
  getVendorProcurement: (vendorId: number | string) => Promise<any>;
  createVendor: (payload: any) => Promise<any>;
  addVendorContact: (vendorId: number | string, payload: {
    name: string;
    designation?: string | null;
    phone?: string | null;
    email?: string | null;
    is_primary?: number;
  }) => Promise<any>;

  saveVendorContacts: (vendorId: number | string, contacts: any[]) => Promise<any>;

  updateVendorContact: (
    vendorId: number | string,
    contactId: number | string,
    payload: any
  ) => Promise<any>;

  deleteVendorContact: (
    vendorId: number | string,
    contactId: number | string
  ) => Promise<any>;

  setPrimaryVendorContact: (
    vendorId: number | string,
    contactId: number | string
  ) => Promise<any>;

  /* ================= PURCHASE ORDERS ================= */

  getPurchaseOrders: (indentId?: string | number | null) => Promise<any>;

  getPurchaseOrder: (id: number | string) => Promise<any>;

  getPurchaseOrderPdf: (id: number | string) => Promise<Blob>;

  deletePurchaseOrder: (id: number | string) => Promise<any>;

  updatePOItemReceived: (itemId: number | string, receivedQty: number) => Promise<any>;

  closePurchaseOrder: (id: number | string, reason: string) => Promise<any>;

  updatePurchaseOrder: (id: number | string, payload: any) => Promise<any>;

  createPurchaseOrder(data: {
    indent_id: string | number;
    created_by: number;
    created_by_name: string;
    items: {
      indent_item_id: number;
      product_name: string;
      product_description: string;
      quantity: number;
      vendor_id: number;
    }[];
  }): Promise<any>;

  getRecentQuotations: () => Promise<any>;
  getQuotation: (id: number | string) => Promise<any>;
  getQuotationPdf: (id: number | string) => Promise<Blob>;
  createQuotation: (payload: any) => Promise<any>;
  deleteQuotation: (id: number | string, options?: { force?: boolean }) => Promise<any>;
  approveQuotation: (id: number | string, payload?: any) => Promise<any>;
  updateQuotation: (id: number | string, payload: Record<string, any>) => Promise<any>;
  markQuotationWon: (id: number | string) => Promise<any>;
  markQuotationLost: (id: number | string, comment: string) => Promise<any>;
  getVersionHistory: (id: number | string) => Promise<any>;
  getQuotationDecisions: (id: number | string) => Promise<any>;
  // ✅ View a specific version snapshot (answers: "where is v0.3?")
  getVersionSnapshot: (id: number | string, versionNumber: string) => Promise<any>;

  reissueQuotation: (
    id: number | string,
    payload: { validity_days: number }
  ) => Promise<{ new_quotation_id: number }>;

  //follow-ups
  getQuotationFollowups: (quotationId: number | string) => Promise<any[]>;
  createQuotationFollowup(
    quotationId: number | string,
    payload: {
      followup_date: string;
      note: string;
      followup_type: "call" | "email" | "whatsapp" | "meeting" | "site_visit" | "other";
      next_followup_date?: string | null;
    }
  ): Promise<any>;

  completeQuotationFollowup: (id: number) => Promise<any>;

  // customers
  getCustomers: () => Promise<any>;
  addCustomer: (payload: any) => Promise<any>;
  updateCustomer: (id: number | string, payload: any) => Promise<any>;
  deleteCustomer: (id: number | string) => Promise<any>;

  // customer locations
  getCustomerLocations: (customerId: number) => Promise<any[]>;
  addCustomerLocation: (
    customerId: number,
    payload: {
      location_name: string;
      gstin?: string;
      address?: string;
      city?: string;
      state?: string;
    }
  ) => Promise<any>;
  updateCustomerLocation: (
    customerId: number,
    locationId: number,
    payload: any
  ) => Promise<any>;
  deleteCustomerLocation: (customerId: number, locationId: number) => Promise<any>;

  // customer contacts
  getCustomerContacts: (locationId: number) => Promise<any[]>;
  addCustomerContact: (
    locationId: number,
    payload: {
      contact_name: string;
      phone?: string;
      email?: string;
      is_primary?: boolean;
    }
  ) => Promise<any>;
  updateCustomerContact: (
    locationId: number,
    contactId: number,
    payload: any
  ) => Promise<any>;
  deleteCustomerContact: (locationId: number, contactId: number) => Promise<any>;
  clearPrimaryContacts: (locationId: number) => Promise<any>;

  // products
  getProducts: () => Promise<any>;
  addProduct: (payload: any) => Promise<any>;
  updateProduct: (id: number | string, payload: any) => Promise<any>;
  deleteProduct: (id: number | string) => Promise<any>;

  uploadProductsExcel: (file: File) => Promise<{
    success: boolean;
    inserted: number;
    updated: number;
    failed: number;
    errors: Array<{
      row: number;
      product: string;
      error: string;
    }>;
  }>;

  getIndentSummary: (id: number | string) => Promise<any>;
  getIndentItems: (id: number | string) => Promise<any[]>;
  getIndentPOHistory: (id: number | string) => Promise<any[]>;
  getIndentPOCount: (id: number | string) => Promise<any>;

  // auth
  login: (payload: any) => Promise<any>;
  getMe: () => Promise<any>;
  getNextQuotationSeq: () => Promise<{ quotation_no: string }>;

  //user management
  updateUser: (
    id: number,
    payload: {
      username: Username;
      name?: string;
      email: string;
      phone?: string;
      position?: string;
      role?: string;
    }
  ) => Promise<any>;

  updateUserPassword: (id: number, password: string) => Promise<any>;
  updateProfile: (payload: { name?: string; email: string; password?: string }) => Promise<any>;
  // reports
  getReportKpis: () => Promise<any>;
  getReportSalesPerformance: () => Promise<any>;
  getReportCustomers: () => Promise<any>;
  getReportProducts: () => Promise<any>;
  getReportPipeline: () => Promise<any>;

  getReportTimeseries: (range: "week" | "month" | "quarter" | "year") => Promise<any>;

  getReportUserMetrics: () => Promise<any>;

  //settings 

  getSettings: () => Promise<any>;
  saveSettings: (payload: any) => Promise<any>;

  // terms & conditions (admin-governed)
  getTerms: () => Promise<{
    terms: string;
    applied_at: string | null;
    applied_by: number | null;
  }>;

  saveTermsDraft: (terms: string) => Promise<{ success: true }>;

  applyTerms: (terms: string) => Promise<{ success: true }>;

  /* ================= ERP SYSTEM (NEW) ================= */
  
  // User and Role Management
  getErpUsers: () => Promise<any[]>;
  getErpUser: (id: number) => Promise<any>;
  assignUserRoles: (userId: number, roleIds: number[]) => Promise<any>;
  
  // Role Management
  getErpRoles: () => Promise<any[]>;
  getErpRole: (id: number) => Promise<any>;
  updateRolePermissions: (roleId: number, permissions: any) => Promise<any>;
  
  // System Settings
  getErpSettings: () => Promise<Record<string, any>>;
  updateErpSetting: (key: string, value: any) => Promise<any>;
  
  // Notifications and Email
  getErpNotifications: () => Promise<any[]>;
  sendErpEmail: (toEmail: string, subject: string, body: string, emailType: string, refType?: string, refId?: number) => Promise<any>;
  sendEmailToRole: (roleName: string, subject: string, body: string) => Promise<any>;

}

/* ================= API IMPLEMENTATION ================= */

export const api: ApiShape = {
  getAuthToken: () => localStorage.getItem("token"),

  /* ================= STATS ================= */
  getStats: () => requestJson("/api/stats"),


  /* ================= DASHBOARD ================= */
  getDashboardSummary: () =>
    requestJson("/api/dashboard/summary"),

  getDashboardActionQuotations: () =>
    requestJson("/api/dashboard/action-quotations"),

  getDashboardFollowupsDue: () =>
    requestJson("/api/dashboard/followups-due"),

  getDashboardRecentActivity: (params?: { limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set("limit", params.limit.toString());
    if (params?.offset) qs.set("offset", params.offset.toString());
    const path = qs.toString() ? `/api/dashboard/recent-activity?${qs}` : "/api/dashboard/recent-activity";
    return requestJson(path)
      .then((r) => (Array.isArray(r) ? r : []))
      .catch(() => []);
  },


  /* ================= QUOTATIONS ================= */
  getQuotations: (filters) => {
    const params = new URLSearchParams();

    if (filters?.status) params.set("status", filters.status);
    if (filters?.validity) params.set("validity", filters.validity);
    if (filters?.followup) params.set("followup", filters.followup);

    const qs = params.toString();
    const path = qs ? `/api/quotations?${qs}` : "/api/quotations";

    return requestJson(path);
  },
  getRecentQuotations: () => requestJson("/api/quotations/recent"),
  getQuotation: (id) =>
    requestJson(`/api/quotations/${id}`).then((r) => r?.quotation ?? r),
  getQuotationPdf: (id) => requestBlob(`/api/quotations/${id}/pdf`),

  createQuotation: (payload) =>
    requestJson("/api/quotations", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  deleteQuotation: (id, options) =>
    requestJson(
      `/api/quotations/${id}${options?.force ? "?force=true" : ""}`,
      { method: "DELETE" }
    ),

  approveQuotation: (id, payload = {}) =>
    requestJson(`/api/quotations/${id}/approve`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  updateQuotation: (id, payload) =>
    requestJson(`/api/quotations/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  reissueQuotation: (id, payload) =>
    requestJson(`/api/quotations/${id}/reissue`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  markQuotationWon: (id) =>
    requestJson(`/api/quotations/${id}/won`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  markQuotationLost: (id, comment) =>
    requestJson(`/api/quotations/${id}/lost`, {
      method: "POST",
      body: JSON.stringify({ comment }),
    }),

  getVersionHistory: (id) =>
    requestJson(`/api/quotations/${id}/versions`)
      .then((r) => (Array.isArray(r) ? r : [])),

  getQuotationDecisions: (id) =>
    requestJson(`/api/quotations/${id}/decisions`).then((r) => r?.decision ?? null),

  // ✅ Get a specific version snapshot - allows viewing v0.3 even when at v0.4
  getVersionSnapshot: (id, versionNumber) =>
    requestJson(`/api/quotations/${id}/version/${versionNumber}`).then((r) => r),



  /* ================= PURCHASE DASHBOARD ================= */

  getPurchaseSummary: () =>
    requestJson("/api/dashboard/purchase-summary")
      .then((r) => r || {})
      .catch(() => ({})),

  getPendingIndents: () =>
    requestJson("/api/dashboard/pending-indents")
      .then((r) => (Array.isArray(r) ? r : []))
      .catch(() => []),

  getOpenPOs: () =>
    requestJson("/api/dashboard/open-pos")
      .then((r) => (Array.isArray(r) ? r : []))
      .catch(() => []),

  getVendorActivity: () =>
    requestJson("/api/dashboard/vendor-activity")
      .then((r) => (Array.isArray(r) ? r : []))
      .catch(() => []),

  getDeliveryAlerts: () =>
    requestJson("/api/dashboard/delivery-alerts")
      .then((r) => (Array.isArray(r) ? r : []))
      .catch(() => []),

  getProcurementValue: () =>
    requestJson("/api/dashboard/procurement-value")
      .then((r) => (Array.isArray(r) ? r : []))
      .catch(() => []),



  /* ================= CUSTOMERS ================= */
  getCustomers: () => requestJson("/api/customers"),

  addCustomer: (payload) =>
    requestJson("/api/customers", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateCustomer: (id, payload) =>
    requestJson(`/api/customers/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  deleteCustomer: (id) =>
    requestJson(`/api/customers/${id}`, { method: "DELETE" }),

  /* ================= INDENTS ================= */

  createIndent: (payload) => {
    const isFormData = payload instanceof FormData;
    const options: any = {
      method: "POST",
    };

    if (isFormData) {
      options.body = payload;
      // Pass a header to indicate FormData so requestJson skips Content-Type
      options.headers = { "X-Skip-Content-Type": "true" };
    } else {
      options.body = JSON.stringify(payload);
    }

    return requestJson("/api/indents", options);
  },

  updateIndent: (id, payload) => {
    const isFormData = payload instanceof FormData;
    const options: any = {
      method: "PUT",
    };

    if (isFormData) {
      options.body = payload;
      // Pass a header to indicate FormData so requestJson skips Content-Type
      options.headers = { "X-Skip-Content-Type": "true" };
    } else {
      options.body = JSON.stringify(payload);
    }

    return requestJson(`/api/indents/${id}`, options);
  },

  deleteIndent: (id) =>
    requestJson(`/api/indents/${id}`, { method: "DELETE" }),

  getIndent: (id) =>
    requestJson(`/api/indents/${id}`),

  getIndents: () =>
    requestJson("/api/indents").then((r) =>
      Array.isArray(r) ? r : []
    ),

  getAvailableIndentItems: (indentId) =>
    requestJson(`/api/indents/${indentId}/available-items`)
      .then((r) => (Array.isArray(r) ? r : [])),

  getIndentSummary: (id) =>
    requestJson(`/api/indents/${id}/summary`),

  getIndentItems: (id) =>
    requestJson(`/api/indents/${id}/items`).then((r) =>
      Array.isArray(r) ? r : []
    ),

  getIndentPOHistory: (id) =>
    requestJson(`/api/indents/${id}/po-history`).then((r) =>
      Array.isArray(r) ? r : []
    ),

  getIndentPOCount: (id) =>
    requestJson(`/api/indents/${id}/po-count`),

  getIndentDocuments: (indentId) =>
    requestJson(`/api/indents/${indentId}/documents`).then((r) =>
      Array.isArray(r) ? r : []
    ),

  // Download document with authentication

  downloadDocument: (documentId) =>
  requestBlob(`/api/indents/document/download/${documentId}`),
  
 
  /* ================= VENDORS (ENTERPRISE READY) ================= */

  getVendors: () =>
    requestJson("/api/vendors").then((r) =>
      Array.isArray(r) ? r : []
    ),

  getVendor: (id) =>
    requestJson(`/api/vendors/${id}`),

  /* 🔥 FIXED: FULL UPDATE (NOT LIMITED FIELDS) */
  updateVendor: (vendorId: number | string, payload: any) =>
    requestJson(`/api/vendors/${vendorId}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    }),

  createVendor: (payload) =>
    requestJson("/api/vendors", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  deleteVendor: (vendorId) =>
    requestJson(`/api/vendors/${vendorId}`, { method: "DELETE" }),

  /* ================= CONTACTS ================= */

  /* GET ALL CONTACTS */
  getVendorContacts: (vendorId) =>
    requestJson(`/api/vendors/${vendorId}/contacts`).then((r) =>
      Array.isArray(r) ? r : []
    ),

  /* ADD SINGLE CONTACT */
  addVendorContact: (vendorId, payload) =>
    requestJson(`/api/vendors/${vendorId}/contacts`, {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  /* 🔥 BULK SAVE (USED IN EDIT PAGE) */
  saveVendorContacts: (vendorId: number | string, contacts: any[]) =>
    requestJson(`/api/vendors/${vendorId}/contacts/bulk`, {
      method: "POST",
      body: JSON.stringify({ contacts })
    }),

  /* UPDATE SINGLE CONTACT */
  updateVendorContact: (vendorId: number | string, contactId: number | string, payload: any) =>
    requestJson(`/api/vendors/${vendorId}/contacts/${contactId}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    }),

  /* DELETE CONTACT */
  deleteVendorContact: (vendorId: number | string, contactId: number | string) =>
    requestJson(`/api/vendors/${vendorId}/contacts/${contactId}`, {
      method: "DELETE"
    }),

  /* 🔥 PRIMARY CONTACT CONTROL */
  setPrimaryVendorContact: (vendorId: number | string, contactId: number | string) =>
    requestJson(`/api/vendors/${vendorId}/contacts/${contactId}/primary`, {
      method: "PUT"
    }),

  /* ================= ANALYTICS ================= */

  getVendorPurchaseHistory: (id) =>
    requestJson(`/api/vendors/${id}/purchase-history`).then((r) =>
      Array.isArray(r) ? r : []
    ),

  getVendorPerformance: (id) =>
    requestJson(`/api/vendors/${id}/performance`),

  getVendorProcurement: (id) =>
    requestJson(`/api/vendors/${id}/procurement`),

  /*===================Follow-ups===================*/
  getQuotationFollowups: (quotationId) =>
    requestJson(`/api/quotations/${quotationId}/followups`)
      .then((r) => (Array.isArray(r) ? r : [])),

  createQuotationFollowup(
    quotationId: number | string,
    payload: {
      followup_date: string;
      note: string;
      followup_type: "call" | "email" | "whatsapp" | "meeting" | "site_visit" | "other";
      next_followup_date?: string | null;
    }
  ) {
    return requestJson(`/api/quotations/${quotationId}/followups`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },


  completeQuotationFollowup(id: number) {
    return requestJson(`/api/quotation-followups/${id}/complete`, {
      method: "PUT",
    });
  },

  /* ================= CUSTOMER LOCATIONS ================= */
  getCustomerLocations: (customerId) =>
    requestJson(`/api/customers/${customerId}/locations`).then((r) => (Array.isArray(r) ? r : [])),

  addCustomerLocation: (customerId, payload) =>
    requestJson(`/api/customers/${customerId}/locations`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateCustomerLocation: (customerId, locationId, payload) =>
    requestJson(`/api/customers/${customerId}/locations/${locationId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  deleteCustomerLocation: (customerId, locationId) =>
    requestJson(`/api/customers/${customerId}/locations/${locationId}`, {
      method: "DELETE",
    }),

  /* ================= CUSTOMER CONTACTS ================= */
  getCustomerContacts: async (locationId: number) => {
    return requestJson(
      `/api/customer-locations/${locationId}/contacts`,
      { method: "GET" }
    );
  },

  addCustomerContact: (locationId, payload) =>
    requestJson(`/api/customer-locations/${locationId}/contacts`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateCustomerContact: (locationId, contactId, payload) =>
    requestJson(`/api/customer-locations/${locationId}/contacts/${contactId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  deleteCustomerContact: (locationId, contactId) =>
    requestJson(`/api/customer-locations/${locationId}/contacts/${contactId}`, {
      method: "DELETE",
    }),

  clearPrimaryContacts: (locationId) =>
    requestJson(`/api/customer-locations/${locationId}/clear-primary`, {
      method: "PUT",
    }),


  /* ================= PRODUCTS ================= */
  getProducts: () => requestJson("/api/products"),

  addProduct: (payload) =>
    requestJson("/api/products", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateProduct: (id, payload) =>
    requestJson(`/api/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),


  deleteProduct: (id) =>
    requestJson(`/api/products/${id}`, { method: "DELETE" }),

  uploadProductsExcel: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    return requestFormData("/api/products/upload", formData);
  },



  /* ================= PURCHASE ORDERS ================= */

  getPurchaseOrders: (indentId?: string | number | null) => {

    if (indentId) {
      return requestJson(`/api/purchase-orders?indent=${indentId}`);
    }

    return requestJson("/api/purchase-orders");
  },

  getPurchaseOrder: (id) =>
    requestJson(`/api/purchase-orders/${id}`),

  getPurchaseOrderPdf: (id) =>
    requestBlob(`/api/quotations/po/${id}/pdf`),

  updatePurchaseOrder: (id, payload) =>
    requestJson(`/api/purchase-orders/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  createPurchaseOrder: (payload) =>
    requestJson("/api/purchase-orders", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  deletePurchaseOrder: (id) =>
    requestJson(`/api/purchase-orders/${id}`, { method: "DELETE" }),

  updatePOItemReceived: (itemId: number | string, receivedQty: number) =>
    requestJson(`/api/po-items/${itemId}/receive`, {
      method: "PUT",
      body: JSON.stringify({ received_qty: receivedQty }),
    }),

  closePurchaseOrder: (id: number | string, reason: string) =>
    requestJson(`/api/purchase-orders/${id}/close`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  /* ================= USERS (ADMIN) ================= */
  getUsers: () => requestJson("/api/users"),

  toggleUserStatus: (id, is_active) =>
    requestJson(`/api/users/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ is_active }),
    }),

  deleteUser: (id, options) =>
    requestJson(
      `/api/users/${id}${options?.force ? "?force=true" : ""}`,
      { method: "DELETE" }
    ),

  updateUser: (id, payload) =>
    requestJson(`/api/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  updateProfile: (payload) =>
    requestJson(`/api/profile`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  updateUserPassword: (id: number, password: string) =>
    requestJson(`/api/users/${id}/password`, {
      method: "PUT",
      body: JSON.stringify({ password }),
    }),


  createUser: (data) => requestJson('/api/users', {
  method: 'POST',
  body: JSON.stringify(data)
}),

  /* ================= AUTH ================= */
  login: (payload) =>
    requestJson("/api/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getMe: () => requestJson("/api/me"),
  getNextQuotationSeq: () =>
    requestJson("/api/quotations/next"),

  /* ================= QUOTATION -> ORDER FLOW ================= */
  createOrderFromQuotation: (quotationId: number | string) =>
    requestJson(`/api/quotations/${quotationId}/create-order`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  /* ================= QUOTATION -> SALES ORDER ================= */
  createSalesOrderFromQuotation: (quotationId: number | string) =>
    requestJson(`/api/sales-orders/from-quotation/${quotationId}`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  /* ================= ENQUIRIES ================= */
  getEnquiries: (filters) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.from) params.set("from", filters.from);
    if (filters?.to) params.set("to", filters.to);
    if (filters?.limit) params.set("limit", String(filters.limit));
    if (filters?.q) params.set("q", String(filters.q));
    const qs = params.toString();
    return requestJson(qs ? `/api/enquiries?${qs}` : "/api/enquiries").then((r) => (Array.isArray(r) ? r : []));
  },
  createEnquiry: (payload) =>
    requestJson("/api/enquiries", {
      method: "POST",
      body: JSON.stringify(payload || {}),
    }),
  getEnquiry: (id) => requestJson(`/api/enquiries/${id}`),
  updateEnquiry: (id, payload) =>
    requestJson(`/api/enquiries/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload || {}),
    }),
  deleteEnquiry: (id) =>
    requestJson(`/api/enquiries/${id}`, {
      method: "DELETE",
    }),

  convertEnquiryToQuotation: (id, payload = {}) =>
    requestJson(`/api/enquiries/${id}/convert-to-quotation`, {
      method: "POST",
      body: JSON.stringify(payload || {}),
    }),

  /* ================= SALES ORDERS ================= */
  getSalesOrders: (filters) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.from) params.set("from", filters.from);
    if (filters?.to) params.set("to", filters.to);
    if (filters?.limit) params.set("limit", String(filters.limit));
    const qs = params.toString();
    return requestJson(qs ? `/api/sales-orders?${qs}` : "/api/sales-orders").then((r) => (Array.isArray(r) ? r : []));
  },
  getSalesOrderById: (id) => requestJson(`/api/sales-orders/${id}`),
  getSalesOrder: (id) => requestJson(`/api/sales-orders/${id}`),
  createSalesOrder: (payload) =>
    requestJson("/api/sales-orders", {
      method: "POST",
      body: JSON.stringify(payload || {}),
    }),
  updateSalesOrder: (id, payload) =>
    requestJson(`/api/sales-orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload || {}),
    }),
  deleteSalesOrder: (id) =>
    requestJson(`/api/sales-orders/${id}`, {
      method: "DELETE",
    }),

  /* ================= DISPATCH ================= */
  getDispatches: (filters) => {
    const params = new URLSearchParams();
    if (filters?.sales_order_id) params.set("sales_order_id", String(filters.sales_order_id));
    if (filters?.status) params.set("status", String(filters.status));
    if (filters?.from) params.set("from", filters.from);
    if (filters?.to) params.set("to", filters.to);
    if (filters?.limit) params.set("limit", String(filters.limit));
    const qs = params.toString();
    return requestJson(qs ? `/api/dispatches?${qs}` : "/api/dispatches").then((r) => (Array.isArray(r) ? r : []));
  },
  getDispatchById: (id) => requestJson(`/api/dispatches/${id}`),
  getDispatch: (id) => requestJson(`/api/dispatches/${id}`),
  createDispatch: (payload) =>
    requestJson("/api/dispatches", {
      method: "POST",
      body: JSON.stringify(payload || {}),
    }),
  updateDispatch: (id, payload) =>
    requestJson(`/api/dispatches/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload || {}),
    }),
  deleteDispatch: (id) =>
    requestJson(`/api/dispatches/${id}`, {
      method: "DELETE",
    }),

  /* ================= INVOICES ================= */
  getInvoices: (filters) => {
    const params = new URLSearchParams();
    if (filters?.payment_status) params.set("payment_status", String(filters.payment_status));
    if (filters?.status) params.set("status", String(filters.status));
    if (filters?.from) params.set("from", filters.from);
    if (filters?.to) params.set("to", filters.to);
    if (filters?.limit) params.set("limit", String(filters.limit));
    const qs = params.toString();
    return requestJson(qs ? `/api/invoices?${qs}` : "/api/invoices").then((r) => (Array.isArray(r) ? r : []));
  },
  getInvoiceById: (id) => requestJson(`/api/invoices/${id}`),
  createInvoiceFromDispatch: (dispatchId, payload = {}) =>
    requestJson(`/api/invoices/from-dispatch/${dispatchId}`, {
      method: "POST",
      body: JSON.stringify(payload || {}),
    }),
  updateInvoicePayment: (invoiceId, payload) =>
    requestJson(`/api/invoices/${invoiceId}/payment`, {
      method: "PUT",
      body: JSON.stringify(payload || {}),
    }),

  /* ================= STOCK LEDGER / GRN ================= */
  getAvailableStock: (productId) => requestJson(`/api/stock-ledger/available/${productId}`),
  getAvailableStockBulk: (productIds) => {
    const ids = (Array.isArray(productIds) ? productIds : [])
      .map((x) => String(x))
      .filter(Boolean)
      .join(",");
    return requestJson(`/api/stock-ledger/available?product_ids=${encodeURIComponent(ids)}`).then((r) =>
      Array.isArray(r) ? r : [],
    );
  },
  getStockLedger: (filters) => {
    const params = new URLSearchParams();
    if (filters?.product_id) params.set("product_id", String(filters.product_id));
    if (filters?.txn_type) params.set("txn_type", String(filters.txn_type));
    if (filters?.direction) params.set("direction", String(filters.direction));
    if (filters?.from) params.set("from", filters.from);
    if (filters?.to) params.set("to", filters.to);
    if (filters?.limit) params.set("limit", String(filters.limit));
    if (filters?.offset) params.set("offset", String(filters.offset));
    const qs = params.toString();
    return requestJson(qs ? `/api/stock-ledger?${qs}` : "/api/stock-ledger").then((r) => (Array.isArray(r) ? r : []));
  },
  getInStock: (filters) => {
    const params = new URLSearchParams();
    if (filters?.q) params.set("q", String(filters.q));
    if (filters?.limit) params.set("limit", String(filters.limit));
    if (filters?.only_positive != null) params.set("only_positive", String(filters.only_positive));
    const qs = params.toString();
    return requestJson(qs ? `/api/in-stock?${qs}` : "/api/in-stock").then((r) => (Array.isArray(r) ? r : []));
  },
  postGrnFromPo: (poId, payload = {}) =>
    requestJson(`/api/grn/from-po/${poId}`, {
      method: "POST",
      body: JSON.stringify(payload || {}),
    }),

  postManualStockInward: (payload) =>
    requestJson(`/api/stock-ledger/inward-grn`, {
      method: "POST",
      body: JSON.stringify(payload || {}),
    }),

  /* ================= TALLY EXPORT ================= */
  exportInvoicesForTally: (filters) => {
    const params = new URLSearchParams();
    if (filters?.from) params.set("from", filters.from);
    if (filters?.to) params.set("to", filters.to);
    if (filters?.payment_status) params.set("payment_status", String(filters.payment_status));
    if (filters?.status) params.set("status", String(filters.status));
    if (filters?.limit) params.set("limit", String(filters.limit));
    const qs = params.toString();
    return requestJson(qs ? `/api/tally/invoices?${qs}` : "/api/tally/invoices");
  },

  /* ================= REPORTS (🔥 REQUIRED) ================= */
  getReportKpis: () => requestJson("/api/reports/kpis"),

  getReportSalesPerformance: () =>
    requestJson("/api/reports/sales-performance"),

  getReportCustomers: () =>
    requestJson("/api/reports/customers"),

  getReportProducts: () =>
    requestJson("/api/reports/products"),

  getReportPipeline: () =>
    requestJson("/api/reports/pipeline"),

  getReportTimeseries: (range) =>
    requestJson(`/api/reports/timeseries?range=${range}`),

  getReportUserMetrics: () =>
    requestJson("/api/reports/user-metrics"),

  //settings 

  getSettings: () => requestJson("/api/settings"),

  saveSettings: (payload) =>
    requestJson("/api/settings", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getTerms: () => requestJson("/api/settings/terms"),

  saveTermsDraft: (terms: string) =>
    requestJson("/api/settings/terms/draft", {
      method: "POST",
      body: JSON.stringify({ terms }),
    }),

  applyTerms: (terms: string) =>
    requestJson("/api/settings/terms/apply", {
      method: "POST",
      body: JSON.stringify({ terms }),
    }),

  /* ================= ERP SYSTEM (NEW) ================= */

  // User and Role Management
  getErpUsers: () => requestJson("/api/erp/users"),

  getErpUser: (id) =>
    requestJson(`/api/erp/users/${id}`),

  assignUserRoles: (userId, roleIds) =>
    requestJson(`/api/erp/users/${userId}/assign-role`, {
      method: "PUT",
      body: JSON.stringify({ role_ids: roleIds }),
    }),

  // Role Management
  getErpRoles: () => requestJson("/api/erp/roles"),

  getErpRole: (id) =>
    requestJson(`/api/erp/roles/${id}`),

  updateRolePermissions: (roleId, permissions) =>
    requestJson(`/api/erp/roles/${roleId}`, {
      method: "PUT",
      body: JSON.stringify(permissions),
    }),

  // System Settings
  getErpSettings: () => requestJson("/api/erp/settings"),

  updateErpSetting: (key, value) =>
    requestJson(`/api/erp/settings/${key}`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    }),

  // Notifications and Email
  getErpNotifications: () => requestJson("/api/erp/notifications"),

  sendErpEmail: (toEmail, subject, body, emailType, refType, refId) =>
    requestJson("/api/erp/notifications/send-email", {
      method: "POST",
      body: JSON.stringify({
        to_email: toEmail,
        subject,
        body,
        email_type: emailType,
        reference_type: refType,
        reference_id: refId,
      }),
    }),

  sendEmailToRole: (roleName, subject, body) =>
    requestJson("/api/erp/notifications/send-to-role", {
      method: "POST",
      body: JSON.stringify({
        role_name: roleName,
        subject,
        body,
      }),
    }),

};

export default api;