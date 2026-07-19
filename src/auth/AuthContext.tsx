import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  clearToken,
  getToken,
  setToken,
  setUnauthorizedHandler,
} from "../api/client";
import { fetchMe, login as apiLogin, register as apiRegister } from "../api/endpoints";
import type { PublicUser } from "../api/types";
import { useOptionalToast } from "../components/Toasts";

interface AuthContextValue {
  user: PublicUser | null;
  /** true while restoring the session from a stored token on boot */
  booting: boolean;
  login: (loginId: string, password: string) => Promise<void>;
  register: (data: {
    username: string;
    email: string;
    password: string;
    displayName?: string;
  }) => Promise<void>;
  logout: () => void;
  /** Re-read /api/auth/me — picks up role changes made since login. */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [booting, setBooting] = useState<boolean>(() => getToken() !== null);
  const toast = useOptionalToast();

  // Any 401 anywhere in the app clears the session. Only a *live* session
  // gets the toast — a stale token found on boot just logs out quietly.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (user) toast?.("Your session expired — please log in again.", "info");
      setUser(null);
    });
    return () => setUnauthorizedHandler(null);
  }, [user, toast]);

  // Restore session on boot; /api/auth/me also refreshes the role, which can
  // be stale inside the stored JWT.
  useEffect(() => {
    if (!getToken()) return;
    let alive = true;
    fetchMe()
      .then((me) => {
        if (alive) setUser(me.user);
      })
      .catch(() => {
        // 401 already cleared the token via the client handler; network
        // errors leave the token in place for a retry on next boot.
      })
      .finally(() => {
        if (alive) setBooting(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const login = useCallback(async (loginId: string, password: string) => {
    const res = await apiLogin(loginId, password);
    setToken(res.token);
    setUser(res.user);
  }, []);

  const register = useCallback(
    async (data: {
      username: string;
      email: string;
      password: string;
      displayName?: string;
    }) => {
      const res = await apiRegister(data);
      setToken(res.token);
      setUser(res.user);
    },
    [],
  );

  const logout = useCallback(() => {
    clearToken(); // no logout endpoint — discarding the token is the logout
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!getToken()) return;
    try {
      const me = await fetchMe();
      setUser(me.user);
    } catch {
      // 401 already ended the session via the client handler; on network
      // errors keep showing the user we have.
    }
  }, []);

  const value = useMemo(
    () => ({ user, booting, login, register, logout, refreshUser }),
    [user, booting, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
