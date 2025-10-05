import React from "react";
import { Helmet } from "react-helmet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import DealsDashboard from "../components/DealsDashboard";
import LiveDealsPreview from "@/components/LiveDealsPreview";
import { UnifiedProductCard } from "@/components/UnifiedProductCard";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

export default function DealsPage() {
  const { user } = useAuth();

  // Fetch additional products for the unified grid
  const { data: gridProducts, isLoading } = useQuery({
    queryKey: ['unified-grid-products'],
    queryFn: async () => {
      const response = await fetch('/api/amazon/deals?limit=4');
      if (!response.ok) throw new Error('Failed to fetch products');
      const result = await response.json();
      return result.data?.deals || [];
    },
    refetchInterval: 300000, // Refetch every 5 minutes
  });

  return (
    <>
      <Helmet>
        <title>Amazon Deals & Promotions | BytSave</title>
        <meta name="description" content="Find the best Amazon deals and promotions on beauty products, seasonal sales, and special events. Save money with exclusive discounts." />
      </Helmet>

      <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Amazon Promotions & Deals</h1>
          <p className="mt-4 text-xl text-gray-600">
            Discover the best Amazon deals, curated for maximum savings
          </p>
        </div>

        <Tabs defaultValue="beauty" className="w-full">
          <div className="flex justify-center mb-8">
            <TabsList className="grid grid-cols-3 w-full max-w-md">
              <TabsTrigger value="beauty">Beauty</TabsTrigger>
              <TabsTrigger value="seasonal">Seasonal</TabsTrigger>
              <TabsTrigger value="events">Amazon Events</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="beauty" className="w-full">
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-bold text-gray-900">Amazon Beauty Deals</h2>
              <p className="mt-2 text-gray-600">Top beauty products with the biggest savings</p>
            </div>
            <DealsDashboard
              showTabs={false}
              defaultTab="trending"
              maxDeals={12}
              variant="full"
            />
          </TabsContent>

          <TabsContent value="seasonal" className="w-full">
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-bold text-gray-900">Seasonal Sale</h2>
              <p className="mt-2 text-gray-600">Limited-time seasonal promotions from Amazon</p>
            </div>
            <DealsDashboard
              showTabs={false}
              defaultTab="trending"
              maxDeals={12}
              variant="full"
            />
          </TabsContent>

          <TabsContent value="events" className="w-full">
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-bold text-gray-900">Amazon Events</h2>
              <p className="mt-2 text-gray-600">Special deals from current Amazon promotional events</p>
            </div>
            <DealsDashboard
              showTabs={false}
              defaultTab="live"
              maxDeals={12}
              variant="full"
            />
          </TabsContent>
        </Tabs>

        {/* New 4-Product Grid Section */}
        <div className="space-y-4 mt-12">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Featured Deals</h2>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : gridProducts && gridProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {gridProducts.slice(0, 4).map((product: any) => {
                const currentPrice = product.price || product.currentPrice || 0;
                const originalPrice = product.msrp || product.originalPrice || null;
                const savings = product.savings || {};
                
                return (
                  <UnifiedProductCard
                    key={product.asin}
                    title={product.title || 'Product'}
                    image={product.imageUrl || ''}
                    url={product.url || `https://www.amazon.com/dp/${product.asin}?tag=bytsave-20`}
                    currentPrice={currentPrice.toString()}
                    originalPrice={originalPrice?.toString()}
                    savings={{
                      amount: savings.Amount?.toString() || (originalPrice && originalPrice > currentPrice ? (originalPrice - currentPrice).toFixed(2) : undefined),
                      percentage: savings.Percentage || (originalPrice && originalPrice > currentPrice ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100) : undefined)
                    }}
                    asin={product.asin}
                  />
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              No featured deals available at the moment.
            </div>
          )}
        </div>
      </div>
    </>
  );
}