// src/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
/* Toastify */
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
/* Pages */
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import PurchaseDashboard from "./pages/PurchaseDashboard";
import Quotations from "./pages/Quotations";
import CreateQuotation from "./pages/CreateQuotation";
import QuotationView from "./pages/QuotationView";
import QuotationEdit from "./pages/QuotationEdit";
import Products from "./pages/Products";
import Customers from "./pages/Customers";
import CustomerDetails from "./pages/CustomerDetails";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import Unauthorized from "./pages/Unauthorized";
import AdminUsers from "./pages/AdminUsers";
import UserManagement from "./pages/UserManagement";
import UserProfile from "./pages/UserProfile";
import SystemSettings from "./pages/SystemSettings";
/* INDENT MODULE */
import Indent from "./pages/Indent";
import CreateIndent from "./pages/CreateIndent";
import EditIndent from "./pages/EditIndent";
import IndentView from "./pages/IndentView";
/* PURCHASE ORDER MODULE */
import PurchaseOrders from "./pages/PurchaseOrders";
import CreatePO from "./pages/CreatePO";
import PurchaseOrderView from "./pages/PurchaseOrderView";
import EditPO from "./pages/EditPO";
/* VENDORS */
import Vendors from "./pages/Vendors";
import VendorView from "./pages/VendorView";
import CreateVendor from "./pages/CreateVendor";
import EditVendor from "./pages/EditVendor";

/* ---------------- Protected Shell ---------------- */
type Props = { children: React.ReactNode };

function ProtectedApp({ children }: Props) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function RoleBasedHome() {
  const { user } = useAuth();

  switch (user?.role) {
    case "purchase":
      return <Navigate to="/purchase-dashboard" replace />;

    case "sales":
      return <Navigate to="/dashboard" replace />;

    case "admin":
      return <Navigate to="/dashboard" replace />;

    default:
      return <Navigate to="/unauthorized" replace />;
  }
}
/* ---------------- Permission Guard ---------------- */
function RequirePermission({
  allowed,
  children,
}: {
  allowed: boolean;
  children: React.ReactNode;
}) {
  return allowed ? children : <Navigate to="/unauthorized" replace />;
}

