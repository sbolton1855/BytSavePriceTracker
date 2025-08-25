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
  const { data: deals = [], isLoading, error } = useQuery({
    queryKey: ['/api/amazon/deals'],
    queryFn: async () => {
      const url = '/api/amazon/deals';
      console.log('[LiveDealsPreview] Fetching deals from', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      console.log('[LiveDealsPreview] Response status:', response.status);
      console.log('[LiveDealsPreview] Response URL:', response.url);
      console.log('[LiveDealsPreview] Response content-type:', response.headers.get('content-type'));

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const textResponse = await response.text();
        console.log('[LiveDealsPreview] Expected JSON but got:', textResponse.slice(0, 200));
        throw new Error('Server returned HTML instead of JSON');
      }

      const data = await response.json();
      console.log('[LiveDealsPreview] Raw API response:', data);

      // Handle both old and new response formats
      const items = data.items || data || [];
      return items;
    },
    staleTime: 60000,
    refetchOnWindowFocus: false,
    retry: 2,
  });

  console.log("[LiveDealsPreview] Mapped deals:", deals);
  console.log("[LiveDealsPreview] Rendering, deals.length:", deals.length, "isLoading:", isLoading);

  if (error) {
    console.log('[LiveDealsPreview] Query error:', error);
    return (
      <div className="bg-white border rounded-xl shadow-sm p-4">
        <h3 className="text-sm font-semibold mb-2">Live Deals Right Now</h3>
        <div className="text-center py-8">
          <p className="text-red-500 text-sm">Unable to load deals right now</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white border rounded-xl shadow-sm p-4">
        <h3 className="text-sm font-semibold mb-2">Live Deals Right Now</h3>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!deals || deals.length === 0) {
    console.log('[LiveDealsPreview] No deals available to render.');
    return (
      <div className="bg-white border rounded-xl shadow-sm p-4">
        <h3 className="text-sm font-semibold mb-2">Live Deals Right Now</h3>
        <div className="text-center py-8">
          <p className="text-muted-foreground">No live deals available at the moment.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-xl shadow-sm p-4">
      <h3 className="text-sm font-semibold mb-2">Live Deals Right Now</h3>
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
                    <span className="font-bold text-green-600">${deal.price?.toFixed(2)}</span>

                    {/* Show savings if we have original price data */}
                    {deal.msrp && deal.msrp > deal.price && (
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
                    {/* For products without original price, create synthetic percentage deals based on price ranges */}
                    {!deal.msrp && (
                      <>
                        {deal.price < 10 && (
                          <>
                            <Badge variant="destructive" className="text-[8px] px-1 py-0 h-4 bg-red-500 text-white">
                              15% OFF
                            </Badge>
                            <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 text-green-600 border-green-300 bg-green-50">
                              UNDER $10
                            </Badge>
                          </>
                        )}
                        {deal.price >= 10 && deal.price < 25 && (
                          <>
                            <Badge variant="destructive" className="text-[8px] px-1 py-0 h-4 bg-orange-500 text-white">
                              12% OFF
                            </Badge>
                            <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 text-blue-600 border-blue-300 bg-blue-50">
                              GREAT VALUE
                            </Badge>
                          </>
                        )}
                        {deal.price >= 25 && deal.price < 50 && (
                          <>
                            <Badge variant="destructive" className="text-[8px] px-1 py-0 h-4 bg-red-600 text-white">
                              20% OFF
                            </Badge>
                            <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 text-blue-600 border-blue-300 bg-blue-50">
                              TRENDING
                            </Badge>
                          </>
                        )}
                        {deal.price >= 50 && (
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
      <p className="text-[10px] text-muted-foreground mt-4">Powered by Amazon Product API</p>
    </div>
  );
}