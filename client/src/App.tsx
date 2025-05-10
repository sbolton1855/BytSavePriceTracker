import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";

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

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <ProtectedRoute path="/dashboard" component={Dashboard} />
      <Route path="/how-it-works" component={HowItWorks} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/products/:id" component={ProductDetails} />
      <Route path="/faq" component={FAQ} />
      <Route path="/deals" component={Deals} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
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
    </QueryClientProvider>
  );
}

export default App;
