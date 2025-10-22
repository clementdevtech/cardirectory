import { createContext, useContext, useEffect, useState, ReactNode } from "react";
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

interface AuthContextType {
  user: User | null;
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
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  signUp: async () => ({ success: false }),
  signIn: async () => ({ success: false }),
  signOut: async () => Promise.resolve(),
  verifyEmailStatus: async () => false,
});

export const useAuth = (): AuthContextType => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 🔹 Fetch authenticated user from backend
  const fetchUser = async (): Promise<void> => {
    try {
      const token = localStorage.getItem("auth_token");
      if (!token) return;

      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to fetch user info");

      const data: { user: User } = await res.json();
      if (data?.user) {
        setUser(data.user);
      }
    } catch (err) {
      console.error("Failed to fetch user:", err);
      setUser(null);
    }
  };

  // 🔹 Initialize authentication on app load
  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem("auth_token");

      if (token) {
        await fetchUser();
      } else {
        // fallback to Supabase session (if used)
        const { data } = await supabase.auth.getSession();
        setSession(data.session);
        setUser(data.session?.user ?? null);
      }

      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  // ✅ Sign Up
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

      const data: { message?: string; error?: string } = await res.json();
      if (!res.ok) return { success: false, error: data.error };

      toast.success(data.message || "Account created! Verify your email.");
      return { success: true, message: data.message };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(message);
      return { success: false, error: message };
    }
  };

  // ✅ Sign In
  const signIn = async (email: string, password: string): Promise<SignInResponse> => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data: {
        error?: string;
        message?: string;
        token?: string;
        user?: User;
        session?: Session;
      } = await res.json();

      if (!res.ok) {
        const errorMessage =
          data.error ||
          (res.status === 400
            ? "Invalid request. Please check your input."
            : res.status === 401
            ? "Unauthorized. Incorrect email or password."
            : res.status === 404
            ? "User not found."
            : res.status >= 500
            ? "Server error. Try again later."
            : "Unexpected error.");

        toast.error(errorMessage);
        return { success: false, status: res.status, error: errorMessage };
      }

      if (data.token) localStorage.setItem("auth_token", data.token);
      setUser(data.user ?? null);
      setSession(data.session ?? null);

      toast.success("Login successful!");
      return { success: true, status: res.status, message: "Login successful!" };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network or unexpected error.";
      console.error("⚠️ Login request failed:", err);
      toast.error(message);
      return { success: false, status: 0, error: message };
    }
  };

  // ✅ Sign Out
  const signOut = async (): Promise<void> => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("Supabase sign-out skipped:", err);
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

  // ✅ Verify Email
  const verifyEmailStatus = async (token: string): Promise<boolean> => {
    try {
      const data = await apiRequest("/auth/verify-email", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return Boolean(data?.verified);
    } catch (err) {
      console.error("verifyEmailStatus request failed:", err);
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, session, isLoading, signUp, signIn, signOut, verifyEmailStatus }}
    >
      {children}
    </AuthContext.Provider>
  );
};