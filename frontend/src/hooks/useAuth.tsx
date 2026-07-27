import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "react-toastify";
import { apiRequest } from "@/utils/apiClient";
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;

interface SignInResponse {
  success: boolean;
  message?: string;
  error?: string;
  status?: number;
}

interface SignUpResponse {
  success: boolean;
  message?: string;
  error?: string;
}

type AuthUser = User & {
  role?: string;
  full_name?: string;
  is_verified?: boolean;
};

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  isLoading: boolean;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    phone: string
  ) => Promise<SignUpResponse>;
  signIn: (email: string, password: string) => Promise<SignInResponse>;
  signOut: () => Promise<void>;
  verifyEmailStatus: (token: string) => Promise<boolean>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  signUp: async () => ({ success: false }),
  signIn: async () => ({ success: false }),
  signOut: async () => Promise.resolve(),
  verifyEmailStatus: async () => false,
  refreshUser: async () => undefined,
});

export const useAuth = (): AuthContextType => useContext(AuthContext);

const normalizeAuthUser = (value: any): AuthUser | null => {
  if (!value) return null;

  return {
    ...value,
    role: value.role ?? value.app_metadata?.role ?? value.user_metadata?.role ?? undefined,
    full_name: value.full_name ?? value.user_metadata?.full_name ?? value.name ?? undefined,
    is_verified: value.is_verified ?? Boolean(value.email_confirmed_at),
  } as AuthUser;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // -------------------------------------------------------------------------
  // Fetch user from backend (JWT) - Memoized to prevent infinite loops
  // -------------------------------------------------------------------------
  const fetchUser = useCallback(async (): Promise<void> => {
    try {
      const token = localStorage.getItem("auth_token");

      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to fetch user info");

      const data: { user: AuthUser } = await res.json();
      setUser(normalizeAuthUser(data?.user));
    } catch (err) {
      console.error("❌ Failed to fetch user:", err);
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async (): Promise<void> => {
    await fetchUser();
  }, [fetchUser]);

  // -------------------------------------------------------------------------
  // Initialize Authentication
  // -------------------------------------------------------------------------
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem("auth_token");

        if (token) {
          // If we have a token in localStorage, fetch the user
          await fetchUser();
        } else {
          // No token in localStorage, but try backend (might have a cookie)
          try {
            await fetchUser();
          } catch {
            // Backend fetch failed, try Supabase
            const { data } = await supabase.auth.getSession();
            setSession(data.session);
            setUser((prevUser) => {
              if (!data.session?.user) return prevUser;
              return normalizeAuthUser({
                ...data.session.user,
                ...(prevUser ? {
                  role: prevUser.role,
                  full_name: prevUser.full_name,
                  is_verified: prevUser.is_verified,
                } : {}),
              });
            });
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser((prevUser) => {
          if (!session?.user) return prevUser;
          return normalizeAuthUser({
            ...session.user,
            ...(prevUser ? {
              role: prevUser.role,
              full_name: prevUser.full_name,
              is_verified: prevUser.is_verified,
            } : {}),
          });
        });
      }
    );

    const handleRoleRefresh = () => {
      void fetchUser();
    };

    const handleStorageRoleRefresh = (event: StorageEvent) => {
      if (event.key === "auth-role-updated") {
        handleRoleRefresh();
      }
    };

    const handleWindowFocus = () => {
      void handleRoleRefresh();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void handleRoleRefresh();
      }
    };

    const pollInterval = window.setInterval(() => {
      void handleRoleRefresh();
    }, 10000);

    window.addEventListener("auth-role-updated", handleRoleRefresh);
    window.addEventListener("storage", handleStorageRoleRefresh);
    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      listener.subscription.unsubscribe();
      window.clearInterval(pollInterval);
      window.removeEventListener("auth-role-updated", handleRoleRefresh);
      window.removeEventListener("storage", handleStorageRoleRefresh);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchUser]);

  // -------------------------------------------------------------------------
  // SIGN UP
  // -------------------------------------------------------------------------
  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    phone: string
  ): Promise<SignUpResponse> => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, fullName, phone }),
      });

      const data = await res.json();

      if (!res.ok) return { success: false, error: data.error };

      toast.success(data.message || "Account created! Check your email.");
      return { success: true, message: data.message };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(message);
      return { success: false, error: message };
    }
  };

  // -------------------------------------------------------------------------
  // SIGN IN
  // -------------------------------------------------------------------------
  const signIn = async (
    email: string,
    password: string
  ): Promise<SignInResponse> => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMessage =
          data.error ||
          (res.status === 400
            ? "Invalid request."
            : res.status === 401
            ? "Incorrect email or password."
            : res.status === 404
            ? "User not found."
            : "Unexpected error.");

        toast.error(errorMessage);
        return { success: false, status: res.status, error: errorMessage };
      }

      if (data.token) localStorage.setItem("auth_token", data.token);

      setUser(normalizeAuthUser(data.user));
      setSession(data.session ?? null);

      toast.success("Login successful!");
      return { success: true, status: res.status, message: "Login successful!" };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Network or unexpected error.";
      toast.error(message);
      return { success: false, status: 0, error: message };
    }
  };

  // -------------------------------------------------------------------------
  // SIGN OUT (NO EMPTY CATCH BLOCK)
  // -------------------------------------------------------------------------
  const signOut = async (): Promise<void> => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("Supabase signOut failed:", err);
    }

    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });

    localStorage.removeItem("auth_token");
    setUser(null);
    setSession(null);

    toast.info("Logged out successfully");
  };

  // -------------------------------------------------------------------------
  // VERIFY EMAIL
  // -------------------------------------------------------------------------
  const verifyEmailStatus = async (token: string): Promise<boolean> => {
    try {
      const data = await apiRequest("/auth/verify-email", {
        headers: { Authorization: `Bearer ${token}` },
      });

      return Boolean(data?.verified);
    } catch {
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        signUp,
        signIn,
        signOut,
        verifyEmailStatus,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
