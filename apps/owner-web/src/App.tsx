import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Landing from "./Layouts/Landing";
import AdminLayout from "./Layouts/AdminLayout";
import Admin from "./Layouts/Admin";
import MenuEditor from "./Layouts/MenuEditor";
import DailySales from "./Layouts/DailySales";
import ShopSettings from "./Layouts/ShopSettings";
import SuperAdminLayout from "./Layouts/SuperAdminLayout";
import QRScanner from "./Layouts/QRScanner";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Login / Register */}
        <Route path="/" element={<Landing />} />

        {/* ── Super Admin Portal (standalone, no sidebar nav) ── */}
        <Route path="/superadmin" element={<SuperAdminLayout />} />

        {/* ── Regular Owner Dashboard ── */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Admin />} />
          <Route path="menu" element={<MenuEditor />} />
          <Route path="sales" element={<DailySales />} />
          <Route path="scan" element={<QRScanner />} />
          <Route path="settings" element={<ShopSettings />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
