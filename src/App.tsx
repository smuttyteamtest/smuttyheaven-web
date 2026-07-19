import { Route, Routes } from "react-router-dom";
import NavBar from "./components/NavBar";
import RequireAuth from "./components/RequireAuth";
import RequireRole from "./components/RequireRole";
import { ADMIN_ROLES, STUDIO_ROLES } from "./lib/roles";
import AccountPage from "./pages/AccountPage";
import AdminPage from "./pages/AdminPage";
import BrowsePage from "./pages/BrowsePage";
import CompletedPage from "./pages/CompletedPage";
import HomePage from "./pages/HomePage";
import OriginPage from "./pages/OriginPage";
import LibraryPage from "./pages/LibraryPage";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";
import NovelEditorPage from "./pages/NovelEditorPage";
import NovelPage from "./pages/NovelPage";
import ReaderPage from "./pages/ReaderPage";
import RegisterPage from "./pages/RegisterPage";
import StudioPage from "./pages/StudioPage";

export default function App() {
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <NavBar />
      {/* tabIndex lets the skip link land focus here */}
      <main id="main" className="app-main" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/browse" element={<BrowsePage />} />
          <Route path="/completed" element={<CompletedPage />} />
          <Route path="/origin/:origin" element={<OriginPage />} />
          <Route path="/novel/:novelId/read/:chapterId" element={<ReaderPage />} />
          <Route path="/novel/:id/:slug?" element={<NovelPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/library"
            element={
              <RequireAuth>
                <LibraryPage />
              </RequireAuth>
            }
          />
          <Route
            path="/account"
            element={
              <RequireAuth>
                <AccountPage />
              </RequireAuth>
            }
          />
          <Route
            path="/studio"
            element={
              <RequireRole roles={STUDIO_ROLES}>
                <StudioPage />
              </RequireRole>
            }
          />
          <Route
            path="/studio/novel/:id"
            element={
              <RequireRole roles={STUDIO_ROLES}>
                <NovelEditorPage />
              </RequireRole>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireRole roles={ADMIN_ROLES} who="site admins">
                <AdminPage />
              </RequireRole>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <footer className="footer">
        <div className="container">
          SmuttyHeaven — read among the stars <span aria-hidden>✦</span>
        </div>
      </footer>
    </>
  );
}
