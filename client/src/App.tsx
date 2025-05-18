import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/hooks/use-auth";

import { ProtectedRoute } from "@/lib/protected-route";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import Home from "@/pages/home";
import Dashboard from "@/pages/dashboard";
import HowItWorks from "@/pages/how-it-works";
import AuthPage from "@/pages/auth-page";
import ProductDetails from "@/pages/product-details";
import FAQ from "@/pages/faq";
import Deals from "@/pages/deals";
import NotFound from "@/pages/not-found";
import ApiMonitor from "@/pages/api-monitor";

function Router() {
  return (
    <Switch>
      <Route path="/">
        <Home />
      </Route>
      <ProtectedRoute path="/dashboard">
        <Dashboard />
      </ProtectedRoute>
      <Route path="/admin/api-monitor">
        <ApiMonitor />
      </Route>
      <Route path="/how-it-works">
        <HowItWorks />
      </Route>
      <Route path="/auth">
        <AuthPage />
      </Route>
      <Route path="/products/:id">
        <ProductDetails />
      </Route>
      <Route path="/faq">
        <FAQ />
      </Route>
      <Route path="/deals">
        <Deals />
      </Route>
      <Route>
        <NotFound />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider defaultTheme="light" storageKey="bytsave-theme">
          <TooltipProvider>
            <div className="flex min-h-screen flex-col">
              <Navbar />
              <main className="flex-1">
                <Router />
              </main>
              <Footer />
            </div>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
