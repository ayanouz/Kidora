// ══════════════════════════════════════════════════════════════════
//  KIDORA — Gardes de routes
//  ProtectedRoute : utilisateur connecté
//  ParentRoute    : PARENT ou ADMIN
//  AdminRoute     : ADMIN uniquement
//  Pendant le chargement de /auth/me → spinner (jamais de flash).
// ══════════════════════════════════════════════════════════════════

import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Spinner } from "./ui/Feedback";
import { ROUTES } from "../config";
import { useAuthStore } from "../store/auth.store";

export function ProtectedRoute() {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (status === "loading") return <Spinner className="py-24" />;
  if (status !== "authenticated") {
    return <Navigate to={ROUTES.login} state={{ from: location.pathname }} replace />;
  }
  return <Outlet />;
}

export function ParentRoute() {
  const status = useAuthStore((s) => s.status);
  const role = useAuthStore((s) => s.user?.role);
  const location = useLocation();

  if (status === "loading") return <Spinner className="py-24" />;
  if (status !== "authenticated") {
    return <Navigate to={ROUTES.login} state={{ from: location.pathname }} replace />;
  }
  if (role !== "PARENT" && role !== "ADMIN") {
    return <Navigate to={ROUTES.home} replace />;
  }
  return <Outlet />;
}

export function AdminRoute() {
  const status = useAuthStore((s) => s.status);
  const role = useAuthStore((s) => s.user?.role);
  const location = useLocation();

  if (status === "loading") return <Spinner className="py-24" />;
  if (status !== "authenticated") {
    return <Navigate to={ROUTES.login} state={{ from: location.pathname }} replace />;
  }
  if (role !== "ADMIN") {
    return <Navigate to={ROUTES.home} replace />;
  }
  return <Outlet />;
}
