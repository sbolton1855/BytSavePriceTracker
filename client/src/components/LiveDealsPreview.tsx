import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import { Product } from "../../../shared/schema";

export default function LiveDealsPreview() {
  const dealsPerPage = 6;
  const [allDeals, setAllDeals] = useState<Product[]>([]);
  const [currentPage, setCurrentPage] = useState(0);

  const { data, isLoading, isError } = useQuery<any>({
    queryKey: ["/api/amazon/deals", "liveDeals"],
    queryFn: async () => {
      const res = await fetch("/api/amazon/deals?category=liveDeals");
      if (!res.ok) throw new Error("Failed to fetch live deals");
      return res.json();
    },
    staleTime: 1000 * 60 * 60, // ✅ Cache for 1 hour
    refetchOnWindowFocus: false, // ✅ No auto refetch
  });

  // Extract usable products
  const extracted = data?.data?.deals ?? data?.deals ?? (Array.isArray(data) ? data : []);

  useEffect(() => {
    if (Array.isArray(extracted)) {
      // Map the deals to ensure consistent property names
      const mappedDeals = extracted.map(deal => ({
        ...deal,
        currentPrice: deal.currentPrice ?? deal.price ?? 0,
        originalPrice: deal.originalPrice ?? null,
        affiliateUrl: deal.affiliateUrl ?? deal.url
      }));
      setAllDeals(mappedDeals);
      setCurrentPage(0);
    }
  }, [extracted]);

  const totalPages = Math.ceil(allDeals.length / dealsPerPage);
  const startIndex = currentPage * dealsPerPage;
  const currentDeals = allDeals.slice(startIndex, startIndex + dealsPerPage);

  const hasPrev = currentPage > 0;
  const hasNext = currentPage < totalPages - 1;

  return (
    <div className="space-y-4">
      {/* Header + Pagination Arrows */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">Live Deals Right Now</h3>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => p - 1)}
              disabled={!hasPrev}
              className="h-7 w-7 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">
              {currentPage + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={!hasNext}
              className="h-7 w-7 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Deal count */}
      {!isLoading && (
        <div className="text-xs text-muted-foreground mb-2">
          Showing {currentDeals.length} of {allDeals.length} cached deals
        </div>
      )}

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {currentDeals.map((deal) => (
          <Card key={deal.id}>
            <CardHeader>
              <CardTitle className="text-sm line-clamp-2">{deal.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-primary font-bold text-lg">
                ${(deal.currentPrice || 0).toFixed(2)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Error or empty */}
      {isError && <div className="text-red-500 text-sm">Failed to load deals.</div>}
      {!isError && !isLoading && allDeals.length === 0 && (
        <div className="text-sm text-muted-foreground">No live deals found.</div>
      )}
    </div>
  );
}