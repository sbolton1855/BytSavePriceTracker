
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
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

interface NormalizedDeal {
  asin: string;
  title: string;
  imageUrl?: string;
  currentPrice: number;
  originalPrice?: number;
  savingsAmount?: number;
  savingsPercentage?: number;
  url: string;
}

export default function LiveDealsPreview() {
  const [allDeals, setAllDeals] = useState<NormalizedDeal[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const dealsPerPage = 4;

  // Fetch deals with consistent caching
  const { data, isLoading, error, refetch } = useQuery<any>({
    queryKey: ["/api/amazon/deals", "liveDeals"],
    queryFn: async () => {
      console.log("[LiveDealsPreview] Fetching deals from API...");
      const res = await fetch(`/api/amazon/deals?category=liveDeals`);

      if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) {
        const text = await res.text();
        console.error("[LiveDealsPreview] Invalid JSON response:", text);
        throw new Error('Invalid response from server');
      }

      const jsonData = await res.json();
      console.log("[LiveDealsPreview] API Success - received data structure:", Object.keys(jsonData));

      // Standardize deals extraction
      const deals = jsonData.data?.deals || jsonData.deals || jsonData;

      if (!Array.isArray(deals)) {
        console.error("[LiveDealsPreview] Expected deals array, got:", typeof deals);
        return [];
      }

      return deals;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Normalize deals to shared format
  const normalizeDeal = (deal: Deal): NormalizedDeal => {
    const currentPrice = deal.currentPrice || deal.price || 0;
    const originalPrice = deal.originalPrice || deal.msrp || null;
    
    let savingsAmount = 0;
    let savingsPercentage = 0;

    if (deal.savings?.Amount > 0) {
      savingsAmount = deal.savings.Amount;
      savingsPercentage = deal.savings.Percentage;
    } else if (originalPrice && originalPrice > currentPrice) {
      savingsAmount = originalPrice - currentPrice;
      savingsPercentage = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
    }

    return {
      asin: deal.asin,
      title: deal.title || 'Product Title Unavailable',
      imageUrl: deal.imageUrl || undefined,
      currentPrice,
      originalPrice: originalPrice || undefined,
      savingsAmount,
      savingsPercentage,
      url: deal.affiliateUrl || deal.url || `https://www.amazon.com/dp/${deal.asin}`,
    };
  };

  // Process deals
  useEffect(() => {
    if (data && Array.isArray(data)) {
      const processedDeals = data.map(normalizeDeal);
      console.log("[LiveDealsPreview] Processed deals count:", processedDeals.length);

      setAllDeals(processedDeals);

      if (processedDeals.length !== allDeals.length) {
        setCurrentPage(0);
      }
    }
  }, [data]);

  // Pagination logic
  const totalPages = Math.ceil(allDeals.length / dealsPerPage);
  const shouldShowPagination = totalPages > 1;
  const startIndex = currentPage * dealsPerPage;
  const endIndex = startIndex + dealsPerPage;
  const currentDeals = allDeals.slice(startIndex, endIndex);

  const goToNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages - 1));
  };

  const goToPrevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 0));
  };

  // Manual refresh function
  const refreshDeals = () => {
    console.log("[LiveDealsPreview] Manual refresh triggered");
    refetch();
  };

  console.log("[LiveDealsPreview] Pagination info:", {
    totalDeals: allDeals.length,
    currentPage,
    totalPages,
    currentDealsCount: currentDeals.length,
    shouldShowPagination
  });

  if (isLoading) {
    return (
      <div className="bg-white border rounded-xl shadow-sm p-4">
        <div className="flex justify-between items-center mb-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="text-sm text-muted-foreground mb-4">Loading deals...</div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-start space-x-3">
              <Skeleton className="w-14 h-14" />
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

  if (error || (!isLoading && !currentDeals.length)) {
    return (
      <div className="bg-white border rounded-xl shadow-sm p-4">
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-center">No Live Deals Available</CardTitle>
            <CardDescription className="text-center">
              We couldn't find any live deals right now. Please check back later.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-xl shadow-sm p-4">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-semibold">Live Deals Right Now</h3>
          {shouldShowPagination && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPrevPage}
                disabled={currentPage === 0}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-gray-900 min-w-[60px] text-center">
                {currentPage + 1} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={goToNextPage}
                disabled={currentPage >= totalPages - 1}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        <button 
          className={`text-primary-600 hover:text-primary-800 transition-all flex items-center text-sm ${isLoading ? 'opacity-50' : ''}`}
          onClick={refreshDeals}
          disabled={isLoading}
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {!isLoading && currentDeals.length === 0 && (
        <div className="text-sm text-muted-foreground">
          No active live deals with savings found. Check back soon for new price drops!
        </div>
      )}

      <ul className="space-y-3">
        {currentDeals.slice(0, 4).map((deal, index) => (
          <li key={deal.asin || index} className="flex items-start space-x-3 relative">
            <div className="relative">
              {deal.imageUrl ? (
                <img
                  src={deal.imageUrl}
                  alt={deal.title}
                  className="w-14 h-14 object-contain border rounded"
                />
              ) : (
                <div className="w-14 h-14 flex items-center justify-center bg-gray-100 border rounded text-xs text-gray-400">No image</div>
              )}
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium leading-tight line-clamp-2">{deal.title}</p>
              <div className="text-xs mt-1">
                <div className="flex items-center flex-wrap gap-1">
                  <span className="text-xs font-bold text-green-600">${deal.currentPrice?.toFixed(2)}</span>

                  {/* Show savings data if available */}
                  {deal.savingsAmount && deal.savingsAmount > 0 && deal.savingsPercentage && deal.originalPrice && (
                    <>
                      <span className="text-muted-foreground line-through text-xs">
                        ${deal.originalPrice.toFixed(2)}
                      </span>
                      <span className="text-[8px] px-1 py-0 h-4 bg-red-500 text-white rounded-full">
                        {deal.savingsPercentage}% OFF
                      </span>
                      <span className="text-[8px] px-1 py-0 h-4 bg-green-500 text-white rounded-full">
                        Save ${deal.savingsAmount.toFixed(2)}
                      </span>
                    </>
                  )}

                  {/* Fallback for products with original price but no savings data */}
                  {!deal.savingsAmount && deal.originalPrice && deal.originalPrice > deal.currentPrice && (
                    <>
                      <span className="text-muted-foreground line-through text-xs">
                        ${deal.originalPrice.toFixed(2)}
                      </span>
                      <span className="text-[8px] px-1 py-0 h-4 bg-red-500 text-white rounded-full">
                        {Math.round(((deal.originalPrice - deal.currentPrice) / deal.originalPrice) * 100)}% OFF
                      </span>
                      <span className="text-[8px] px-1 py-0 h-4 bg-green-500 text-white rounded-full">
                        Save ${(deal.originalPrice - deal.currentPrice).toFixed(2)}
                      </span>
                    </>
                  )}

                  {/* Only show if there are no savings at all */}
                  {!deal.savingsAmount && (!deal.originalPrice || deal.originalPrice <= deal.currentPrice) && (
                    <span className="text-[8px] text-gray-400">Regular Price</span>
                  )}
                </div>
              </div>
              {deal.url && (
                <a
                  href={deal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline mt-1 inline-block font-medium"
                >
                  View Deal →
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="text-[10px] text-muted-foreground mt-4">Powered by Amazon Product API</p>
    </div>
  );
}
