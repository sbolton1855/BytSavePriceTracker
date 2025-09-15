import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ProductsDisplay from "@/components/products-display";
import { AIRecommendations } from "@/components/AIRecommendations";

import ProductSearch from "@/components/product-search";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

const Dashboard: React.FC = () => {
  console.log("📍 Dashboard mounted");
  const { user } = useAuth();
  const { toast } = useToast();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [trackedProducts, setTrackedProducts] = useState<any[]>([]);
  
  // Get the user's email for product tracking
  const [userEmail, setUserEmail] = useState<string>(() => {
    // Use authenticated user's email or get from local storage
    return user?.email || localStorage.getItem("bytsave_user_email") || "";
  });
  
  // Debug user info
  useEffect(() => {
    console.log("Dashboard - user info:", user);
    console.log("Dashboard - using email:", userEmail);
  }, [user, userEmail]);
  
  // Update email from user when auth status changes
  useEffect(() => {
    if (user?.email) {
      setUserEmail(user.email);
      localStorage.setItem("bytsave_user_email", user.email);
    }
  }, [user]);

  // Handle successful search and tracking
  const handleSearchSuccess = () => {
    // Get the email from the form if available
    const emailInput = document.querySelector('input[name="email"]') as HTMLInputElement;
    if (emailInput && emailInput.value) {
      const email = emailInput.value;
      setUserEmail(email);
      
      // Save to local storage for persistence
      localStorage.setItem("bytsave_user_email", email);
    }
    
    toast({
      title: "Product tracking started",
      description: "We'll send an email when the price drops below your target.",
    });
    
    // Refresh the product list
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="py-10 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Welcome, {user?.firstName || user?.email.split('@')[0] || 'User'}! Track and manage your Amazon price alerts
          </p>
        </div>

        {!userEmail && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>No Email Available</CardTitle>
              <CardDescription>
                Please update your profile to include an email address or visit <a href="/account" className="text-primary hover:underline">My Account</a> to configure your settings
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* For testing - use hardcoded email if no email is available */}
        <ProductsDisplay 
          email={userEmail || "SBOLTON1855@GMAIL.COM"} 
          key={refreshTrigger}
          onProductsChange={setTrackedProducts}
        />

        {/* AI Recommendations Section */}
        {trackedProducts.length > 0 && (
          <div className="mt-8">
            <AIRecommendations 
              trackedProducts={trackedProducts}
              userEmail={userEmail || "SBOLTON1855@GMAIL.COM"}
            />
          </div>
        )}

        <div className="mt-8" id="search-section">
          <Card>
            <CardHeader>
              <CardTitle>Search & Track Amazon Products</CardTitle>
              <CardDescription>
                Search by name or enter an Amazon URL to track prices
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProductSearch onSuccess={handleSearchSuccess} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
