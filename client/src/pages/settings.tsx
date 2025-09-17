
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, Heart, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const handleNotificationToggle = async (enabled: boolean) => {
    setIsSaving(true);
    try {
      // TODO: Add API call to save notification preference
      setNotificationsEnabled(enabled);
      toast({
        title: "Settings updated",
        description: `Email notifications ${enabled ? 'enabled' : 'disabled'} successfully.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update notification settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="py-10 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
          <p className="mt-2 text-gray-600">
            Manage your BytSave preferences and account settings
          </p>
        </div>

        <Tabs defaultValue="notifications" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="wishlists" className="flex items-center gap-2">
              <Heart className="h-4 w-4" />
              Wishlists
              <Badge variant="secondary" className="ml-1 text-xs">Soon</Badge>
            </TabsTrigger>
            <TabsTrigger value="account" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Account
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notifications" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Email Preferences</CardTitle>
                <CardDescription>
                  Configure when and how you receive price drop notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">
                        Email Notifications
                      </h3>
                      <p className="text-sm text-gray-600">
                        Receive email alerts when tracked products drop to your target price
                      </p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`text-sm ${!notificationsEnabled ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                        Disabled
                      </span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notificationsEnabled}
                          onChange={(e) => handleNotificationToggle(e.target.checked)}
                          disabled={isSaving}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary peer-disabled:opacity-50"></div>
                      </label>
                      <span className={`text-sm ${notificationsEnabled ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                        Enabled
                      </span>
                    </div>
                  </div>

                  {notificationsEnabled ? (
                    <div className="p-6 bg-green-50 rounded-lg border border-green-200">
                      <h4 className="font-semibold text-green-900 mb-2">
                        ✅ Email Notifications Active
                      </h4>
                      <div className="text-sm text-green-600 space-y-1">
                        <p>• Instant notifications when price targets are met</p>
                        <p>• 72-hour cooldown between duplicate alerts</p>
                        <p>• No spam - only real price drops</p>
                        <p>• You can disable this anytime</p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 bg-orange-50 rounded-lg border border-orange-200">
                      <h4 className="font-semibold text-orange-900 mb-2">
                        📵 Email Notifications Disabled
                      </h4>
                      <div className="text-sm text-orange-600 space-y-2">
                        <p>You won't receive any price drop alerts via email.</p>
                        <p>Your tracked products will continue monitoring prices, but you'll need to check the dashboard manually for updates.</p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleNotificationToggle(true)}
                          disabled={isSaving}
                          className="mt-2 border-orange-300 text-orange-700 hover:bg-orange-100"
                        >
                          Enable Notifications
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    More notification settings coming soon, including:
                  </p>
                  <ul className="mt-2 text-sm text-gray-500 space-y-1">
                    <li>• Custom cooldown periods</li>
                    <li>• Weekly price summaries</li>
                    <li>• Deal recommendations</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="wishlists" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Wishlists
                  <Badge variant="outline">Coming Soon</Badge>
                </CardTitle>
                <CardDescription>
                  Organize your tracked products into custom wishlists
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Heart className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">
                    Wishlists Coming Soon
                  </h3>
                  <p className="text-gray-500 max-w-md mx-auto">
                    Create custom wishlists to organize your tracked products by category, 
                    occasion, or priority. Share lists with family and friends.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="account" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
                <CardDescription>
                  Your BytSave account details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <p className="text-gray-900 bg-gray-50 p-3 rounded border">
                      {user?.email || 'Not available'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Account Type
                    </label>
                    <p className="text-gray-900 bg-gray-50 p-3 rounded border">
                      Free Plan
                    </p>
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">
                    Account Actions
                  </h4>
                  <p className="text-sm text-gray-500">
                    Additional account management options will be available here, 
                    including password changes and account deletion.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
