
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Product } from "../../../shared/schema";

export default function LiveDealsPreview() {
  const dealsPerPage = 6;
  const [allDeals, setAllDeals] = useState<Product[]>([]);
  const [currentPage, setCurrentPage] = useState(0);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/amazon/deals", "liveDeals"],
    queryFn: async () => {
      const res = await fetch("/api/amazon/deals?category=liveDeals");
      if (!res.ok) throw new Error("Failed to fetch live deals");
      
      const jsonData = await res.json();
      console.log("[LiveDealsPreview] API Success - received data structure:", Object.keys(jsonData));
      console.log("[LiveDealsPreview] Full API response:", jsonData);
      
      // Handle the nested response structure: { source: "amazon", data: { deals: [...] } }
      let deals = [];
      if (jsonData.data && jsonData.data.deals && Array.isArray(jsonData.data.deals)) {
        deals = jsonData.data.deals;
      } else if (jsonData.deals && Array.isArray(jsonData.deals)) {
        deals = jsonData.deals;
      } else if (Array.isArray(jsonData)) {
        deals = jsonData;
      }
      
      console.log("[LiveDealsPreview] Extracted deals:", deals.length, "deals");
      return deals;
    },
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
    refetchOnWindowFocus: false,
  });

  // Update allDeals when data changes
  useEffect(() => {
    if (Array.isArray(data) && data.length > 0) {
      // Map the deals to ensure consistent property names
      const mappedDeals = data.map(deal => ({
        ...deal,
        currentPrice: deal.currentPrice ?? deal.price ?? 0,
        originalPrice: deal.originalPrice ?? null,
        affiliateUrl: deal.affiliateUrl ?? deal.url,
        asin: deal.asin || `temp-${Date.now()}`
      }));
      setAllDeals(mappedDeals);
      setCurrentPage(0);
      console.log("[LiveDealsPreview] Updated allDeals with", mappedDeals.length, "deals");
    } else {
      setAllDeals([]);
      console.log("[LiveDealsPreview] No deals to display");
    }
  }, [data]);

  const totalPages = Math.ceil(allDeals.length / dealsPerPage);
  const startIndex = currentPage * dealsPerPage;
  const currentDeals = allDeals.slice(startIndex, startIndex + dealsPerPage);

  console.log("[LiveDealsPreview] Pagination info:", {
    totalDeals: allDeals.length,
    currentPage,
    totalPages,
    currentDealsCount: currentDeals.length
  });

  const goToNextPage = () => {
    setCurrentPage(prev => (prev + 1) % totalPages);
  };

  const goToPrevPage = () => {
    setCurrentPage(prev => (prev - 1 + totalPages) % totalPages);
  };

  if (isLoading) {
    return (
      <div className="bg-white border rounded-xl shadow-sm p-4">
        <h3 className="text-sm font-semibold mb-2">Live Deals Right Now</h3>
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
          Loading deals...
        </div>
      </div>
    );
  }

  if (isError || allDeals.length === 0) {
    return (
      <div className="bg-white border rounded-xl shadow-sm p-4">
        <h3 className="text-sm font-semibold mb-2">Live Deals Right Now</h3>
        <div className="text-sm text-muted-foreground">
          {isError ? "Unable to load deals right now. Please try refreshing the page." : "No deals available at this moment. Please try again later."}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-xl shadow-sm p-4">
      {/* Header with pagination controls */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold">Live Deals Right Now</h3>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPrevPage}
              disabled={totalPages <= 1}
              className="h-6 w-6 p-0"
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <span className="text-xs text-muted-foreground">
              {currentPage + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextPage}
              disabled={totalPages <= 1}
              className="h-6 w-6 p-0"
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Deals count */}
      <div className="text-xs text-muted-foreground mb-3">
        Showing {currentDeals.length} of {allDeals.length} live deals
      </div>

      {/* Deals grid */}
      <div className="grid grid-cols-2 gap-3">
        {currentDeals.map((deal, index) => {
          console.log("[LiveDealsPreview] Rendering deal:", deal);
          const dealKey = deal.asin || `deal-${index}-${deal.title?.substring(0, 20)}`;
          
          return (
            <Card key={dealKey} className="overflow-hidden">
              <CardHeader className="p-3">
                <div className="aspect-square bg-gray-50 rounded flex items-center justify-center mb-2">
                  {deal.imageUrl ? (
                    <img
                      src={deal.imageUrl}
                      alt={deal.title}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-xs text-gray-400">No image</div>
                  )}
                </div>
                <CardTitle className="text-sm line-clamp-2">{deal.title}</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="text-primary font-bold text-lg">
                  ${(deal.currentPrice || 0).toFixed(2)}
                </div>
                {deal.affiliateUrl && (
                  <Button
                    asChild
                    size="sm"
                    className="w-full mt-2"
                  >
                    <a
                      href={deal.affiliateUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View Deal
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground mt-4">
        Powered by Amazon Product API
      </p>
    </div>
  );
}
