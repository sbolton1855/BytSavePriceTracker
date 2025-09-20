
import { useQuery } from "@tanstack/react-query";
import { Badge } from "./ui/badge";
import { Skeleton } from "./ui/skeleton";

interface Deal {
  title: string;
  imageUrl: string;
  price: number;
  msrp?: number;
  url?: string;
  currentPrice?: number;
  originalPrice?: number;
  affiliateUrl?: string;
}

interface CategoryDealsProps {
  title: string;
  category: string;
}

export default function CategoryDeals({ title, category }: CategoryDealsProps) {
  const { data, isLoading, error } = useQuery<{ deals: Deal[] }>({
    queryKey: ["categoryDeals", category],
    queryFn: async () => {
      console.log(`[CategoryDeals] Fetching deals for category: ${category}`);
      const res = await fetch(`/api/products/deals?category=${category}&limit=4`);
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`[CategoryDeals] Fetch failed for ${category}:`, res.status, errorText);
        throw new Error(`Failed to fetch ${category} deals: ${res.status}`);
      }
      const json = await res.json();
      console.log(`[CategoryDeals] Fetch successful for ${category}, received:`, json);
      return json;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false,
  });

  console.log(`[CategoryDeals] ${category} - Raw API response:`, data);
  console.log(`[CategoryDeals] ${category} - Error:`, error);
  console.log(`[CategoryDeals] ${category} - Loading:`, isLoading);

  // Handle response format
  let deals: Deal[] = [];
  
  if (data && data.deals && Array.isArray(data.deals)) {
    deals = data.deals.map((deal) => ({
      ...deal,
      currentPrice: deal.price || deal.currentPrice,
      originalPrice: deal.msrp || deal.originalPrice,
      affiliateUrl: deal.url || deal.affiliateUrl,
    }));
  }

  console.log(`[CategoryDeals] ${category} - Processed deals:`, deals);

  if (error) {
    console.error(`[CategoryDeals] ${category} - Query error:`, error);
  }

  return (
    <div className="mb-6">
      <h4 className="text-md font-semibold mb-3">{title}</h4>
      
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-start space-x-3">
              <Skeleton className="w-14 h-14 rounded" />
              <div className="flex-1">
                <Skeleton className="h-3 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : deals.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          No {category} deals available at this moment.
        </div>
      ) : (
        <ul className="space-y-3">
          {deals.map((deal, index) => {
            console.log(`[CategoryDeals] ${category} - Rendering deal:`, deal);
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
      )}
    </div>
  );
}
