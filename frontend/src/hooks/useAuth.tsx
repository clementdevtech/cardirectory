import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "react-toastify";
import { apiRequest } from "@/utils/apiClient";

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: string | null;
  isLoading: boolean;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    phone: string
  ) => Promise<{ success: boolean; message?: string; error?: string }>;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; message?: string; error?: string }>;
  signOut: () => Promise<void>;
  verifyEmailStatus: (token: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  userRole: null,
  isLoading: true,
  signUp: async () => ({ success: false }),
  signIn: async () => ({ success: false }),
  signOut: async () => Promise.resolve(),
  verifyEmailStatus: async () => false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ⚡ Helper to timeout slow network requests
const fetchWithTimeout = (url: string, options: any = {}, timeout = 7000) =>
  Promise.race([
    fetch(url, options),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out")), timeout)
    ),
  ]);

  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem("auth_token");
      if (token) {
        try {
          const res = await fetchWithTimeout(`${API_BASE_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            setUser(data.user);
            setUserRole(data.role || "user");
          }
        } catch (err: any) {
          console.warn("Session restore failed:", err.message);
        }
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

const fetchUserRole = async () => {
  try {
    const token = localStorage.getItem("auth_token");
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });

    if (!res.ok) throw new Error("Failed to fetch role");

    const data = await res.json();
    setUser(data.user);
    setUserRole(data.role || "user");
  } catch (err) {
    console.error("Failed to fetch user role:", err);
    setUserRole("user");
  }
};


  const signUp = async (email: string, password: string, fullName: string, phone: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, fullName, phone }),
      });

      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error };

      toast.success(data.message || "Account created! Verify email.");
      return { success: true, message: data.message };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(message);
      return { success: false, error: message };
    }
  };

const signIn = async (email: string, password: string) => {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    let data: any = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    if (!res.ok) {
      const errorMessage =
        data.error ||
        (res.status === 400
          ? "Invalid request. Please check your input."
          : res.status === 401
          ? "Unauthorized. Incorrect email or password."
          : res.status === 403
          ? "Access forbidden. Contact support if this persists."
          : res.status === 404
          ? "User not found. Please register first."
          : res.status >= 500
          ? "Server error. Please try again later."
          : "Unexpected error occurred.");

      console.error(`❌ HTTP ${res.status}: ${errorMessage}`);
      toast.error(errorMessage); // ✅ Works now

      return { success: false, status: res.status, error: errorMessage };
    }

    if (data.error) {
      toast.error(data.error);
      return { success: false, status: res.status, error: data.error };
    }

    if (data.token) localStorage.setItem("auth_token", data.token);
    setUser(data.user);
    setSession(data.session);
    await fetchUserRole();

    toast.success("Login successful!");
    return { success: true, status: res.status, message: "Login successful!" };
  } catch (err: any) {
    const message = err.message || "Network or unexpected error.";
    console.error("⚠️ Login request failed:", err);
    toast.error(message); // ✅ Works now
    return { success: false, status: 0, error: message };
  }
};



  const signOut = async () => {
    await supabase.auth.signOut();
    await fetch(`${API_BASE_URL}/auth/logout`, { method: "POST", credentials: "include" });
    localStorage.removeItem("auth_token");
    setUser(null);
    setSession(null);
    setUserRole(null);
  };

  const verifyEmailStatus = async (token: string): Promise<boolean> => {
  try {
    const data = await apiRequest("/auth/verify-email", {
      headers: { Authorization: `Bearer ${token}` },
    });

    // ✅ Auto-toast handled in apiRequest
    // but we also ensure we return true/false to VerifyEmail.tsx
    if (data.verified) {
      return true;
    } else {
      // If backend sent an error, ensure it appears in toast
      if (data.error) console.error("Verification failed:", data.error);
      return false;
    }
  } catch (err: any) {
    console.error("verifyEmailStatus request failed:", err);
    return false;
  }
};

  return (
    <AuthContext.Provider
      value={{ user, session, userRole, isLoading, signUp, signIn, signOut, verifyEmailStatus }}
    >
      {children}
    </AuthContext.Provider>
  );
};