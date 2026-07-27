import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import logo from "@/assets/logo.png";

const Register = () => {
  const { signUp, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const googleCallbackProcessed = useRef(false);

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    password: "",
  });

  // Handle Google login callback - only once
  useEffect(() => {
    if (googleCallbackProcessed.current) return;

    const googleLoginSuccess = searchParams.get('google_login')
    const googleError = searchParams.get('google_error')

    if (googleLoginSuccess === 'success') {
      googleCallbackProcessed.current = true;
      refreshUser().then(() => {
        toast.success('Welcome! Account created and you are now logged in.')
        navigate('/')
        window.history.replaceState({}, document.title, window.location.pathname)
      }).catch(() => {
        toast.error('Failed to load user data')
      })
    } else if (googleError) {
      googleCallbackProcessed.current = true;
      const errorMessages: { [key: string]: string } = {
        cancelled: 'Google registration was cancelled.',
        email_not_verified: 'Your Google email is not verified.',
        failed: 'Google registration failed. Please try again.',
      }
      toast.error(errorMessages[googleError] || 'Google registration failed.')
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [searchParams, refreshUser, navigate])

  const validateEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleGoogleRegistration = () => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || "";
    window.location.assign(`${backendUrl}/auth/google`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError("");
    setIsLoading(true);

    try {
      if (!validateEmail(form.email)) {
        setEmailError("Please enter a valid email address.");
        setIsLoading(false);
        return;
      }

      const { success, error } = await signUp(
        form.email,
        form.password,
        form.fullName,
        form.phone
      );

      if (!success) {
        toast.error(error || "Registration failed. Please try again.");
        return;
      }

      toast.success("🎉 Account created! Check your email for verification.");
      navigate("/login");
    } catch (err: any) {
      toast.error(err.message || "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="bg-white shadow-2xl rounded-2xl w-full max-w-md p-8 space-y-6 transition-all duration-300 hover:shadow-red-100">
        {/* Header */}
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center justify-center space-x-2 mb-3">
            <div className="p-2 rounded-lg">
              <img
                src={logo}
                alt="CarDirectory Logo"
                className="h-10 w-10 object-contain rounded-md"
              />
            </div>
            <span className="text-2xl font-bold text-gray-800">
              Car<span className="text-[#8B0000]">Directory</span>
            </span>
          </div>
          <p className="text-gray-600">
            Create your account to get started with us.
          </p>
        </div>

        <button
          type="button"
          onClick={handleGoogleRegistration}
          className="w-full py-3 rounded-xl border border-gray-300 bg-white font-semibold text-gray-700 transition hover:bg-gray-50 hover:border-gray-400 flex items-center justify-center gap-2"
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-3 text-xs text-gray-400">
          <div className="h-px flex-1 bg-gray-200" />
          <span>OR</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          {/* Full Name */}
          <input
            type="text"
            placeholder="Full Name"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            required
            className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-[#b44b3e]"
          />

          {/* Phone Number */}
          <input
            type="text"
            placeholder="Phone Number"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            required
            className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-[#b44b3e]"
          />

          {/* Email */}
          <div>
            <input
              type="email"
              placeholder="Email Address"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              className={`w-full p-3 border rounded-xl outline-none focus:ring-2 ${
                emailError
                  ? "border-red-500 ring-red-200"
                  : "focus:ring-[#b44b3e]"
              }`}
            />
            {emailError && (
              <p className="text-red-500 text-sm mt-1">{emailError}</p>
            )}
          </div>

          {/* Password */}
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-[#b44b3e] pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-gray-500 hover:text-gray-700"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-3 rounded-xl font-semibold text-white transition ${
              isLoading
                ? "bg-[#b44b3e] opacity-70 cursor-not-allowed"
                : "bg-[#b44b3e] hover:bg-[#8B0000] shadow-md hover:shadow-red-200"
            }`}
          >
            {isLoading ? (
              <Loader2 className="animate-spin mx-auto text-white" />
            ) : (
              "Create Account"
            )}
          </button>

          {/* Login Redirect */}
          <div className="text-center text-sm text-gray-600">
            Already have an account?{" "}
            <a
              href="/login"
              className="text-[#b44b3e] font-semibold hover:underline"
            >
              Login
            </a>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;
