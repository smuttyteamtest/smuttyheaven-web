import { Route, Routes } from "react-router-dom";
import NavBar from "./components/NavBar";
import RequireAuth from "./components/RequireAuth";
import BrowsePage from "./pages/BrowsePage";
import HomePage from "./pages/HomePage";
import LibraryPage from "./pages/LibraryPage";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";
import NovelPage from "./pages/NovelPage";
import ReaderPage from "./pages/ReaderPage";
import RegisterPage from "./pages/RegisterPage";

export default function App() {
  return (
    <>
      <NavBar />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/browse" element={<BrowsePage />} />
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
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <footer className="footer">
        <div className="container">
          Novvels — read among the stars <span aria-hidden>✦</span>
        </div>
      </footer>
    </>
  );
}
