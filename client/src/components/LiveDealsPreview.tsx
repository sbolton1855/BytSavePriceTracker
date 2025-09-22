import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";

type Deal = {
  asin: string;
  title: string;
  imageUrl: string;
  price: number;
  currentPrice: number;
  originalPrice?: number | null;
  msrp?: number;
  url?: string;
  affiliateUrl?: string;
  savings?: any;
};

export default function LiveDealsPreview() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [allDeals, setAllDeals] = useState<Deal[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const dealsPerPage = 4;

  // Fetch deals with refresh functionality like highlighted-deals
  const { data, isLoading, error } = useQuery<any>({
    queryKey: ["/api/amazon/deals", "liveDeals", refreshKey],
    queryFn: async () => {
      console.log("[LiveDealsPreview] Fetching deals from API...");
      // Add rotation parameter and timestamp to ensure different products
      const timestamp = Date.now();
      const rotation = refreshKey % 10; // Create 10 different product sets
      const res = await fetch(`/api/amazon/deals?category=liveDeals&t=${timestamp}&rotate=${rotation}`);
      if (!res.ok) {
        const errorText = await res.text();
        console.error("[LiveDealsPreview] API Error:", res.status, errorText);
        throw new Error(`Failed to fetch deals: ${res.status}`);
      }
      const jsonData = await res.json();
      console.log("[LiveDealsPreview] API Success - received data structure:", Object.keys(jsonData));
      console.log("[LiveDealsPreview] Full API response:", jsonData);

      // Handle both possible response formats from server
      if (jsonData.data?.deals) {
        return jsonData.data.deals;
      } else if (jsonData.deals) {
        return jsonData.deals;
      } else {
        console.warn("[LiveDealsPreview] Unexpected data structure:", jsonData);
        return [];
      }
    },
    // Disable caching for fresh data like highlighted-deals
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

  // Function to manually refresh deals
  const refreshDeals = () => {
    setRefreshKey(prev => prev + 1);
  };

  // Pagination functions
  const totalPages = Math.ceil(allDeals.length / dealsPerPage);
  const shouldShowPagination = totalPages > 1;

  const goToNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages - 1));
  };

  const goToPrevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 0));
  };

  // Process deals similar to highlighted-deals
  useEffect(() => {
    if (data && Array.isArray(data)) {
      // Map backend fields to UI fields with better error handling
      const processedDeals = data.map((deal) => ({
        ...deal,
        currentPrice: deal.price || 0,
        originalPrice: deal.msrp || null,
        affiliateUrl: deal.url || deal.affiliateUrl,
        // Ensure we have required fields
        title: deal.title || 'Product Title Unavailable',
        imageUrl: deal.imageUrl || null,
        asin: deal.asin || `temp-${Date.now()}`
      }));

      console.log("[LiveDealsPreview] Processed deals count:", processedDeals.length);

      // Add randomization using refreshKey like highlighted-deals
      const shuffleAmount = refreshKey % 4 + 1; // 1-4 based on refreshKey

      // Apply multiple shuffling passes for better randomization
      let shuffledDeals = [...processedDeals];
      for (let i = 0; i < shuffleAmount; i++) {
        shuffledDeals = shuffledDeals.sort(() => Math.random() - 0.5);
      }

      // Store all deals for pagination
      setAllDeals(shuffledDeals);

      // Only reset page if the number of deals changed significantly
      if (shuffledDeals.length !== allDeals.length) {
        setCurrentPage(0);
      }
    }
  }, [data, refreshKey]);

  // Update displayed deals based on pagination
  useEffect(() => {
    const startIndex = currentPage * dealsPerPage;
    const endIndex = startIndex + dealsPerPage;
    setDeals(allDeals.slice(startIndex, endIndex));
  }, [allDeals, currentPage]);

  console.log("[LiveDealsPreview] Raw API response:", data);
  console.log("[LiveDealsPreview] Pagination info:", {
    totalDeals: allDeals.length,
    currentPage,
    totalPages,
    currentDealsCount: deals.length
  });

  if (isLoading) {
    return (
      <div className="bg-white border rounded-xl shadow-sm p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-semibold">Live Deals Right Now</h3>
          <div className="h-8 w-24 bg-slate-100 rounded-md animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-start space-x-3">
              <Skeleton className="h-16 w-16 rounded-md" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error && !isLoading) {
    return (
      <div className="bg-white border rounded-xl shadow-sm p-4">
        <h3 className="text-sm font-semibold mb-2">Live Deals Right Now</h3>
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
          Unable to load deals right now. Please try refreshing the page.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-xl shadow-sm p-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-semibold">Live Deals Right Now</h3>
          {shouldShowPagination && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPrevPage}
                disabled={currentPage === 0}
                className="h-6 w-6 p-0"
              >
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <span className="text-xs text-muted-foreground min-w-[40px] text-center">
                {currentPage + 1}/{totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={goToNextPage}
                disabled={currentPage >= totalPages - 1}
                className="h-6 w-6 p-0"
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {shouldShowPagination && (
            <span className="text-[10px] text-muted-foreground">
              {deals.length} of {allDeals.length}
            </span>
          )}
          <Button 
            onClick={refreshDeals} 
            variant="outline"
            size="sm"
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-100 border border-amber-300 text-amber-800 hover:bg-amber-200 transition-colors text-xs"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </Button>
        </div>
      </div>

      {!isLoading && deals.length === 0 && (
        <div className="text-sm text-muted-foreground">
          No deals available at this moment. Please try again later.
        </div>
      )}

      {!isLoading && deals.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {deals.map((deal, index) => {
            console.log("[LiveDealsPreview] Rendering deal:", deal);
            const dealKey = deal.asin || `deal-${index}-${deal.title?.substring(0, 20)}`;
            return (
              <li key={dealKey} className="flex items-start space-x-3 relative">
                <div className="relative">
                  {deal.imageUrl ? (
                    <img
                      src={deal.imageUrl}
                      alt={deal.title}
                      className="h-16 w-16 object-contain rounded-md bg-gray-50 p-1"
                    />
                  ) : (
                    <div className="h-16 w-16 bg-gray-100 rounded-md flex items-center justify-center">
                      <span className="text-xs text-gray-500">No img</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 line-clamp-2 mb-1">
                    {deal.title}
                  </p>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg font-bold text-primary">
                      ${(deal.currentPrice || deal.price || 0).toFixed(2)}
                    </span>
                    {deal.originalPrice && deal.originalPrice > deal.currentPrice && (
                      <span className="text-xs text-gray-500 line-through">
                        ${deal.originalPrice.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {deal.savings && deal.savings.Percentage && (
                      <>
                        <Badge variant="destructive" className="text-[8px] px-1 py-0 h-4 bg-red-500 text-white">
                          {deal.savings.Percentage}% OFF
                        </Badge>
                        {deal.savings.Percentage >= 30 && (
                          <>
                            <Badge variant="secondary" className="text-[8px] px-1 py-0 h-4 bg-purple-100 text-purple-800">
                              PREMIUM DEAL
                            </Badge>
                          </>
                        )}
                      </>
                    )}
                    {/* Show HOT DEAL badge for all products as fallback */}
                    {(!deal.savings || !deal.savings.Percentage) && (
                      <Badge variant="destructive" className="text-[8px] px-1 py-0 h-4 bg-red-500 text-white">
                        HOT DEAL
                      </Badge>
                    )}
                  </div>
                  {deal.affiliateUrl && (
                    <a
                      href={deal.affiliateUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline mt-1 inline-block font-medium"
                    >
                      View Deal →
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </div>
      )}
      <p className="text-[10px] text-muted-foreground mt-4">Powered by Amazon Product API</p>
    </div>
  );
}