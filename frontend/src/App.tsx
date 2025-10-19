import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  Navigate,
} from "react-router-dom";

import { AuthProvider, useAuth } from "@/hooks/useAuth";

import Home from "./pages/Home";
import BrowseCars from "./pages/BrowseCars";
import CarDetail from "./pages/CarDetail";
import Pricing from "./pages/Pricing";
import Checkout from "./pages/Checkout";
import PostVehicle from "./pages/PostVehicle";
import Contact from "./pages/Contact";
import Dealers from "./pages/Dealers";
import NotFound from "./pages/NotFound";

// Auth Pages
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import VerifyEmail from "./pages/auth/VerifyEmail";

// Role-specific dashboards
import AdminDashboard from "./pages/AdminDashboard";
import DealerDashboard from "./pages/DealerDashboard";

const queryClient = new QueryClient();

// 🧱 Role-based route guard
const ProtectedRoute = ({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: string[];
}) => {
  const { user, userRole, isLoading } = useAuth();

  if (isLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(userRole || ""))
    return <Navigate to="/" replace />;

  return <>{children}</>;
};

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      {/* Public routes */}
      <Route path="/" element={<Home />} />
      <Route path="/cars" element={<BrowseCars />} />
      <Route path="/cars/:id" element={<CarDetail />} />
      <Route path="/dealers" element={<Dealers />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/contact" element={<Contact />} />

      {/* Auth routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />


      {/* Auth-protected routes */}
      <Route
        path="/post-vehicle"
        element={
          <ProtectedRoute>
            <PostVehicle />
          </ProtectedRoute>
        }
      />

      {/* Admin & Dealer dashboards */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dealer"
        element={
          <ProtectedRoute allowedRoles={["dealer"]}>
            <DealerDashboard />
          </ProtectedRoute>
        }
      />

      <Route path="/checkout" element={<Checkout />} />
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <RouterProvider router={router} />
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
