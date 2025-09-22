
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { ArrowRight, ArrowDownRight, Loader2, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { Product } from "../../../shared/schema";

type HighlightedDeal = Product & {
  discountPercentage: number;
  savings?: number;
  affiliateUrl?: string;
  isNewAddition?: boolean;
};

export default function HighlightedDeals() {
  const [allDeals, setAllDeals] = useState<HighlightedDeal[]>([]);
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

      // Handle both possible response formats
      const deals = jsonData.data?.deals || jsonData.deals || jsonData;
      
      if (!Array.isArray(deals)) {
        console.error("[TrendingNow] Expected deals array, got:", typeof deals);
        return [];
      }

      console.log("[TrendingNow] Raw API response:", deals);
      return deals;
    },
    // 5 minute cache like Live Deals
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

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
      }));

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
    currentDealsCount: currentDeals.length
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Trending Now</h2>
          <div className="h-9 w-32 bg-slate-100 rounded-md animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="overflow-hidden h-full">
              <div className="aspect-video bg-slate-100 flex items-center justify-center relative">
                <Skeleton className="h-[140px] w-[200px]" />
                <div className="absolute top-2 right-2">
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </div>
              <CardHeader className="p-4">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </CardHeader>
              <CardContent className="p-4 pt-0 flex-grow">
                <Skeleton className="h-6 w-24 mb-3" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <div className="mt-3 flex justify-between">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </CardContent>
              <CardFooter className="p-4 pt-0">
                <div className="space-y-2 w-full">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-7 w-full" />
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (isError || !currentDeals.length) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-center">No Deals Available</CardTitle>
          <CardDescription className="text-center">
            We couldn't find any trending deals right now. Please check back later.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold">Trending Now</h2>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {currentDeals.map((deal) => {
          console.log("[TrendingNow] Rendering deal:", deal);
          return (
            <Card key={deal.id || deal.asin} className="overflow-hidden flex flex-col h-full hover:shadow-lg transition-shadow">
              <div className="aspect-video bg-slate-50 flex items-center justify-center relative overflow-hidden">
                {deal.imageUrl ? (
                  <img 
                    src={deal.imageUrl} 
                    alt={deal.title} 
                    className="object-contain w-full h-full p-2"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-slate-400">
                    No image available
                  </div>
                )}
                <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                  {deal.discountPercentage > 0 && (
                    <Badge className="bg-red-600 text-white font-bold shadow-lg">
                      {deal.discountPercentage}% OFF
                    </Badge>
                  )}
                  {deal.originalPrice && deal.currentPrice < deal.originalPrice && (
                    <Badge className="bg-green-600 text-white text-xs shadow-lg">
                      Save ${(deal.originalPrice - deal.currentPrice).toFixed(2)}
                    </Badge>
                  )}
                  {deal.currentPrice < 15 && (
                    <Badge className="bg-blue-600 text-white text-xs">
                      Under $15
                    </Badge>
                  )}
                </div>
              </div>
              <CardHeader className="p-4 pb-0">
                <CardTitle className="text-sm font-medium line-clamp-2">
                  {deal.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-2 flex-grow">
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold text-primary">
                    ${(deal.currentPrice || deal.price || 0).toFixed(2)}
                  </span>
                  {deal.originalPrice && deal.originalPrice > deal.currentPrice && (
                    <span className="text-sm line-through text-muted-foreground">
                      ${deal.originalPrice.toFixed(2)}
                    </span>
                  )}
                </div>

                {deal.discountPercentage > 0 && (
                  <div className="flex flex-col gap-1 mt-1">
                    <div className="flex items-center text-red-600 text-sm">
                      <ArrowDownRight className="h-4 w-4 mr-1" />
                      Price dropped {deal.discountPercentage}%
                    </div>
                    {deal.savings && deal.savings > 0 && (
                      <div className="text-green-600 text-sm font-medium">
                        Save ${deal.savings.toFixed(2)}
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-2 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Lowest: ${(deal.lowestPrice ?? deal.currentPrice ?? deal.price ?? 0).toFixed(2)}</span>
                    <span>Highest: ${(deal.highestPrice ?? deal.currentPrice ?? deal.price ?? 0).toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="p-4 pt-0">
                <div className="space-y-2 w-full">
                  <Button asChild className="w-full">
                    <a href={deal.affiliateUrl || deal.url} target="_blank" rel="noopener noreferrer">
                      View Deal <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                  <Badge variant="outline" className="w-full justify-center py-1 border-dashed text-xs text-muted-foreground hover:bg-primary/5 cursor-pointer hover:border-primary transition-colors">
                    <a href={`/dashboard?track=${deal.asin}`} className="flex items-center w-full justify-center">
                      Track Price
                    </a>
                  </Badge>
                </div>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
