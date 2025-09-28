
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import SharedProductCard from "./SharedProductCard";

interface UnifiedDeal {
  id: string;
  title: string;
  currentPrice: number;
  originalPrice: number | null;
  discountPercentage: number;
  imageUrl: string;
  affiliateUrl: string;
  asin: string;
}

interface UnifiedDealsProps {
  type: 'live' | 'trending';
  title: string;
}

export default function UnifiedDeals({ type, title }: UnifiedDealsProps) {
  const [allDeals, setAllDeals] = useState<UnifiedDeal[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const dealsPerPage = 4;

  // Fetch deals with consistent caching
  const { data, isLoading, error, refetch } = useQuery<any>({
    queryKey: [`/api/deals`, type],
    queryFn: async () => {
      console.log(`[UnifiedDeals] Fetching ${type} deals from API...`);
      const res = await fetch(`/api/deals?type=${type}&limit=12`);

      if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) {
        const text = await res.text();
        console.error(`[UnifiedDeals] Invalid JSON response:`, text);
        throw new Error('Invalid response from server');
      }

      const jsonData = await res.json();
      console.log(`[UnifiedDeals] API Success - received ${jsonData.deals?.length || 0} deals`);

      return jsonData.deals || [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Process deals
  useEffect(() => {
    if (data && Array.isArray(data)) {
      console.log(`[UnifiedDeals] Processing ${data.length} deals for ${type}`);
      setAllDeals(data);

      if (data.length !== allDeals.length) {
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
    console.log(`[UnifiedDeals] Manual refresh triggered for ${type}`);
    refetch();
  };

  console.log(`[UnifiedDeals] Pagination info for ${type}:`, {
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
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <div className="h-9 w-32 bg-slate-100 rounded-md animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="w-full">
              <Card className="overflow-hidden h-[360px] max-w-[240px] mx-auto">
                <div className="h-40 bg-slate-100 flex items-center justify-center relative">
                  <Skeleton className="h-24 w-24" />
                  <div className="absolute top-1 right-1">
                    <Skeleton className="h-3 w-10 rounded-full" />
                  </div>
                </div>
                <div className="p-2">
                  <Skeleton className="h-3 w-full mb-1" />
                  <Skeleton className="h-3 w-3/4 mb-2" />
                </div>
                <div className="p-2 pt-0 flex-grow">
                  <Skeleton className="h-4 w-16 mb-1" />
                  <div className="space-y-1">
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <div className="mt-1 flex justify-between">
                    <Skeleton className="h-2 w-12" />
                    <Skeleton className="h-2 w-12" />
                  </div>
                </div>
                <div className="p-2 pt-0">
                  <div className="space-y-1 w-full">
                    <Skeleton className="h-7 w-full" />
                    <Skeleton className="h-5 w-full" />
                  </div>
                </div>
              </Card>
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
            <CardTitle className="text-center">No Deals Available</CardTitle>
            <CardDescription className="text-center">
              We couldn't find any {type} deals right now. Please check back later.
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
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
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
        <div className="flex items-center gap-2">
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

      {currentDeals.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {currentDeals.map((deal, index) => {
            const dealKey = deal.asin || `deal-${index}-${deal.title?.substring(0, 20)}`;
            
            // Log image details for debugging (first two deals only)
            if (index < 2) {
              console.log(`[UnifiedDeals] Deal ${index + 1} image:`, {
                asin: deal.asin,
                imageUrl: deal.imageUrl,
                title: deal.title?.substring(0, 30) + '...'
              });
            }
            
            return (
              <div key={dealKey} className="w-full">
                <SharedProductCard
                  title={deal.title}
                  imageUrl={deal.imageUrl}
                  currentPrice={deal.currentPrice}
                  originalPrice={deal.originalPrice}
                  discount={deal.discountPercentage}
                  url={deal.affiliateUrl}
                  asin={deal.asin}
                  isHot={!deal.originalPrice}
                  premium={deal.discountPercentage >= 30}
                  lowestPrice={deal.currentPrice}
                  highestPrice={deal.originalPrice || deal.currentPrice}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
