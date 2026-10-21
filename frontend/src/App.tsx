// ══════════════════════════════════════════════════════════════════
//  KIDORA — Application : provider i18n + routeur
//  Arborescence des routes (§37) :
//   MainLayout  : accueil, jeux, catégories, pages statiques, profils
//   GameLayout  : détail + lecture d'un jeu (GameShell)
//   AuthLayout  : connexion, inscription, mot de passe oublié
//   ParentLayout: espace parents (rôles PARENT / ADMIN)
//   AdminLayout : administration (rôle ADMIN)
// ══════════════════════════════════════════════════════════════════

import { useEffect } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AdminRoute, ParentRoute, ProtectedRoute } from "./components/guards";
import { ROUTES } from "./config";
import { I18nProvider } from "./i18n";
import { AdminLayout } from "./layouts/AdminLayout";
import { AuthLayout } from "./layouts/AuthLayout";
import { GameLayout } from "./layouts/GameLayout";
import { MainLayout } from "./layouts/MainLayout";
import { ParentLayout } from "./layouts/ParentLayout";
import { About } from "./pages/About";
import { Achievements } from "./pages/Achievements";
import { Admin } from "./pages/Admin";
import { Categories } from "./pages/Categories";
import { Category } from "./pages/Category";
import { Contact } from "./pages/Contact";
import { Cookies } from "./pages/Cookies";
import { Favorites } from "./pages/Favorites";
import { ForgotPassword } from "./pages/ForgotPassword";
import { GameDetail } from "./pages/GameDetail";
import { Games } from "./pages/Games";
import { Help } from "./pages/Help";
import { Home } from "./pages/Home";
import { Leaderboard } from "./pages/Leaderboard";
import { Login } from "./pages/Login";
import { NotFound } from "./pages/NotFound";
import { Parent } from "./pages/Parent";
import { ParentChild } from "./pages/ParentChild";
import { Privacy } from "./pages/Privacy";
import { Premium } from "./pages/Premium";
import { Profile } from "./pages/Profile";
import { Register } from "./pages/Register";
import { ResetPassword } from "./pages/ResetPassword";
import { Settings } from "./pages/Settings";
import { Terms } from "./pages/Terms";
import { useAuthStore } from "./store/auth.store";

export function App() {
  const fetchMe = useAuthStore((s) => s.fetchMe);

  // Session existante ?→ /auth/me (cookies HttpOnly, §44)
  useEffect(() => {
    void fetchMe();
  }, [fetchMe]);

  return (
    <I18nProvider>
      <BrowserRouter>
        <Routes>
          {/* ── Site public ─────────────────────────────────── */}
          <Route element={<MainLayout />}>
            <Route path={ROUTES.home} element={<Home />} />
            <Route path={ROUTES.games} element={<Games />} />
            <Route path={ROUTES.categories} element={<Categories />} />
            <Route path={ROUTES.category(":slug")} element={<Category />} />
            <Route path={ROUTES.premium} element={<Premium />} />
            <Route path={ROUTES.leaderboard} element={<Leaderboard />} />
            <Route path={ROUTES.about} element={<About />} />
            <Route path={ROUTES.contact} element={<Contact />} />
            <Route path={ROUTES.help} element={<Help />} />
            <Route path={ROUTES.privacy} element={<Privacy />} />
            <Route path={ROUTES.terms} element={<Terms />} />
            <Route path={ROUTES.cookies} element={<Cookies />} />

            {/* ── Espace connecté ───────────────────────────── */}
            <Route element={<ProtectedRoute />}>
              <Route path={ROUTES.profile} element={<Profile />} />
              <Route path={ROUTES.favorites} element={<Favorites />} />
              <Route path={ROUTES.achievements} element={<Achievements />} />
              <Route path={ROUTES.settings} element={<Settings />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Route>

          {/* ── Jeu (lecture) ───────────────────────────────── */}
          <Route element={<GameLayout />}>
            <Route path={ROUTES.game(":slug")} element={<GameDetail />} />
          </Route>

          {/* ── Authentification ────────────────────────────── */}
          <Route element={<AuthLayout />}>
            <Route path={ROUTES.login} element={<Login />} />
            <Route path={ROUTES.register} element={<Register />} />
            <Route path={ROUTES.forgotPassword} element={<ForgotPassword />} />
            <Route path={ROUTES.resetPassword} element={<ResetPassword />} />
          </Route>

          {/* ── Espace parents (PARENT / ADMIN) ─────────────── */}
          <Route element={<ParentRoute />}>
            <Route element={<ParentLayout />}>
              <Route path={ROUTES.parent} element={<Parent />} />
              <Route path={ROUTES.parentDashboard(":profileId")} element={<ParentChild />} />
            </Route>
          </Route>

          {/* ── Administration (ADMIN) ──────────────────────── */}
          <Route element={<AdminRoute />}>
            <Route element={<AdminLayout />}>
              <Route path={ROUTES.admin} element={<Admin />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </I18nProvider>
  );
}
