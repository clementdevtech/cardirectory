import React, { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import logo from "@/assets/logo.png";

const Login = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const validateEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

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

      const { success, error } = await signIn(form.email, form.password);

      if (!success) {
        toast.error(error || "Invalid credentials.");
        setIsLoading(false);
        return;
      }

      toast.success("Welcome back!");
      navigate("/");
    } catch (err: any) {
      toast.error(err.message || "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="bg-white shadow-2xl rounded-2xl w-full max-w-md p-8 space-y-6 transition-all duration-300 hover:shadow-red-100">
        {/* Logo + Title */}
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
            Welcome back! Please log in to continue.
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          {/* Email Field */}
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

          {/* Password Field */}
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

          {/* Login Button */}
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
              "Login"
            )}
          </button>

          {/* Forgot Password */}
          <div className="text-center text-sm text-gray-600">
            <a
              href="/forgot-password"
              className="text-[#b44b3e] hover:underline font-medium"
            >
              Forgot Password?
            </a>
          </div>

          {/* Register Redirect */}
          <div className="text-center text-sm text-gray-600">
            Don’t have an account?{" "}
            <a
              href="/register"
              className="text-[#b44b3e] font-semibold hover:underline"
            >
              Create one
            </a>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;