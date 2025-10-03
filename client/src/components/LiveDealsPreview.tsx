
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import SharedProductCard from "./SharedProductCard";

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

    // Check for Amazon API savings data first
    if (deal.savings?.Amount > 0) {
      savingsAmount = deal.savings.Amount;
      savingsPercentage = deal.savings.Percentage || Math.round(((deal.savings.Amount / currentPrice) / (1 + (deal.savings.Amount / currentPrice))) * 100);
    } 
    // Calculate from original price if available
    else if (originalPrice && originalPrice > currentPrice) {
      savingsAmount = originalPrice - currentPrice;
      savingsPercentage = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
    }

    const computedDiscount = savingsPercentage || (originalPrice && originalPrice > currentPrice 
      ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100) 
      : 0);

    console.log(`[LiveDealsPreview] Normalized deal: ${deal.asin}`, {
      currentPrice,
      originalPrice,
      savingsAmount,
      discount: computedDiscount,
      hasSavings: savingsAmount > 0,
      premium: computedDiscount >= 30,
      isHot: false
    });

    return {
      asin: deal.asin,
      title: deal.title || 'Product Title Unavailable',
      imageUrl: deal.imageUrl || undefined,
      currentPrice,
      originalPrice: originalPrice || undefined,
      savingsAmount: savingsAmount > 0 ? savingsAmount : undefined,
      savingsPercentage: computedDiscount > 0 ? computedDiscount : undefined,
      url: deal.affiliateUrl || deal.url || `https://www.amazon.com/dp/${deal.asin}?tag=bytsave-20`,
    };
  };

  // Process deals
  useEffect(() => {
    if (data && Array.isArray(data)) {
      const processedDeals = data.map(normalizeDeal);
      console.log("[LiveDealsPreview] Processed deals count:", processedDeals.length);

      // Filter to only include deals with actual savings
      const dealsWithSavings = processedDeals.filter(deal => 
        deal.savingsAmount && deal.savingsAmount > 0
      );
      console.log("[LiveDealsPreview] Deals with meaningful savings:", dealsWithSavings.length);

      setAllDeals(dealsWithSavings);

      if (dealsWithSavings.length !== allDeals.length) {
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
      <div className="bg-white border rounded-xl shadow-sm p-4 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">Live Deals Right Now</h2>
          <div className="h-9 w-32 bg-slate-100 rounded-md animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="overflow-hidden h-full">
              <div className="aspect-video bg-slate-100 flex items-center justify-center relative">
                <Skeleton className="h-[140px] w-[200px]" />
                <div className="absolute top-2 right-2">
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </div>
              <div className="p-4">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </div>
              <div className="p-4 pt-0 flex-grow">
                <Skeleton className="h-6 w-24 mb-3" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <div className="mt-3 flex justify-between">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <div className="p-4 pt-0">
                <div className="space-y-2 w-full">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-7 w-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || (!isLoading && !currentDeals.length)) {
    return (
      <div className="bg-white border rounded-xl shadow-sm p-4 space-y-4">
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
    <div className="bg-white border rounded-xl shadow-sm p-4 space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-gray-900">Live Deals Right Now</h3>
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

      {currentDeals.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Always show exactly 4 deals - pad with placeholders if needed */}
          {Array.from({ length: 4 }).map((_, index) => {
            const deal = currentDeals[index];
            if (!deal) {
              // Show placeholder for missing deals
              return (
                <div key={`placeholder-${index}`} className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg p-4 flex items-center justify-center min-h-[300px]">
                  <div className="text-center text-gray-400">
                    <div className="text-sm font-medium">Loading more deals...</div>
                    <div className="text-xs mt-1">Check back soon</div>
                  </div>
                </div>
              );
            }
            
            const dealKey = deal.asin || `deal-${index}-${deal.title?.substring(0, 20)}`;
            
            // Ensure we have a valid URL with affiliate tag
            let affiliateUrl = deal.url || '';
            
            // If no URL but we have ASIN, construct Amazon URL
            if (!affiliateUrl && deal.asin) {
              affiliateUrl = `https://www.amazon.com/dp/${deal.asin}?tag=bytsave-20`;
            }
            
            // If URL exists but missing affiliate tag, add it
            if (affiliateUrl && !affiliateUrl.includes('tag=')) {
              affiliateUrl = affiliateUrl.includes('?') 
                ? `${affiliateUrl}&tag=bytsave-20` 
                : `${affiliateUrl}?tag=bytsave-20`;
            }
            
            console.log('[LiveDealsPreview] Rendering card:', {
              asin: deal.asin,
              title: deal.title?.substring(0, 30),
              affiliateUrl,
              hasUrl: !!affiliateUrl
            });

            console.log(`[LiveDealsPreview DOM DEBUG] ${deal.asin} - Container classes:`, 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6');
            const discount = deal.savingsPercentage || 0;
            const premium = discount >= 30;
            const lowestPrice = deal.currentPrice;
            const highestPrice = deal.originalPrice || deal.currentPrice;

            console.log(`[LiveDealsPreview PROPS DEBUG] ${deal.asin}:`, {
              currentPrice: deal.currentPrice,
              originalPrice: deal.originalPrice,
              discount: discount,
              isHot: false,
              premium: premium,
              lowestPrice: lowestPrice,
              highestPrice: highestPrice
            });

            return (
              <SharedProductCard
                key={dealKey}
                title={deal.title}
                imageUrl={deal.imageUrl}
                currentPrice={deal.currentPrice}
                originalPrice={deal.originalPrice}
                discount={discount}
                url={affiliateUrl || `https://www.amazon.com/dp/${deal.asin}?tag=bytsave-20`}
                asin={deal.asin}
                isHot={false}
                premium={premium}
                lowestPrice={lowestPrice}
                highestPrice={highestPrice}
              />
            );
          })}
        </div>
      )}
      <p className="text-[10px] text-muted-foreground mt-4">Powered by Amazon Product API</p>
    </div>
  );
}
