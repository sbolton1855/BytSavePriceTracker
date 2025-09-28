
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "./ui/skeleton";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

// Type definition for product deals
interface ProductDeal {
  id: number;
  asin: string;
  title: string;
  url: string;
  imageUrl: string | null;
  currentPrice: number;
  originalPrice: number | null;
  savingsAmount?: number;
  savingsPercentage?: number;
  lowestPrice: number;
  highestPrice: number;
  lastChecked: string;
  affiliateUrl: string;
  reviewCount?: number;
}

// Live deals dashboard with same UI as PriceTrackerDashboard
const LiveDealsTracker: React.FC = () => {
  // Add refresh key state and timestamp for rotation
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastRefreshTime, setLastRefreshTime] = useState(Date.now());

  // Get real live deals from the backend (using "live" instead of "trendingNow")
  const { data: deals, isLoading, refetch } = useQuery<ProductDeal[]>({
    queryKey: ["/api/amazon/deals", "live", refreshKey, lastRefreshTime],
    queryFn: async () => {
      const timestamp = Date.now();
      // Fetch deals for the "live" category
      const response = await fetch(`/api/amazon/deals?category=live&t=${timestamp}`);
      if (!response.ok) {
        throw new Error('Failed to fetch live deals');
      }
      const result = await response.json();
      console.log('[LiveDealsTracker] Raw Amazon API response:', result);

      // Extract deals from the response (handle cached data structure)
      const rawDeals = result.deals || result.data?.deals || [];
      console.log('[LiveDealsTracker] Extracted deals:', rawDeals.length);

      // Extract real Amazon savings data from the API response structure
      const mappedDeals = rawDeals.map((d: any, idx: number) => {
        // Amazon savings data is nested in the full API response structure
        let hasSavings = false;
        let savingsAmount = 0;
        let savingsPercentage = 0;

        // Check if we have full Amazon API response with Offers structure
        if (d.Offers && d.Offers.Listings && d.Offers.Listings[0] && d.Offers.Listings[0].Price && d.Offers.Listings[0].Price.Savings) {
          const savings = d.Offers.Listings[0].Price.Savings;
          hasSavings = savings.Amount > 0;
          savingsAmount = savings.Amount;
          savingsPercentage = savings.Percentage;
        }
        // Check if savings data is directly on the deal object (from backend)
        else if (d.savings && d.savings.Amount > 0) {
          hasSavings = true;
          savingsAmount = d.savings.Amount;
          savingsPercentage = d.savings.Percentage;
        }

        // Calculate original price from savings if available
        let originalPrice = null;
        if (hasSavings && savingsAmount > 0) {
          originalPrice = d.price + savingsAmount;
        } else if (d.msrp && d.msrp > d.price) {
          originalPrice = d.msrp;
        }

        console.log('[LiveDealsTracker] Deal:', {
          asin: d.asin,
          title: d.title.substring(0, 40) + '...',
          price: d.price,
          originalPrice,
          hasSavings,
          savingsAmount,
          savingsPercentage,
          hasOffers: !!d.Offers
        });

        return {
          asin: d.asin,
          title: d.title,
          url: d.url,
          imageUrl: d.imageUrl,
          currentPrice: d.price,
          originalPrice,
          savingsAmount,
          savingsPercentage,
          lowestPrice: d.price,
          highestPrice: originalPrice || d.price,
          lastChecked: '',
          affiliateUrl: d.url,
          id: d.asin || idx,
          reviewCount: d.reviewCount
        };
      });
      return mappedDeals;
    },
    staleTime: 0, // Don't cache the data
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

  // Get deals to display
  const [selectedDeals, setSelectedDeals] = useState<ProductDeal[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Update selected deals when deals change
  useEffect(() => {
    if (deals && deals.length > 0) {
      console.log('Processing live deals for display:', deals.length, 'deals available');

      const allDeals = deals;

      // Filter to only include deals with actual savings and valid pricing
      const dealsWithSavings = allDeals.filter(deal =>
        deal.originalPrice &&
        deal.currentPrice &&
        deal.originalPrice > deal.currentPrice &&
        deal.currentPrice > 0
      );

      console.log(`[LiveDealsTracker] Filtered to ${dealsWithSavings.length} deals with actual savings`);

      // Create a scoring system for better deal selection (same as PriceTracker)
      const scoredDeals = dealsWithSavings.map((deal: ProductDeal) => {
        let score = 0;

        // Price-based scoring
        if (deal.currentPrice < 10) score += 15;
        else if (deal.currentPrice < 20) score += 10;
        else if (deal.currentPrice < 30) score += 5;

        // Discount scoring
        if (deal.savingsAmount && deal.savingsAmount > 0) {
          score += deal.savingsPercentage * 2;
        } else if (deal.originalPrice && deal.originalPrice > deal.currentPrice) {
          const discountPercent = Math.round(((deal.originalPrice - deal.currentPrice) / deal.originalPrice) * 100);
          score += discountPercent * 2;
        }

        // Review count bonus scoring
        if (deal.reviewCount && deal.reviewCount > 5000) score += 7;

        return { ...deal, score };
      });

      // Sort by score and add randomization
      const randomSeed = refreshKey + Math.floor(lastRefreshTime / 1000);
      const sortedDeals = scoredDeals.sort((a, b) => {
        const scoreDiff = b.score - a.score;
        const randomFactor = (Math.sin(a.asin.charCodeAt(0) + randomSeed) * 2);
        return scoreDiff + randomFactor;
      });

      // Select top 4 deals
      const selectedTopDeals = sortedDeals.slice(0, 4);

      console.log('Selected live deals with scores:', selectedTopDeals.map(d => ({
        asin: d.asin,
        title: d.title.substring(0, 40) + '...',
        price: d.currentPrice,
        score: d.score
      })));

      setSelectedDeals(selectedTopDeals);
    }
  }, [deals, refreshKey, lastRefreshTime]);

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
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
        <div className="text-sm text-muted-foreground mb-4">Loading live deals...</div>
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
        <h3 className="text-sm font-semibold">🔥 Live Deals Right Now</h3>
        <button 
          className={`text-primary-600 hover:text-primary-800 transition-all flex items-center text-sm ${isRefreshing ? 'opacity-50' : ''}`}
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {!isLoading && selectedDeals.length === 0 && (
        <div className="text-sm text-muted-foreground">
          No active live deals with savings found. Check back soon for new price drops!
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

                  {/* Show real Amazon savings data */}
                  {deal.savingsAmount && deal.savingsAmount > 0 && deal.savingsPercentage && (
                    <>
                      <span className="text-muted-foreground line-through text-xs">
                        ${deal.originalPrice!.toFixed(2)}
                      </span>
                      <span className="text-[8px] px-1 py-0 h-4 bg-red-500 text-white rounded-full">
                        {deal.savingsPercentage}% OFF
                      </span>
                      <span className="text-[8px] px-1 py-0 h-4 bg-green-500 text-white rounded-full">
                        Save ${deal.savingsAmount.toFixed(2)}
                      </span>
                    </>
                  )}

                  {/* Fallback for products with original price but no Amazon savings data */}
                  {!deal.savingsAmount && deal.originalPrice && deal.originalPrice > deal.currentPrice && (
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

export default LiveDealsTracker;
