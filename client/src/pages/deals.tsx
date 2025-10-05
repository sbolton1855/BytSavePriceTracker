import React from "react";
import { Helmet } from "react-helmet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import DealsDashboard from "../components/DealsDashboard";
import LiveDealsPreview from "@/components/LiveDealsPreview";
import { useAuth } from "@/hooks/use-auth";

export default function DealsPage() {
  const { user } = useAuth();

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

        {/* 🔧 TODO: Mount new <SharedDealsTab /> component here later */}
      </div>
    </>
  );
}