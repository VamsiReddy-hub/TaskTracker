import { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { Redirect } from "wouter";

interface ProtectedRouteProps {
  children: ReactNode;
  roles?: string[];
  path?: string;
}

export default function ProtectedRoute({ children, roles, path }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (roles && !roles.includes(user.role)) {
    // Redirect to appropriate dashboard based on user role
    const redirectPath = user.role === 'vendor' ? '/vendor' : 
                        user.role === 'delivery' ? '/delivery' : 
                        '/customer';
    return <Redirect to={redirectPath} />;
  }

  return <>{children}</>;
}
