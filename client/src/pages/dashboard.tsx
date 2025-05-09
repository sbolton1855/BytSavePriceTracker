import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ProductsDisplay from "@/components/products-display";
import TrackerForm from "@/components/tracker-form";
import { useAuth } from "@/hooks/use-auth";

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Get the user's email for product tracking
  const userEmail = user?.email || "";

  return (
    <div className="py-10 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Welcome, {user?.firstName || user?.email.split('@')[0] || 'User'}! Track and manage your Amazon price alerts
          </p>
        </div>

        {userEmail ? (
          <Card className="mb-8">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Your Tracked Products</CardTitle>
                <CardDescription>
                  Showing price alerts for {userEmail}
                </CardDescription>
              </div>
              <Button 
                variant="outline"
                onClick={() => setRefreshTrigger(prev => prev + 1)}
              >
                Refresh Products
              </Button>
            </CardHeader>
          </Card>
        ) : (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>No Email Available</CardTitle>
              <CardDescription>
                Please update your profile to include an email address
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <ProductsDisplay email={userEmail} key={refreshTrigger} />

        <div className="mt-12">
          <Card>
            <CardHeader>
              <CardTitle>Track a New Product</CardTitle>
              <CardDescription>
                Add another Amazon product to your tracking list
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TrackerForm 
                onSuccess={() => {
                  // Refresh the product list
                  setRefreshTrigger(prev => prev + 1);
                }} 
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
