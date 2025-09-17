
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Bell, Heart, User } from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();

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
                <div className="p-6 bg-blue-50 rounded-lg border border-blue-200">
                  <h3 className="font-semibold text-blue-900 mb-2">
                    Price Drop Alerts
                  </h3>
                  <p className="text-blue-700 text-sm mb-4">
                    You'll receive email notifications when tracked products drop to your target price.
                  </p>
                  <div className="text-sm text-blue-600">
                    <p>✓ Instant notifications when price targets are met</p>
                    <p>✓ 72-hour cooldown between duplicate alerts</p>
                    <p>✓ No spam - only real price drops</p>
                  </div>
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
