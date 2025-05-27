import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth";
import Login from "@/pages/login";
import VendorDashboard from "@/pages/vendor-dashboard";
import DeliveryDashboard from "@/pages/delivery-dashboard";
import CustomerTracking from "@/pages/customer-tracking";
import ProtectedRoute from "@/components/ProtectedRoute";
import NotFound from "@/pages/not-found";

function Router() {
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

  return (
    <Switch>
      <Route path="/login" component={Login} />
      
      <ProtectedRoute path="/" roles={['vendor']}>
        <VendorDashboard />
      </ProtectedRoute>
      
      <ProtectedRoute path="/vendor" roles={['vendor']}>
        <VendorDashboard />
      </ProtectedRoute>
      
      <ProtectedRoute path="/delivery" roles={['delivery']}>
        <DeliveryDashboard />
      </ProtectedRoute>
      
      <ProtectedRoute path="/customer" roles={['customer']}>
        <CustomerTracking />
      </ProtectedRoute>
      
      <ProtectedRoute path="/tracking/:orderNumber" roles={['customer', 'vendor', 'delivery']}>
        <CustomerTracking />
      </ProtectedRoute>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
