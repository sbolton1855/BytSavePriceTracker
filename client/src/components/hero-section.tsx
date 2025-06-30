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
     // console.log(`Fetching Amazon deals with refreshKey: ${refreshKey}`);
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
    //  console.log('Received Amazon deals:', mappedDeals);
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

  // Get three random deals to display in the notification alerts
  const [selectedDeals, setSelectedDeals] = useState<ProductDeal[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Update time display
  const [lastUpdated, setLastUpdated] = useState<string>("Just now");

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
        
        // Variety bonus (prefer different price ranges)
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

      // Select top deals with variety
      const selectedTopDeals = [];
      const usedPriceRanges = new Set();
      
      for (const deal of sortedDeals) {
        if (selectedTopDeals.length >= 3) break;
        
        // Determine price range for variety
        let priceRange = 'high';
        if (deal.currentPrice < 10) priceRange = 'low';
        else if (deal.currentPrice < 20) priceRange = 'medium';
        
        // Try to avoid duplicating price ranges for first 2 selections
        if (selectedTopDeals.length < 2 && usedPriceRanges.has(priceRange)) {
          continue;
        }
        
        selectedTopDeals.push(deal);
        usedPriceRanges.add(priceRange);
      }
      
      // Fill remaining slots if needed
      if (selectedTopDeals.length < 3) {
        for (const deal of sortedDeals) {
          if (selectedTopDeals.length >= 3) break;
          if (!selectedTopDeals.find(d => d.asin === deal.asin)) {
            selectedTopDeals.push(deal);
          }
        }
      }

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
  //  console.log('Refresh clicked, current refreshKey:', refreshKey);
    setIsRefreshing(true);

    // Update both refresh key and timestamp to ensure new rotation
    setRefreshKey(prev => prev + 1);
    setLastRefreshTime(Date.now());

    const result = await refetch();
  //  console.log('Refetch completed, new data:', result.data?.length, 'deals');
    setLastUpdated("Just now");
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
      <div className="rounded-lg shadow-xl w-full overflow-hidden bg-white">
        <div className="p-4 border border-gray-200 rounded-lg">
          <div className="border-b pb-3 mb-4 flex justify-between">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-6 w-8" />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>

          <Skeleton className="h-5 w-32 mb-2" />
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg shadow-xl w-full h-auto overflow-hidden">
      <div className="bg-white p-4 border border-gray-200 rounded-lg">
        <div className="border-b pb-3 mb-4 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-800">Price Drop Dashboard</h3>
          <button 
            className={`text-primary-600 hover:text-primary-800 transition-all flex items-center text-sm ${isRefreshing ? 'opacity-50' : ''}`}
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="sr-only">Refresh</span>
          </button>
        </div>
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-700">🔥 Hot Deals Right Now</h4>
            <span className="text-xs text-amber-600 bg-amber-100 px-2 py-1 rounded-full">
              Live Prices
            </span>
          </div>
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {selectedDeals.length > 0 ? (
              selectedDeals.map((deal, index) => (
                <a 
                  key={deal.id || `deal-${index}`}
                  href={deal.affiliateUrl || deal.url} 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center p-3 bg-gradient-to-r from-white to-amber-50 rounded-lg border border-amber-200 hover:border-amber-400 hover:shadow-lg transition-all duration-200 cursor-pointer group hover:bg-gradient-to-r hover:from-amber-50 hover:to-amber-100"
                >
                  <div className="flex-shrink-0 w-16 h-16 mr-4 bg-white rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden shadow-sm">
                    {deal.imageUrl ? (
                      <img
                        src={deal.imageUrl}
                        alt={deal.title}
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                        <span className="text-xs text-gray-400">No image</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900 line-clamp-2 group-hover:text-amber-800 transition-colors leading-tight">{deal.title}</h4>
                    <div className="flex items-center space-x-2 mt-2">
                      <span className="text-lg font-bold text-green-600">{formatPrice(deal.currentPrice)}</span>
                      {deal.originalPrice && deal.originalPrice > deal.currentPrice && (
                        <>
                          <span className="text-sm line-through text-gray-500">{formatPrice(deal.originalPrice)}</span>
                          <div className="flex items-center space-x-1">
                            <span className="text-xs bg-red-500 text-white px-2 py-1 rounded-full font-bold shadow-sm">
                              {calculateDiscount(deal.originalPrice, deal.currentPrice)}% OFF
                            </span>
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                              Save {formatPrice(deal.originalPrice - deal.currentPrice)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="flex items-center mt-1 space-x-2 flex-wrap">
                      <span className="text-xs text-gray-500">ASIN: {deal.asin}</span>
                      {deal.currentPrice < 15 && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                          Under $15
                        </span>
                      )}
                      {deal.currentPrice < 25 && deal.currentPrice >= 15 && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">
                          Under $25
                        </span>
                      )}
                      {deal.title.toLowerCase().includes('vitamin') && (
                        <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium">
                          Health & Wellness
                        </span>
                      )}
                      {deal.title.toLowerCase().includes('organic') && (
                        <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">
                          Organic
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0 ml-2">
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      width="16" 
                      height="16" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      className="text-gray-400 group-hover:text-amber-600 transition-colors"
                    >
                      <path d="M7 7h10v10" />
                      <path d="M7 17 17 7" />
                    </svg>
                  </div>
                </a>
              ))
            ) : (
              <div className="p-3 bg-gray-50 rounded-md text-sm text-gray-500 text-center">
                No price alerts found
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between bg-gray-50 p-2 rounded-md text-xs text-gray-500">
          <span>Last updated: {lastUpdated}</span>
          <span>Data from Amazon Product API</span>
        </div>
      </div>
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