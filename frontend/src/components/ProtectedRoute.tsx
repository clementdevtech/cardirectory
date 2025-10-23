import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ReactNode } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, isLoading } = useAuth();

  //console.log("🔒 ProtectedRoute check:", { user });
  //console.log("User loaded:", user);
  //console.log("Loading status:", isLoading);

  // ⏳ Wait for auth check before rendering or redirecting
  if (isLoading || user === undefined) {
    return (
      <div className="flex justify-center items-center h-screen text-lg text-gray-600">
        Checking authentication...
      </div>
    );
  }

  // ❌ Redirect if there's absolutely no user
  if (!user) {
    //console.log("🚫 No user found — redirecting to login");
    return <Navigate to="/login" replace />;
  }

  // ✅ Only render when the user is confirmed
  return <>{children}</>;
};

export default ProtectedRoute;
