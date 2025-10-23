import { Suspense } from "react";
import {
  RouterProvider,
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  Navigate,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster as ShadToaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { AuthProvider, useAuth } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute"

// 🧩 Pages
import Home from "./pages/Home";
import BrowseCars from "./pages/BrowseCars";
import CarDetail from "./pages/CarDetail";
import Pricing from "./pages/Pricing";
import Checkout from "./pages/Checkout";
import PostVehicle from "./pages/PostVehicle";
import Contact from "./pages/Contact";
import Dealers from "./pages/Dealers";
import NotFound from "./pages/NotFound";

// 🔐 Auth Pages
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import VerifyEmail from "./pages/auth/VerifyEmail";
import PaymentStatus from "@/pages/PaymentStatus";



// 🧭 Dashboards
import AdminDashboard from "./pages/AdminDashboard";
import DealerDashboard from "./pages/DealerDashboard";

// ⚙️ Query Client
const queryClient = new QueryClient();


// 🗺️ Router Definition (All Routes Preserved)
const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      {/* 🌍 Public Routes */}
      <Route path="/" element={<Home />} />
      <Route path="/cars" element={<BrowseCars />} />
      <Route path="/cars/:id" element={<CarDetail />} />
      <Route path="/dealers" element={<Dealers />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/payment-status" element={<PaymentStatus />} />

      {/* 🔐 Authentication */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />

      {/* 🚗 Protected Routes */}
      <Route
        path="/post-vehicle"
        element={
          <ProtectedRoute>
            <PostVehicle />
          </ProtectedRoute>
        }
      />

      {/* 📊 Dashboards */}
      <Route
  path="/admin"
  element={
    <ProtectedRoute>
      <AdminDashboard />
    </ProtectedRoute>
  }
/>

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DealerDashboard />
          </ProtectedRoute>
        }
      />

      {/* 💳 Checkout + 404 */}
      <Route
        path="/checkout"
        element={
          <ProtectedRoute>
            <Checkout />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFound />} />
    </>
  ),
  {
    future: {
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    },
  }
);

// 🧱 Global App Component
const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          {/* ✅ Toastify */}
          <ToastContainer
            position="top-center"
            autoClose={4000}
            hideProgressBar={false}
            closeOnClick
            draggable
            pauseOnHover
            theme="colored"
            toastStyle={{
              backgroundColor: "#7B241C",
              color: "#fff",
              borderRadius: "10px",
              fontWeight: 500,
            }}
          />

          {/* ✅ Shadcn + Sonner Toasters */}
          <SonnerToaster position="top-center" richColors />
          <ShadToaster />

          {/* 🧭 Router with Suspense fallback */}
          <Suspense
            fallback={
              <div className="min-h-screen flex flex-col items-center justify-center text-gray-600 text-lg animate-pulse">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3" />
                Loading page...
              </div>
            }
          >
            <RouterProvider router={router} />
          </Suspense>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
