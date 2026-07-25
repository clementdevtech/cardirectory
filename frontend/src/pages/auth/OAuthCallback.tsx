import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

const OAuthCallback = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const error = params.get("error");

        if (error) {
          toast.error(`OAuth error: ${error}`);
          setLoading(false);
          return;
        }

        if (!code) {
          toast.error("Missing authorization code");
          setLoading(false);
          return;
        }

        const backend = import.meta.env.VITE_BACKEND_URL || "";

        const res = await fetch(`${backend}/auth/google/exchange`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ code, redirect_uri: window.location.origin + window.location.pathname }),
        });

        const data = await res.json();
        if (!res.ok || !data?.success) {
          toast.error(data?.error || "Google login failed");
          setLoading(false);
          return;
        }

        // Persist token (backend also set cookie). Reload to let AuthProvider pick up the session.
        if (data.token) localStorage.setItem("auth_token", data.token);

        toast.success("Logged in successfully");
        // Full reload to reinitialize auth state and fetch user
        window.location.replace("/");
      } catch (err: any) {
        toast.error(err?.message || "OAuth exchange failed");
        setLoading(false);
      }
    };

    run();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      {loading ? (
        <div className="text-gray-600">Completing Google sign-in...</div>
      ) : (
        <div className="text-red-600">Could not complete sign-in. Check console.</div>
      )}
    </div>
  );
};

export default OAuthCallback;
