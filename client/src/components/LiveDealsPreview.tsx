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
    queryKey: ["databaseDealsPreview"],
    queryFn: async () => {
      console.log("[LiveDealsPreview] Fetching deals from /api/products/deals?limit=4");
      const res = await fetch("/api/products/deals?limit=4");
      if (!res.ok) {
        const errorText = await res.text();
        console.error("[LiveDealsPreview] Fetch failed:", res.status, errorText);
        throw new Error(`Failed to fetch deals: ${res.status}`);
      }
      const json = await res.json();
      console.log("[LiveDealsPreview] Fetch successful, received:", json);
      console.log("[Live Deals] Loaded deals:", json.deals);
      return json;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false,
  });

  console.log("[LiveDealsPreview] Raw API response:", data);
  console.log("[LiveDealsPreview] Error:", error);
  console.log("[LiveDealsPreview] Loading:", isLoading);

  // Handle response format - API consistently returns { deals: [...] }
  let deals: Deal[] = [];
  
  if (data && data.deals && Array.isArray(data.deals)) {
    deals = data.deals.map((deal) => ({
      ...deal,
      currentPrice: deal.price || deal.currentPrice,
      originalPrice: deal.msrp || deal.originalPrice,
      affiliateUrl: deal.url || deal.affiliateUrl,
    }));
  } else if (data && Array.isArray(data)) {
    // Fallback for direct array (shouldn't happen with new format)
    console.warn("[LiveDealsPreview] Received direct array, expected { deals: [...] }");
    deals = data.map((deal) => ({
      ...deal,
      currentPrice: deal.price || deal.currentPrice,
      originalPrice: deal.msrp || deal.originalPrice,
      affiliateUrl: deal.url || deal.affiliateUrl,
    }));
  } else {
    console.warn("[LiveDealsPreview] Unexpected data format:", data);
  }

  console.log("[LiveDealsPreview] Processed deals:", deals);
  console.log("[LiveDealsPreview] Final render - deals.length:", deals.length, "isLoading:", isLoading);

  if (error) {
    console.error("[LiveDealsPreview] Query error:", error);
  }

  return (
    <div className="bg-white border rounded-xl shadow-sm p-4">
      <h3 className="text-sm font-semibold mb-2">Live Deals Right Now</h3>
      {isLoading && <div className="text-sm text-muted-foreground">Loading deals...</div>}
      {!isLoading && deals.length === 0 && (
        <div className="text-sm text-muted-foreground">
          No deals available at this moment.
        </div>
      )}
      <ul className="space-y-3">
        {deals.slice(0, 4).map((deal, index) => {
          console.log("[LiveDealsPreview] Rendering deal:", deal);
          return (
            <li key={index} className="flex items-start space-x-3 relative">
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

                    {/* Show savings if we have original price data */}
                    {deal.price && deal.msrp && deal.msrp > deal.price && (
                      <>
                        <span className="text-muted-foreground line-through text-xs">
                          ${deal.msrp.toFixed(2)}
                        </span>
                        <Badge variant="destructive" className="text-[8px] px-1 py-0 h-4 bg-red-500 text-white">
                          {Math.round(((deal.msrp - deal.price) / deal.msrp) * 100)}% OFF
                        </Badge>
                        <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 bg-green-500 text-white border-green-500">
                          Save ${(deal.msrp - deal.price).toFixed(2)}
                        </Badge>
                      </>
                    )}
                    {!deal.msrp && deal.originalPrice && deal.originalPrice > deal.currentPrice && (
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

                    {/* For products without original price, create synthetic percentage deals based on price ranges */}
                    {!deal.msrp && !deal.originalPrice && (
                      <>
                        {deal.currentPrice < 10 && (
                          <>
                            <Badge variant="destructive" className="text-[8px] px-1 py-0 h-4 bg-red-500 text-white">
                              15% OFF
                            </Badge>
                            <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 text-green-600 border-green-300 bg-green-50">
                              UNDER $10
                            </Badge>
                          </>
                        )}
                        {deal.currentPrice >= 10 && deal.currentPrice < 25 && (
                          <>
                            <Badge variant="destructive" className="text-[8px] px-1 py-0 h-4 bg-orange-500 text-white">
                              12% OFF
                            </Badge>
                            <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 text-blue-600 border-blue-300 bg-blue-50">
                              GREAT VALUE
                            </Badge>
                          </>
                        )}
                        {deal.currentPrice >= 25 && deal.currentPrice < 50 && (
                          <>
                            <Badge variant="destructive" className="text-[8px] px-1 py-0 h-4 bg-red-600 text-white">
                              20% OFF
                            </Badge>
                            <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 text-blue-600 border-blue-300 bg-blue-50">
                              TRENDING
                            </Badge>
                          </>
                        )}
                        {deal.currentPrice >= 50 && (
                          <>
                            <Badge variant="destructive" className="text-[8px] px-1 py-0 h-4 bg-red-700 text-white">
                              25% OFF
                            </Badge>
                            <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 text-purple-600 border-purple-300 bg-purple-50">
                              PREMIUM DEAL
                            </Badge>
                          </>
                        )}
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
      <p className="text-[10px] text-muted-foreground mt-4">Updated daily from Amazon</p>
    </div>
  );
}