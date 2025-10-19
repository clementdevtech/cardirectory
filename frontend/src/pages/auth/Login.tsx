import React, { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2, Car } from "lucide-react";
import { toast } from "react-toastify";

const GetStarted = () => {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    password: "",
  });

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setEmailError("");
  setIsLoading(true);

  try {
    if (isLogin) {
      const { success, error } = await signIn(form.email, form.password);
      if (!success) {
        if (data.error) {
          toast.warning(
            data.error ||
            "Your account isn't verified yet. We've resent a verification email. Please check your inbox."
            );
            return { success: false, error: data.error };
            }else {
              toast.error(error || "Invalid credentials.");
              }
              return;
              }
              toast.success("Welcome back!");
              navigate("/");
              } else {
                const { success, error } = await signUp(
                  form.email,
                  form.password,
                  form.fullName,
                  form.phone
                );
      if (!success) throw error;
      toast.success("Account created! Please check your email for verification.");
      setIsLogin(true);
    }
  } catch (err: any) {
    toast.error(err.message || "Something went wrong.");
  } finally {
    setIsLoading(false);
  }
};


  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="bg-white shadow-2xl rounded-2xl w-full max-w-md p-8 space-y-6 transition-all duration-300 hover:shadow-blue-100">
        {/* Header */}
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center justify-center space-x-2 mb-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Car className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-gray-800">
              Car<span className="text-blue-600">Directory</span>
            </span>
          </div>
          <p className="text-gray-600">
            {isLogin
              ? "Welcome back! Please log in to continue."
              : "Create your account to get started."}
          </p>
        </div>

        {/* Toggle Switch */}
        <div className="flex justify-center items-center gap-3 mt-4">
          <span
            className={`cursor-pointer font-medium transition ${
              isLogin ? "text-blue-600" : "text-gray-500"
            }`}
            onClick={() => setIsLogin(true)}
          >
            Login
          </span>
          <div
            className={`relative w-12 h-6 flex items-center bg-gray-200 rounded-full p-1 cursor-pointer transition`}
            onClick={() => setIsLogin(!isLogin)}
          >
            <div
              className={`absolute w-5 h-5 bg-blue-600 rounded-full shadow transform transition-transform duration-300 ${
                isLogin ? "translate-x-0" : "translate-x-6"
              }`}
            />
          </div>
          <span
            className={`cursor-pointer font-medium transition ${
              !isLogin ? "text-blue-600" : "text-gray-500"
            }`}
            onClick={() => setIsLogin(false)}
          >
            Register
          </span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          {!isLogin && (
            <>
              <input
                type="text"
                placeholder="Full Name"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                required
                className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-200"
              />
              <input
                type="text"
                placeholder="Phone Number"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-200"
              />
            </>
          )}

          <div>
            <input
              type="email"
              placeholder="Email Address"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              className={`w-full p-3 border rounded-xl outline-none focus:ring-2 ${
                emailError ? "border-red-500 ring-red-200" : "focus:ring-blue-200"
              }`}
            />
            {emailError && (
              <p className="text-red-500 text-sm mt-1">{emailError}</p>
            )}
          </div>

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-200 pr-10"
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
                ? "bg-blue-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-blue-200"
            }`}
          >
            {isLoading ? (
              <Loader2 className="animate-spin mx-auto text-white" />
            ) : isLogin ? (
              "Login"
            ) : (
              "Create Account"
            )}
          </button>

          {/* Forgot Password (only for Login) */}
          {isLogin && (
            <div className="text-center text-sm text-gray-600">
              <a href="/forgot-password" className="text-blue-600 hover:underline">
                Forgot Password?
              </a>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default GetStarted;
