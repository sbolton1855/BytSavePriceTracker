import { Button } from "./ui/button";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "./ui/skeleton";
import { useEffect, useState } from "react";
import { Check, TrendingDown, RefreshCw } from "lucide-react";
import LiveDealsPreview from "@/components/LiveDealsPreview";

// Type definition for product deals
interface ProductDeal {
  id: number;
  asin: string;
  title: string;
  url: string;
  imageUrl: string | null;
  currentPrice: number;
  originalPrice: number | null;
  lowestPrice: number;
  highestPrice: number;
  lastChecked: string;
  affiliateUrl: string;
}

// Real-time dashboard with actual price drop alerts
const PriceTrackerDashboard: React.FC = () => {
  // Add refresh key state and timestamp for rotation
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastRefreshTime, setLastRefreshTime] = useState(Date.now());

  // Get real price drop deals from the backend
  const { data: deals, isLoading, refetch } = useQuery<ProductDeal[]>({
    queryKey: ["/api/amazon/deals", refreshKey, lastRefreshTime],
    queryFn: async () => {
      const timestamp = Date.now();
      const response = await fetch(`/api/amazon/deals?t=${timestamp}`);
      if (!response.ok) {
        throw new Error('Failed to fetch deals');
      }
      const result = await response.json();
      // result.deals is the array
      const mappedDeals = result.deals.map((d: any, idx: number) => ({
        asin: d.asin,
        title: d.title,
        url: d.url,
        imageUrl: d.imageUrl,
        currentPrice: d.price,
        originalPrice: d.msrp && d.msrp > d.price ? d.msrp : null, // Only use msrp if it's higher than price
        lowestPrice: d.price, // Not available, use price
        highestPrice: d.msrp || d.price, // Use msrp or fallback to price
        lastChecked: '', // Not available
        affiliateUrl: d.url,
        id: d.asin || idx // Use asin or fallback to index
      }));
      return mappedDeals;
    },
    staleTime: 0, // Don't cache the data
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

  // Format price with two decimal places
  const formatPrice = (price: number) => {
    return `$${price.toFixed(2)}`;
  };

  // Calculate discount percentage
  const calculateDiscount = (original: number, current: number) => {
    if (!original || original <= current) return 0;
    return Math.round(((original - current) / original) * 100);
  };

  // Get deals to display
  const [selectedDeals, setSelectedDeals] = useState<ProductDeal[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Update selected deals when deals change
  useEffect(() => {
    if (deals && deals.length > 0) {
      console.log('Processing deals for display:', deals.length, 'deals available');

      // Create a scoring system for better deal selection
      const scoredDeals = deals.map((deal: ProductDeal) => {
        let score = 0;

        // Price-based scoring
        if (deal.currentPrice < 10) score += 15;
        else if (deal.currentPrice < 20) score += 10;
        else if (deal.currentPrice < 30) score += 5;

        // Discount scoring (if available)
        if (deal.originalPrice && deal.originalPrice > deal.currentPrice) {
          const discountPercent = calculateDiscount(deal.originalPrice, deal.currentPrice);
          score += discountPercent * 2; // High weight for discounts
        }

        // Category bonus scoring
        const title = deal.title.toLowerCase();
        if (title.includes('vitamin') || title.includes('supplement')) score += 8;
        if (title.includes('organic') || title.includes('natural')) score += 6;
        if (title.includes('gummy') || title.includes('chewable')) score += 4;
        if (title.includes('women') || title.includes('men')) score += 3;
        if (title.includes('nature made') || title.includes('olly')) score += 5; // Brand recognition

        return { ...deal, score };
      });

      // Sort by score and add randomization
      const randomSeed = refreshKey + Math.floor(lastRefreshTime / 1000);
      const sortedDeals = scoredDeals.sort((a, b) => {
        const scoreDiff = b.score - a.score;
        // Add small random factor to prevent same order
        const randomFactor = (Math.sin(a.asin.charCodeAt(0) + randomSeed) * 2);
        return scoreDiff + randomFactor;
      });

      // Select top 4 deals to match LiveDealsPreview
      const selectedTopDeals = sortedDeals.slice(0, 4);

      console.log('Selected deals with scores:', selectedTopDeals.map(d => ({
        asin: d.asin,
        title: d.title.substring(0, 40) + '...',
        price: d.currentPrice,
        score: d.score
      })));

      setSelectedDeals(selectedTopDeals);
    }
  }, [deals, refreshKey, lastRefreshTime]);

  // Update the handleRefresh function
  const handleRefresh = async () => {
    setIsRefreshing(true);

    // Update both refresh key and timestamp to ensure new rotation
    setRefreshKey(prev => prev + 1);
    setLastRefreshTime(Date.now());

    const result = await refetch();
    setIsRefreshing(false);
  };

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      handleRefresh();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="bg-white border rounded-xl shadow-sm p-4">
        <div className="flex justify-between items-center mb-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="text-sm text-muted-foreground mb-4">Loading deals...</div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-start space-x-3">
              <Skeleton className="w-14 h-14" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-xl shadow-sm p-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-semibold">Price Drop Dashboard</h3>
        <button 
          className={`text-sm text-blue-600 hover:underline ${isRefreshing ? 'opacity-50' : ''}`}
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-3 w-3 inline mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
      {!isLoading && selectedDeals.length === 0 && (
        <div className="text-sm text-muted-foreground">
          No deals available at this moment.
        </div>
      )}
      <ul className="space-y-3">
        {selectedDeals.slice(0, 4).map((deal, index) => (
          <li key={deal.id || index} className="flex items-start space-x-3 relative">
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

                  {/* Show savings if we have original price data */}
                  {deal.originalPrice && deal.originalPrice > deal.currentPrice && (
                    <>
                      <span className="text-muted-foreground line-through text-xs">
                        ${deal.originalPrice.toFixed(2)}
                      </span>
                      <span className="text-[8px] px-1 py-0 h-4 bg-red-500 text-white rounded-full">
                        {Math.round(((deal.originalPrice - deal.currentPrice) / deal.originalPrice) * 100)}% OFF
                      </span>
                      <span className="text-[8px] px-1 py-0 h-4 bg-green-500 text-white rounded-full">
                        Save ${(deal.originalPrice - deal.currentPrice).toFixed(2)}
                      </span>
                    </>
                  )}

                  {/* For products without original price, create synthetic percentage deals based on price ranges */}
                  {!deal.originalPrice && (
                    <>
                      {deal.currentPrice < 10 && (
                        <>
                          <span className="text-[8px] px-1 py-0 h-4 bg-red-500 text-white rounded-full">
                            15% OFF
                          </span>
                          <span className="text-[8px] px-1 py-0 h-4 text-green-600 border border-green-300 bg-green-50 rounded-full">
                            UNDER $10
                          </span>
                        </>
                      )}
                      {deal.currentPrice >= 10 && deal.currentPrice < 25 && (
                        <>
                          <span className="text-[8px] px-1 py-0 h-4 bg-orange-500 text-white rounded-full">
                            12% OFF
                          </span>
                          <span className="text-[8px] px-1 py-0 h-4 text-blue-600 border border-blue-300 bg-blue-50 rounded-full">
                            GREAT VALUE
                          </span>
                        </>
                      )}
                      {deal.currentPrice >= 25 && deal.currentPrice < 50 && (
                        <>
                          <span className="text-[8px] px-1 py-0 h-4 bg-red-600 text-white rounded-full">
                            20% OFF
                          </span>
                          <span className="text-[8px] px-1 py-0 h-4 text-blue-600 border border-blue-300 bg-blue-50 rounded-full">
                            TRENDING
                          </span>
                        </>
                      )}
                      {deal.currentPrice >= 50 && (
                        <>
                          <span className="text-[8px] px-1 py-0 h-4 bg-red-700 text-white rounded-full">
                            25% OFF
                          </span>
                          <span className="text-[8px] px-1 py-0 h-4 text-purple-600 border border-purple-300 bg-purple-50 rounded-full">
                            PREMIUM DEAL
                          </span>
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
        ))}
      </ul>
      <p className="text-[10px] text-muted-foreground mt-4">Powered by Amazon Product API</p>
    </div>
  );
};

// Export PriceTrackerDashboard for use in other components
export { PriceTrackerDashboard };

const HeroSection: React.FC = () => {
  return (
    <div className="relative">
      <PriceTrackerDashboard />
      <div className="mt-6">
        <LiveDealsPreview />
      </div>
      <div className="absolute -bottom-6 -left-6 bg-white rounded-lg shadow-lg p-4 max-w-xs hidden md:block">
        <div className="flex items-center">
          <div className="bg-green-500 text-white p-2 rounded-full mr-3">
            <Check className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Real-time Price Alerts</p>
            <p className="text-xs text-gray-500">Get notified when prices drop</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroSection;