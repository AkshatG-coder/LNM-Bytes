import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./Layouts/Landing";
import AdminLayout from "./Layouts/AdminLayout";
import Admin from "./Layouts/Admin";
import MenuEditor from "./Layouts/MenuEditor";
import DailySales from "./Layouts/DailySales";
import ShopSettings from "./Layouts/ShopSettings";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Admin />} />
          <Route path="menu" element={<MenuEditor />} />
          <Route path="sales" element={<DailySales />} />
          <Route path="settings" element={<ShopSettings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
