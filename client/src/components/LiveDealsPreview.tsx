import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "./ui/badge";

// Type for a deal
type Deal = {
  title: string;
  imageUrl: string;
  price: number;
  msrp?: number;
  url?: string;
};

export default function LiveDealsPreview() {
  const { data, isLoading, error } = useQuery<{ deals: Deal[] }>({
    queryKey: ["amazonDealsPreview"],
    queryFn: async () => {
      console.log("[LiveDealsPreview] Fetching deals from API...");
      const res = await fetch("/api/amazon/deals?category=liveDeals");
      if (!res.ok) {
        const errorText = await res.text();
        console.error("[LiveDealsPreview] API Error:", res.status, errorText);
        throw new Error(`Failed to fetch deals: ${res.status}`);
      }
      const data = await res.json();
      console.log("[LiveDealsPreview] API Success - received data structure:", Object.keys(data));
      return data;
    },
    staleTime: 60000,
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: 1000,
  });

  console.log("[LiveDealsPreview] Raw API response:", data);

  // Map backend fields to UI fields with better error handling
  const deals = Array.isArray(data?.deals) 
    ? data.deals.map((deal) => ({
        ...deal,
        currentPrice: deal.price || 0,
        originalPrice: deal.msrp || null,
        affiliateUrl: deal.url || deal.affiliateUrl,
        // Ensure we have required fields
        title: deal.title || 'Product Title Unavailable',
        imageUrl: deal.imageUrl || null,
        asin: deal.asin || `temp-${Date.now()}`
      }))
    : [];

  console.log("[LiveDealsPreview] Processed deals count:", deals.length);
  console.log("[LiveDealsPreview] First deal sample:", deals[0]);
  console.log("[LiveDealsPreview] Rendering, deals.length:", deals.length, "isLoading:", isLoading);

  if (!isLoading && deals.length === 0) {
    console.log("[LiveDealsPreview] No deals available to render.");
  }

  return (
    <div className="bg-white border rounded-xl shadow-sm p-4">
      <h3 className="text-sm font-semibold mb-2">Live Deals Right Now</h3>
      {isLoading && (
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
          Loading deals...
        </div>
      )}
      {error && !isLoading && (
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
          Unable to load deals right now. Please try refreshing the page.
        </div>
      )}
      {!error && !isLoading && deals.length === 0 && (
        <div className="text-sm text-muted-foreground">
          No deals available at this moment. Please try again later.
        </div>
      )}
      {!isLoading && deals.length > 0 && (
        <div className="text-xs text-muted-foreground mb-3">
          Showing {Math.min(4, deals.length)} of {deals.length} live deals
        </div>
      )}
      <ul className="space-y-3">
        {deals.slice(0, 4).map((deal, index) => {
          console.log("[LiveDealsPreview] Rendering deal:", deal);
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-green-600">${deal.currentPrice?.toFixed(2)}</span>

                    {/* Show savings if we have original price data or Amazon savings data */}
                    {deal.savings && deal.savings.Amount && deal.savings.Percentage && (
                      <>
                        <Badge variant="destructive" className="text-[8px] px-1 py-0 h-4 bg-red-500 text-white">
                          {deal.savings.Percentage}% OFF
                        </Badge>
                        <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 bg-green-500 text-white border-green-500">
                          Save ${Number(deal.savings.Amount).toFixed(2)}
                        </Badge>
                      </>
                    )}
                    {!deal.savings && deal.msrp && deal.msrp > deal.price && (
                      <>
                        <span className="text-muted-foreground line-through text-xs">
                          ${deal.msrp.toFixed(2)}
                        </span>
                        <Badge variant="destructive" className="text-[8px] px-1 py-0 h-4 bg-red-500 text-white">
                          {Math.round(((deal.msrp - deal.price) / deal.msrp) * 100)}% OFF
                        </Badge>
                        <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 bg-green-500 text-white border-green-500">
                          Save ${(deal.msrp - deal.currentPrice).toFixed(2)}
                        </Badge>
                      </>
                    )}
                    {!deal.savings && !deal.msrp && deal.originalPrice && deal.originalPrice > deal.currentPrice && (
                      <>
                        <span className="text-muted-foreground line-through text-xs">
                          ${deal.originalPrice.toFixed(2)}
                        </span>
                        <Badge variant="destructive" className="text-[8px] px-1 py-0 h-4 bg-red-500 text-white">
                          {Math.round(((deal.originalPrice - deal.currentPrice) / deal.originalPrice) * 100)}% OFF
                        </Badge>
                        <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 bg-green-500 text-white border-green-500">
                          Save ${(deal.originalPrice - deal.currentPrice).toFixed(2)}
                        </Badge>
                      </>
                    )}

                    {/* For products without explicit savings, show price-based badges */}
                    {!deal.savings && !deal.msrp && !deal.originalPrice && (
                      <>
                        {deal.currentPrice < 10 && (
                          <>
                            <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 text-green-600 border-green-300 bg-green-50">
                              UNDER $10
                            </Badge>
                          </>
                        )}
                        {deal.currentPrice >= 10 && deal.currentPrice < 25 && (
                          <>
                            <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 text-blue-600 border-blue-300 bg-blue-50">
                              GREAT VALUE
                            </Badge>
                          </>
                        )}
                        {deal.currentPrice >= 25 && deal.currentPrice < 50 && (
                          <>
                            <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 text-blue-600 border-blue-300 bg-blue-50">
                              TRENDING
                            </Badge>
                          </>
                        )}
                        {deal.currentPrice >= 50 && (
                          <>
                            <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 text-purple-600 border-purple-300 bg-purple-50">
                              PREMIUM DEAL
                            </Badge>
                          </>
                        )}
                        {/* Show HOT DEAL badge for all products as fallback */}
                        <Badge variant="destructive" className="text-[8px] px-1 py-0 h-4 bg-red-500 text-white">
                          HOT DEAL
                        </Badge>
                      </>
                    )}
                  </div>
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
      </ul>
      <p className="text-[10px] text-muted-foreground mt-4">Powered by Amazon Product API</p>
    </div>
  );
}