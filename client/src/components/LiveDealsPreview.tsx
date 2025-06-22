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
  const { data, isLoading } = useQuery<{ deals: Deal[] }>({
    queryKey: ["amazonDealsPreview"],
    queryFn: async () => {
      const res = await fetch("/api/amazon/deals");
      if (!res.ok) throw new Error("Failed to fetch deals");
      return res.json();
    },
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  console.log("[LiveDealsPreview] Raw API response:", data);

  // Map backend fields to UI fields
  const deals =
    data?.deals?.map((deal) => ({
      ...deal,
      currentPrice: deal.price,
      originalPrice: deal.msrp,
      affiliateUrl: deal.url,
    })) || [];

  deals.forEach((deal, idx) => {
    console.log(`[LiveDealsPreview] Deal ${idx}:`, deal);
  });

  console.log("[LiveDealsPreview] Mapped deals:", deals);
  console.log("[LiveDealsPreview] Rendering, deals.length:", deals.length, "isLoading:", isLoading);

  if (!isLoading && deals.length === 0) {
    console.log("[LiveDealsPreview] No deals available to render.");
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
                {/* Deal badge */}
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 text-[8px] px-1 py-0 h-4 bg-red-500 text-white"
                >
                  DEAL
                </Badge>
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
                        <Badge variant="success" className="text-[8px] px-1 py-0 h-4 bg-green-500 text-white">
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
                        <Badge variant="success" className="text-[8px] px-1 py-0 h-4 bg-green-500 text-white">
                          Save ${(deal.originalPrice - deal.currentPrice).toFixed(2)}
                        </Badge>
                      </>
                    )}
                    
                    {/* For products without original price, create synthetic deal indicators */}
                    {!deal.msrp && !deal.originalPrice && (
                      <>
                        <Badge variant="destructive" className="text-[8px] px-1 py-0 h-4 bg-orange-500 text-white animate-pulse">
                          LIMITED TIME
                        </Badge>
                        <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 text-blue-600 border-blue-300 bg-blue-50">
                          TRENDING
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