import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";

import Login from "./pages/auth/Login";
import Dashboard from "./pages/dashboard/Dashboard";
import AdminHome from "./pages/dashboard/AdminHome";
import VendedorHome from "./pages/dashboard/VendedorHome";
import ProtectedRoute from "./auth/ProtectedRoute";
import SessionCompra from "./pages/session/SessionCompra";
import PreciosDelDia from "./pages/prices/PreciosDelDia";
import Promociones from "./pages/admin/Promociones";
import Vendedores from "./pages/admin/Vendedores";
import Proveedores from "./pages/admin/Proveedores";
import Productos from "./pages/admin/Productos";
import Variantes from "./pages/admin/Variantes";
import PlanificacionSesion from "./pages/session/PlanificacionSesion";
import SessionResumen from "./pages/session/SessionResumen";


createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Acceso para cualquier rol autenticado */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
        </Route>

        {/* Solo ADMIN */}
        <Route element={<ProtectedRoute roles={["ADMIN"]} />}>
          <Route path="/admin" element={<AdminHome />} />
          <Route path="/admin/vendedores" element={<Vendedores />} />
          <Route path="/admin/promociones" element={<Promociones />} />       
          <Route path="/admin/proveedores" element={<Proveedores />} />
          <Route path="/admin/productos" element={<Productos />} />
          <Route path="/admin/variantes" element={<Variantes />} />
          <Route path="/session/planificacion" element={<PlanificacionSesion />} />
          <Route path="/session/resumen" element={<SessionResumen />} />
        </Route>

        {/* ADMIN o VENDEDOR */}
        <Route element={<ProtectedRoute roles={["ADMIN", "VENDEDOR"]} />}>
          <Route path="/vendedor" element={<VendedorHome />} />
          <Route path="/session" element={<SessionCompra />} />
          <Route path="/precios" element={<PreciosDelDia />} />
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
