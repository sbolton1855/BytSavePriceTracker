
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Settings, Clock, User } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

const MyAccount: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  // Cooldown is now fixed at 72 hours globally
  const [priceDropAlertsEnabled, setPriceDropAlertsEnabled] = useState<boolean>(true);
  const [isUpdatingAlerts, setIsUpdatingAlerts] = useState(false);
  
  // Get the user's email for settings
  const userEmail = user?.email || localStorage.getItem("bytsave_user_email") || "";
  
  // Load user preferences when email is available
  useEffect(() => {
    const loadUserPreferences = async () => {
      if (!userEmail) return;
      
      try {
        const response = await fetch(`/api/user/preferences?email=${encodeURIComponent(userEmail)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.preferences) {
            setPriceDropAlertsEnabled(data.preferences.priceDropAlertsEnabled);
          }
        }
      } catch (error) {
        console.error('Error loading user preferences:', error);
      }
    };

    loadUserPreferences();
  }, [userEmail]);

  

  // Handle price drop alerts toggle
  const handlePriceDropAlertsToggle = async (enabled: boolean) => {
    if (!userEmail) return;
    
    setIsUpdatingAlerts(true);
    try {
      const response = await fetch('/api/user/price-drop-alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userEmail,
          enabled: enabled
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update price drop alerts setting');
      }

      setPriceDropAlertsEnabled(enabled);
      toast({
        title: "Settings updated",
        description: `Price drop alerts ${enabled ? 'enabled' : 'disabled'}`,
      });
    } catch (error) {
      console.error('Error updating price drop alerts:', error);
      toast({
        title: "Update failed",
        description: "Failed to update price drop alerts setting. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingAlerts(false);
    }
  };

  return (
    <div className="py-10 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Account</h1>
          <p className="mt-2 text-gray-600">
            Manage your alert preferences and account settings
          </p>
        </div>

        {/* Account Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Account Information
            </CardTitle>
            <CardDescription>
              Your account details and profile information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Email Address</Label>
                  <p className="text-sm text-gray-600">{userEmail || "No email available"}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Account Type</Label>
                  <p className="text-sm text-gray-600">Free Account</p>
                </div>
              </div>
              {user?.firstName && (
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Name</Label>
                    <p className="text-sm text-gray-600">{user.firstName}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Settings Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                <div className="text-sm text-gray-600 p-3 bg-blue-50 rounded-lg">
                  <strong>Alert Cooldown:</strong> After receiving a price alert, you won't be notified again for 3 days (72 hours), unless the price drops significantly lower. This prevents spam while ensuring you don't miss major price changes.
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Email Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Email Preferences
              </CardTitle>
              <CardDescription>
                Manage your email notification preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Price Drop Alerts</Label>
                    <p className="text-xs text-gray-500">Receive email notifications when prices drop</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={priceDropAlertsEnabled}
                      onCheckedChange={handlePriceDropAlertsToggle}
                      disabled={isUpdatingAlerts}
                    />
                    {isUpdatingAlerts && (
                      <div className="text-sm text-gray-500">Updating...</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Weekly Summary</Label>
                    <p className="text-xs text-gray-500">Get a weekly recap of your tracked products</p>
                  </div>
                  <div className="text-sm text-gray-400 font-medium">Coming Soon</div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Deal Notifications</Label>
                    <p className="text-xs text-gray-500">Get notified about featured deals and promotions</p>
                  </div>
                  <div className="text-sm text-gray-400 font-medium">Coming Soon</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Additional Settings Placeholder */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Additional Settings</CardTitle>
            <CardDescription>
              More account customization options
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-500 p-4 bg-gray-50 rounded-lg">
              Additional account settings and preferences will be available here in future updates. This may include timezone settings, currency preferences, and more advanced notification options.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MyAccount;