/* ---------------- App ---------------- */
export default function App() {
  const { permissions } = useAuth();

  return (
    <>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/unauthorized" element={<Unauthorized />} />


        {/* Protected Application */}
        <Route
          path="/"
          element={
            <ProtectedApp>
              <RoleBasedHome />
            </ProtectedApp>
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedApp>
              <Dashboard />
            </ProtectedApp>
          }
        />

        <Route
          path="/purchase-dashboard"
          element={
            <ProtectedApp>
              <RequirePermission allowed={permissions.canViewPurchaseOrders}>
                <PurchaseDashboard />
              </RequirePermission>
            </ProtectedApp>
          }
        />

        <Route
          path="/quotations"
          element={
            <ProtectedApp>
              <RequirePermission allowed={permissions.canViewQuotations}>
                <Quotations />
              </RequirePermission>
            </ProtectedApp>
          }
        />

        <Route
          path="/quotations/:id"
          element={
            <ProtectedApp>
              <RequirePermission allowed={permissions.canViewQuotations}>
                <QuotationView />
              </RequirePermission>
            </ProtectedApp>
          }
        />

        <Route
          path="/quotations/:id/edit"
          element={
            <ProtectedApp>
              <RequirePermission allowed={permissions.canCreateQuotation}>
                <QuotationEdit />
              </RequirePermission>
            </ProtectedApp>
          }
        />

        <Route
          path="/create-quotation"
          element={
            <ProtectedApp>
              <RequirePermission allowed={permissions.canCreateQuotation}>
                <CreateQuotation />
              </RequirePermission>
            </ProtectedApp>
          }
        />

        {/* ---------------- INDENTS ---------------- */}

        <Route
          path="/indents"
          element={
            <ProtectedApp>
              <RequirePermission allowed={permissions.canViewIndents}>
                <Indent />
              </RequirePermission>
            </ProtectedApp>
          }
        />

        <Route
          path="/indents/edit/:id"
          element={
            <ProtectedApp>
              <RequirePermission allowed={permissions.canCreateIndent}>
                <EditIndent />
              </RequirePermission>
            </ProtectedApp>
          }
        />

        <Route
          path="/indents/:id"
          element={
            <ProtectedApp>
              <RequirePermission allowed={permissions.canViewIndents}>
                <IndentView />
              </RequirePermission>
            </ProtectedApp>
          }
        />

        <Route
          path="/create-indent"
          element={
            <ProtectedApp>
              <RequirePermission allowed={permissions.canCreateIndent}>
                <CreateIndent />
              </RequirePermission>
            </ProtectedApp>
          }
        />

       /* ---------------- VENDORS ---------------- */

        <Route
          path="/vendors"
          element={
            <ProtectedApp>
              <RequirePermission allowed={permissions.canViewVendors}>
                <Vendors />
              </RequirePermission>
            </ProtectedApp>
          }
        />

        <Route
          path="/vendors/create"
          element={
            <ProtectedApp>
              <RequirePermission allowed={permissions.canCreatePO}>
                <CreateVendor />
              </RequirePermission>
            </ProtectedApp>
          }
        />

        <Route
          path="/vendors/:id"
          element={
            <ProtectedApp>
              <RequirePermission allowed={permissions.canViewVendors}>
                <VendorView />
              </RequirePermission>
            </ProtectedApp>
          }
        />

        <Route
          path="/vendors/edit/:id"
          element={
            <ProtectedApp>
              <RequirePermission allowed={permissions.canCreatePO}>
                <EditVendor />
              </RequirePermission>
            </ProtectedApp>
          }
        />

        {/* ---------------- PURCHASE ORDERS ---------------- */}

        <Route
          path="/purchase-orders"
          element={
            <ProtectedApp>
              <RequirePermission allowed={permissions.canViewPurchaseOrders}>
                <PurchaseOrders />
              </RequirePermission>
            </ProtectedApp>
          }
        />

        <Route
          path="/purchase-orders/:id"
          element={
            <ProtectedApp>
              <RequirePermission allowed={permissions.canViewPurchaseOrders}>
                <PurchaseOrderView />
              </RequirePermission>
            </ProtectedApp>
          }
        />

        <Route
          path="/purchase-orders/edit/:id"
          element={
            <ProtectedApp>
              <RequirePermission allowed={permissions.canCreatePO}>
                <EditPO />
              </RequirePermission>
            </ProtectedApp>
          }
        />

        <Route
          path="/purchase-orders/create/:indentId"
          element={
            <ProtectedApp>
              <RequirePermission allowed={permissions.canCreatePO}>
                <CreatePO />
              </RequirePermission>
            </ProtectedApp>
          }
        />

        <Route
          path="/create-po"
          element={
            <ProtectedApp>
              <RequirePermission allowed={permissions.canCreatePO}>
                <CreatePO />
              </RequirePermission>
            </ProtectedApp>
          }
        />

        <Route
          path="/products"
          element={
            <ProtectedApp>
              <Products />
            </ProtectedApp>
          }
        />

        <Route
          path="/customers"
          element={
            <ProtectedApp>
              <RequirePermission allowed={permissions.canViewCustomers}>
                <Customers />
              </RequirePermission>
            </ProtectedApp>
          }
        />

        <Route
          path="/customers/:id"
          element={
            <ProtectedApp>
              <RequirePermission allowed={permissions.canViewCustomers}>
                <CustomerDetails />
              </RequirePermission>
            </ProtectedApp>
          }
        />

        <Route
          path="/reports"
          element={
            <ProtectedApp>
              <RequirePermission allowed={permissions.canViewReports}>
                <Reports />
              </RequirePermission>
            </ProtectedApp>
          }
        />

        <Route
          path="/users"
          element={
            <ProtectedApp>
              <RequirePermission allowed={permissions.canManageUsers}>
                <AdminUsers />
              </RequirePermission>
            </ProtectedApp>
          }
        />

        <Route
          path="/settings"
          element={
            <ProtectedApp>
              <RequirePermission allowed={permissions.canManageSettings}>
                <Settings />
              </RequirePermission>
            </ProtectedApp>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedApp>
              <Profile />
            </ProtectedApp>
          }
        />

        {/* ================= ERP SYSTEM PAGES ================= */}

        <Route
          path="/user-management"
          element={
            <ProtectedApp>
              <RequirePermission allowed={permissions.canManageUsers}>
                <UserManagement />
              </RequirePermission>
            </ProtectedApp>
          }
        />

        <Route
          path="/user-profile"
          element={
            <ProtectedApp>
              <UserProfile />
            </ProtectedApp>
          }
        />

        <Route
          path="/system-settings"
          element={
            <ProtectedApp>
              <RequirePermission allowed={permissions.canManageSettings}>
                <SystemSettings />
              </RequirePermission>
            </ProtectedApp>
          }
        />

        {/* Catch-all */}
        <Route
          path="*"
          element={
            <ProtectedApp>
              <RoleBasedHome />
            </ProtectedApp>
          }
        />
      </Routes>

      <ToastContainer
        position="top-right"
        autoClose={4000}
        newestOnTop
        pauseOnHover
        theme="light"
      />
    </>
  );
}
