import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import ProductsDisplay from "@/components/products-display";
import { AIRecommendations } from "@/components/AIRecommendations";
import { Settings, Clock } from "lucide-react";

import ProductSearch from "@/components/product-search";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

const Dashboard: React.FC = () => {
  console.log("📍 Dashboard mounted");
  const { user } = useAuth();
  const { toast } = useToast();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [trackedProducts, setTrackedProducts] = useState<any[]>([]);
  const [cooldownHours, setCooldownHours] = useState<number>(48);
  const [isUpdatingCooldown, setIsUpdatingCooldown] = useState(false);
  
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
  
  // Load user preferences when email is available
  useEffect(() => {
    const loadUserPreferences = async () => {
      if (!userEmail) return;
      
      try {
        const response = await fetch(`/api/user/preferences?email=${encodeURIComponent(userEmail)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.preferences) {
            setCooldownHours(data.preferences.cooldownHours);
          }
        }
      } catch (error) {
        console.error('Error loading user preferences:', error);
      }
    };

    loadUserPreferences();
  }, [userEmail]);

  // Update email from user when auth status changes
  useEffect(() => {
    if (user?.email) {
      setUserEmail(user.email);
      localStorage.setItem("bytsave_user_email", user.email);
    }
  }, [user]);
  
  // Handle cooldown update
  const handleCooldownUpdate = async (newCooldownHours: number) => {
    if (!userEmail) return;
    
    setIsUpdatingCooldown(true);
    try {
      const response = await fetch('/api/user/cooldown', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userEmail,
          cooldownHours: newCooldownHours
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update cooldown settings');
      }

      setCooldownHours(newCooldownHours);
      toast({
        title: "Cooldown updated",
        description: `Alert cooldown set to ${newCooldownHours} hours`,
      });
      
      // Refresh the product list to show updated settings
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error updating cooldown:', error);
      toast({
        title: "Update failed",
        description: "Failed to update cooldown settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingCooldown(false);
    }
  };

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
                Please update your profile to include an email address
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Settings Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Notification Settings
              </CardTitle>
              <CardDescription>
                Configure how often you receive price drop notifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Label htmlFor="cooldown-select" className="text-sm font-medium min-w-0">
                    Cooldown Period:
                  </Label>
                  <Select
                    value={cooldownHours.toString()}
                    onValueChange={(value) => handleCooldownUpdate(parseInt(value))}
                    disabled={isUpdatingCooldown}
                  >
                    <SelectTrigger id="cooldown-select" className="w-48">
                      <SelectValue placeholder="Select cooldown period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 hour</SelectItem>
                      <SelectItem value="6">6 hours</SelectItem>
                      <SelectItem value="12">12 hours</SelectItem>
                      <SelectItem value="24">24 hours</SelectItem>
                      <SelectItem value="48">48 hours (recommended)</SelectItem>
                      <SelectItem value="72">72 hours</SelectItem>
                      <SelectItem value="168">1 week</SelectItem>
                    </SelectContent>
                  </Select>
                  {isUpdatingCooldown && (
                    <div className="text-sm text-gray-500">Updating...</div>
                  )}
                </div>
                <div className="text-sm text-gray-600 p-3 bg-blue-50 rounded-lg">
                  <strong>How it works:</strong> After receiving a price alert, you won't get another alert for the same product until {cooldownHours} hours have passed or the price rebounds significantly.
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Account Preferences
              </CardTitle>
              <CardDescription>
                Manage your account settings and preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Email Notifications</Label>
                    <p className="text-xs text-gray-500">Receive price drop alerts via email</p>
                  </div>
                  <div className="text-sm text-green-600 font-medium">Enabled</div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Account Email</Label>
                    <p className="text-xs text-gray-500">{user?.email || userEmail}</p>
                  </div>
                </div>
                <div className="text-xs text-gray-500 p-2 bg-gray-50 rounded">
                  Additional preferences and settings will be available here in future updates.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Divider for Visual Separation */}
        <div className="mb-8">
          <hr className="border-gray-200" />
          <div className="text-center -mt-3">
            <span className="bg-gray-50 px-4 py-1 text-sm font-medium text-gray-500">Your Tracked Products</span>
          </div>
        </div>

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
