import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "react-toastify";

const Register: React.FC = () => {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [strength, setStrength] = useState(0);

  // Email & Password validation patterns
  const validateEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const validatePassword = (password: string) =>
    /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/.test(password);

  // Password strength indicator (1-4)
  const checkPasswordStrength = (password: string): number => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[@$!%*?&]/.test(password)) score++;
    return score;
  };

  // Real-time email validation
  useEffect(() => {
    if (form.email && !validateEmail(form.email)) {
      setEmailError("Invalid email format.");
    } else {
      setEmailError("");
    }
  }, [form.email]);

  // Real-time password validation
  useEffect(() => {
    if (form.password) {
      setStrength(checkPasswordStrength(form.password));
      if (!validatePassword(form.password)) {
        setPasswordError(
          "Must be 8+ chars with a letter, number & special symbol."
        );
      } else {
        setPasswordError("");
      }
    } else {
      setStrength(0);
      setPasswordError("");
    }
  }, [form.password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateEmail(form.email)) {
      setEmailError("Please enter a valid email address.");
      return;
    }

    if (!validatePassword(form.password)) {
      setPasswordError(
        "Must be 8+ chars with a letter, number & special symbol."
      );
      return;
    }

    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    const { error } = await signUp(
      form.email,
      form.password,
      form.fullName,
      form.phone
    );
    setIsLoading(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Account created! Check your email for verification.");
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100 p-4">
      <div className="bg-white shadow-2xl rounded-2xl w-full max-w-md p-8 transition-all duration-300 hover:shadow-xl">
        <h2 className="text-3xl font-extrabold text-center text-gray-800 mb-6">
          Create Your Account
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {/* Full Name */}
          <input
            type="text"
            placeholder="Full Name"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            required
            className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-400 transition-all"
          />

          {/* Phone */}
          <input
            type="text"
            placeholder="Phone Number"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-400 transition-all"
          />

          {/* Email */}
          <div className="relative">
            <input
              type="email"
              placeholder="Email Address"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              className={`w-full p-3 border rounded-xl outline-none transition-all focus:ring-2 ${
                emailError
                  ? "border-red-500 ring-red-300"
                  : "focus:ring-blue-400"
              }`}
            />
            {form.email && !emailError && (
              <CheckCircle2
                size={20}
                className="absolute right-3 top-3 text-green-500 animate-fade-in"
              />
            )}
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
              className={`w-full p-3 border rounded-xl outline-none transition-all focus:ring-2 ${
                passwordError
                  ? "border-red-500 ring-red-300"
                  : "focus:ring-blue-400"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-gray-500 hover:text-gray-700 transition"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {/* Password Strength Bar */}
          {form.password && (
            <div className="flex items-center gap-2 mt-1">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`h-1.5 w-1/4 rounded-full transition-all ${
                    strength >= i
                      ? ["bg-red-500", "bg-yellow-400", "bg-green-500", "bg-blue-600"][i - 1]
                      : "bg-gray-200"
                  }`}
                />
              ))}
              <span className="text-xs text-gray-500 ml-2">
                {strength < 2
                  ? "Weak"
                  : strength === 2
                  ? "Fair"
                  : strength === 3
                  ? "Good"
                  : "Strong"}
              </span>
            </div>
          )}

          {passwordError && (
            <p className="text-red-500 text-sm mt-1">{passwordError}</p>
          )}

          {/* Confirm Password */}
          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"}
              placeholder="Confirm Password"
              value={form.confirmPassword}
              onChange={(e) =>
                setForm({ ...form, confirmPassword: e.target.value })
              }
              required
              className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-400 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-3 text-gray-500 hover:text-gray-700 transition"
            >
              {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="animate-spin mx-auto" />
            ) : (
              "Register"
            )}
          </button>

          {/* Footer */}
          <p className="text-center text-gray-600 text-sm mt-3">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-blue-600 font-semibold hover:underline transition"
            >
              Login
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Register;