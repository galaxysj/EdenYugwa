import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Admin from "@/pages/admin";
import AdminSettings from "@/pages/admin-settings";
import Manager from "@/pages/manager";
import Login from "@/pages/login";
import Register from "@/pages/register";
import OrderLookup from "@/pages/order-lookup";
import OrderEdit from "@/pages/order-edit";
import PublicOrder from "@/pages/public-order";
import SecuritySettings from "@/pages/security-settings";
import { ProtectedRoute } from "@/components/protected-route";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/admin/login" component={Login} />
      <Route path="/admin">
        <ProtectedRoute requiredRole="admin">
          <Admin />
        </ProtectedRoute>
      </Route>
      <Route path="/admin-settings">
        <ProtectedRoute requiredRole="admin">
          <AdminSettings />
        </ProtectedRoute>
      </Route>

      <Route path="/manager">
        <ProtectedRoute requiredRole="manager">
          <Manager />
        </ProtectedRoute>
      </Route>
      <Route path="/security-settings">
        <ProtectedRoute requiredRole="manager">
          <SecuritySettings />
        </ProtectedRoute>
      </Route>
      <Route path="/order-lookup" component={OrderLookup} />
      <Route path="/order-edit/:id" component={OrderEdit} />
      <Route path="/order" component={PublicOrder} />
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
