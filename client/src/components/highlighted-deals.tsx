import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { Product } from "../../../shared/schema";
import SharedProductCard from "./SharedProductCard";

type HighlightedDeal = Product & {
  discountPercentage: number;
  savings?: number;
  affiliateUrl?: string;
  isNewAddition?: boolean;
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

export default function HighlightedDeals() {
  const [allDeals, setAllDeals] = useState<NormalizedDeal[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const dealsPerPage = 4;

  // Fetch the trending deals from the API with consistent caching
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["/api/products/deals", "trending"],
    queryFn: async () => {
      console.log("[TrendingNow] Fetching deals from API...");
      const response = await fetch("/api/products/deals?category=trending");

      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
        const text = await response.text();
        console.error("[TrendingNow] Invalid JSON response:", text);
        throw new Error('Invalid response from server');
      }

      const jsonData = await response.json();
      console.log("[TrendingNow] API Success - received data structure:", Object.keys(jsonData));
      console.log("[TrendingNow] Full API response:", jsonData);

      // Standardize deals extraction
      const deals = jsonData.data?.deals || jsonData.deals || jsonData;

      if (!Array.isArray(deals)) {
        console.error("[TrendingNow] Expected deals array, got:", typeof deals);
        return [];
      }

      console.log("[TrendingNow] Raw API response:", deals);
      return deals;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Normalize deals to shared format
  const normalizeDeal = (deal: HighlightedDeal): NormalizedDeal => {
    const currentPrice = deal.price || deal.currentPrice || 0;
    const originalPrice = deal.originalPrice || null;
    const discount = deal.discountPercentage ||
      (originalPrice ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100) : 0);

    return {
      title: deal.title,
      imageUrl: deal.imageUrl || undefined,
      currentPrice,
      originalPrice: originalPrice || undefined,
      discount: discount || undefined,
      url: deal.affiliateUrl || deal.url || `https://www.amazon.com/dp/${deal.asin}`,
      asin: deal.id || deal.asin,
      isHot: false,
      premium: discount >= 30,
      lowestPrice: deal.lowestPrice ?? currentPrice,
      highestPrice: deal.highestPrice ?? originalPrice ?? currentPrice
    };
  };

  // Process and store deals
  useEffect(() => {
    if (data && Array.isArray(data)) {
      const processedDeals = data.map(deal => ({
        ...deal,
        currentPrice: deal.price || deal.currentPrice || 0,
        originalPrice: deal.originalPrice || null,
        affiliateUrl: deal.url || deal.affiliateUrl,
        discountPercentage: deal.discountPercentage ||
          (deal.originalPrice ? Math.round(((deal.originalPrice - (deal.price || deal.currentPrice)) / deal.originalPrice) * 100) : 0),
        savings: deal.savings ||
          (deal.originalPrice ? Math.round((deal.originalPrice - (deal.price || deal.currentPrice)) * 100) / 100 : 0)
      })).map(normalizeDeal);

      console.log("[TrendingNow] Processed deals count:", processedDeals.length);
      setAllDeals(processedDeals);

      // Reset page only if we have new data structure
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
    console.log("[TrendingNow] Manual refresh triggered");
    refetch();
  };

  console.log("[TrendingNow] Pagination info:", {
    totalDeals: allDeals.length,
    currentPage,
    totalPages,
    currentDealsCount: currentDeals.length,
    shouldShowPagination: shouldShowPagination,
    dealsLength: allDeals.length
  });

  if (isLoading) {
    return (
      <div className="bg-white border rounded-xl shadow-sm p-4 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">Trending Now</h2>
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

  if (isError || !currentDeals.length) {
    return (
      <div className="bg-white border rounded-xl shadow-sm p-4 space-y-4">
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-center">No Deals Available</CardTitle>
            <CardDescription className="text-center">
              We couldn't find any trending deals right now. Please check back later.
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
          <h2 className="text-lg font-semibold text-gray-900">Trending Now</h2>
          {shouldShowPagination && (
            <div className="flex items-center gap-2 bg-yellow-100 border border-yellow-300 px-2 py-1 rounded">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPrevPage}
                disabled={currentPage === 0}
                className="h-8 w-8 p-0 bg-white"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-gray-900 min-w-[60px] text-center font-bold">
                {currentPage + 1} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={goToNextPage}
                disabled={currentPage >= totalPages - 1}
                className="h-8 w-8 p-0 bg-white"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-900 bg-blue-100 px-2 py-1 rounded">
            DEBUG: {currentDeals.length} of {allDeals.length} deals | Page {currentPage + 1}/{totalPages} | Show: {shouldShowPagination ? 'YES' : 'NO'}
          </span>
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
      <ul className="space-y-3">
        {currentDeals.map((deal, index) => {
          console.log("[TrendingNow] Rendering deal:", deal);
          const dealKey = deal.asin || `deal-${index}-${deal.title?.substring(0, 20)}`;
          return (
            <li key={dealKey} className="flex items-start space-x-3 relative">
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
                    {deal.originalPrice && deal.originalPrice > deal.currentPrice && (
                      <>
                        <span className="text-muted-foreground line-through text-xs">
                          ${deal.originalPrice.toFixed(2)}
                        </span>
                        <span className="text-[8px] px-1 py-0 h-4 bg-red-500 text-white rounded-full">
                          {deal.discount || Math.round(((deal.originalPrice - deal.currentPrice) / deal.originalPrice) * 100)}% OFF
                        </span>
                        <span className="text-[8px] px-1 py-0 h-4 bg-green-500 text-white rounded-full">
                          Save ${(deal.originalPrice - deal.currentPrice).toFixed(2)}
                        </span>
                      </>
                    )}

                    {/* Show if no savings */}
                    {(!deal.originalPrice || deal.originalPrice <= deal.currentPrice) && (
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
          );
        })}
      </ul>
    </div>
  );
}