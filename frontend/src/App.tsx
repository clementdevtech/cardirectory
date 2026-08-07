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
import DealerProfile from "./pages/DealerProfile";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import NotFound from "./pages/NotFound";

// 🔐 Auth Pages
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import VerifyEmail from "./pages/auth/VerifyEmail";
import OAuthCallback from "./pages/auth/OAuthCallback";
import PaymentStatus from "@/pages/PaymentStatus";



// 🧭 Dashboards
import AdminDashboard from "./pages/dashboards/AdminDashboard";
import DealerDashboard from "./pages/dashboards/DealerDashboard";
import SalesDashboard from "./pages/dashboards/SalesDashboard";

// ⚙️ Query Client
const queryClient = new QueryClient();

const router = createBrowserRouter(
  [
    { path: "/", element: <Home /> },
    { path: "/cars", element: <BrowseCars /> },
    { path: "/cars/:slug", element: <CarDetail /> },
    { path: "/dealers", element: <Dealers /> },
    { path: "/dealers/:slug", element: <DealerProfile /> },
    { path: "/pricing", element: <Pricing /> },
    { path: "/contact", element: <Contact /> },
    { path: "/privacy-policy", element: <PrivacyPolicy /> },
    { path: "/terms-of-service", element: <TermsOfService /> },
    { path: "/payment-status", element: <PaymentStatus /> },
    { path: "/login", element: <Login /> },
    { path: "/register", element: <Register /> },
    { path: "/forgot-password", element: <ForgotPassword /> },
    { path: "/reset-password", element: <ResetPassword /> },
    { path: "/verify-email", element: <VerifyEmail /> },
    { path: "/oauth-callback", element: <OAuthCallback /> },
    {
      path: "/post-vehicle",
      element: (
        <ProtectedRoute>
          <PostVehicle />
        </ProtectedRoute>
      ),
    },
    {
      path: "/admin",
      element: (
        <ProtectedRoute allowedRoles={["admin"]} redirectTo="/">
          <AdminDashboard />
        </ProtectedRoute>
      ),
    },
    {
      path: "/dealer",
      element: (
        <ProtectedRoute allowedRoles={["dealer"]} redirectTo="/">
          <DealerDashboard />
        </ProtectedRoute>
      ),
    },
    {
      path: "/dealer/profile",
      element: (
        <ProtectedRoute allowedRoles={["dealer"]} redirectTo="/">
          <DealerDashboard />
        </ProtectedRoute>
      ),
    },
    {
      path: "/sales-dashboard",
      element: (
        <ProtectedRoute allowedRoles={["salesperson", "sales"]} redirectTo="/">
          <SalesDashboard />
        </ProtectedRoute>
      ),
    },
    {
      path: "/checkout",
      element: (
        <ProtectedRoute>
          <Checkout />
        </ProtectedRoute>
      ),
    },
    { path: "*", element: <NotFound /> },
  ],
  {
    future: {
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    },
  }
);

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
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

          <SonnerToaster position="top-center" richColors />
          <ShadToaster />

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
