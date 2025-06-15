import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../ui/card";

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
            <li key={index} className="flex items-start space-x-3">
              {deal.imageUrl ? (
                <img
                  src={deal.imageUrl}
                  alt={deal.title}
                  className="w-14 h-14 object-contain border rounded"
                />
              ) : (
                <div className="w-14 h-14 flex items-center justify-center bg-gray-100 border rounded text-xs text-gray-400">No image</div>
              )}
              <div className="flex-1">
                <p className="text-xs font-medium leading-tight line-clamp-2">{deal.title}</p>
                <div className="text-xs mt-1">
                  <span className="font-bold">${deal.currentPrice?.toFixed(2)}</span>
                  {deal.originalPrice && (
                    <>
                      <span className="text-muted-foreground line-through ml-1 text-xs">
                        ${deal.originalPrice.toFixed(2)}
                      </span>
                      <span className="ml-2 text-green-600 text-xs font-medium">
                        Save ${Math.round(deal.originalPrice - deal.currentPrice)}
                      </span>
                    </>
                  )}
                </div>
                {deal.affiliateUrl && (
                  <a
                    href={deal.affiliateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                  >
                    View
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