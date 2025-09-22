
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
  title: string;
  imageUrl?: string;
  currentPrice: number;
  originalPrice?: number;
  discount?: number;
  url: string;
  asin?: string;
  isHot?: boolean;
  premium?: boolean;
  lowestPrice?: number;
  highestPrice?: number;
}

export default function LiveDealsPreview() {
  const [allDeals, setAllDeals] = useState<NormalizedDeal[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const dealsPerPage = 4;

  // Fetch deals with refresh functionality
  const { data, isLoading, error, refetch } = useQuery<any>({
    queryKey: ["/api/amazon/deals", "liveDeals", refreshKey],
    queryFn: async () => {
      console.log("[LiveDealsPreview] Fetching deals from API...");
      const timestamp = Date.now();
      const rotation = refreshKey % 10;
      const res = await fetch(`/api/amazon/deals?category=liveDeals&t=${timestamp}&rotate=${rotation}`);
      
      if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) {
        const text = await res.text();
        console.error("[LiveDealsPreview] Invalid JSON response:", text);
        throw new Error('Invalid response from server');
      }

      const jsonData = await res.json();
      console.log("[LiveDealsPreview] API Success - received data structure:", Object.keys(jsonData));
      console.log("[LiveDealsPreview] Full API response:", jsonData);

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

  // Function to manually refresh deals
  const refreshDeals = () => {
    console.log("[LiveDealsPreview] Manual refresh triggered");
    setRefreshKey(prev => prev + 1);
    refetch();
  };

  // Normalize deals to shared format
  const normalizeDeal = (deal: Deal): NormalizedDeal => {
    const currentPrice = deal.currentPrice || deal.price || 0;
    const originalPrice = deal.originalPrice || deal.msrp || null;
    const discount = deal.savings?.Percentage || 
      (originalPrice && originalPrice > currentPrice 
        ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
        : 0);

    return {
      title: deal.title || 'Product Title Unavailable',
      imageUrl: deal.imageUrl || undefined,
      currentPrice,
      originalPrice: originalPrice || undefined,
      discount: discount || undefined,
      url: deal.affiliateUrl || deal.url || `https://www.amazon.com/dp/${deal.asin}`,
      asin: deal.asin,
      isHot: !deal.savings?.Percentage,
      premium: deal.savings?.Percentage >= 30,
      lowestPrice: currentPrice,
      highestPrice: originalPrice || currentPrice
    };
  };

  // Process deals
  useEffect(() => {
    if (data && Array.isArray(data)) {
      const processedDeals = data.map(normalizeDeal);
      console.log("[LiveDealsPreview] Processed deals count:", processedDeals.length);

      // Apply randomization
      const shuffleAmount = refreshKey % 4 + 1;
      let shuffledDeals = [...processedDeals];
      for (let i = 0; i < shuffleAmount; i++) {
        shuffledDeals = shuffledDeals.sort(() => Math.random() - 0.5);
      }

      setAllDeals(shuffledDeals);
      
      if (shuffledDeals.length !== allDeals.length) {
        setCurrentPage(0);
      }
    }
  }, [data, refreshKey]);

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

  console.log("[LiveDealsPreview] Pagination info:", {
    totalDeals: allDeals.length,
    currentPage,
    totalPages,
    currentDealsCount: currentDeals.length
  });

  if (isLoading) {
    return (
      <div className="bg-white border rounded-xl shadow-sm p-4 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold">Live Deals Right Now</h3>
          <div className="h-8 w-24 bg-slate-100 rounded-md animate-pulse"></div>
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
      <div className="bg-red-600 text-white p-4 mb-4 text-center font-bold text-xl">
        🚨 TEST BANNER - LiveDealsPreview.tsx - REPLIT AI MODIFIED THIS FILE 🚨
      </div>
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold">Live Deals Right Now</h2>
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
              <span className="text-sm text-muted-foreground min-w-[60px] text-center">
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
        <div className="flex items-center gap-2">
          {shouldShowPagination && (
            <span className="text-xs text-muted-foreground">
              {currentDeals.length} of {allDeals.length} cached deals
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

      {!isLoading && currentDeals.length === 0 && (
        <div className="text-sm text-muted-foreground">
          No deals available at this moment. Please try again later.
        </div>
      )}

      {!isLoading && currentDeals.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {currentDeals.map((deal, index) => {
            console.log("[LiveDealsPreview] Rendering deal:", deal);
            const dealKey = deal.asin || `deal-${index}-${deal.title?.substring(0, 20)}`;
            return (
              <SharedProductCard
                key={dealKey}
                title={deal.title}
                imageUrl={deal.imageUrl}
                currentPrice={deal.currentPrice}
                originalPrice={deal.originalPrice}
                discount={deal.discount}
                url={deal.url}
                asin={deal.asin}
                isHot={deal.isHot}
                premium={deal.premium}
                lowestPrice={deal.lowestPrice}
                highestPrice={deal.highestPrice}
              />
            );
          })}
        </div>
      )}
      <p className="text-[10px] text-muted-foreground mt-4">Powered by Amazon Product API</p>
    </div>
  );
}
