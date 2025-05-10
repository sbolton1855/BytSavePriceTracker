import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";
import { Check, TrendingDown, RefreshCw } from "lucide-react";

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
  // Get real price drop deals from the backend
  const { data: deals, isLoading, refetch } = useQuery<ProductDeal[]>({
    queryKey: ["/api/products/deals"],
    staleTime: 5 * 60 * 1000, // 5 minutes
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
  
  useEffect(() => {
    if (deals && deals.length > 0) {
      // Get deals with original prices that show a price drop
      const dealsWithPrices = deals.filter((deal: ProductDeal) => 
        deal.originalPrice && deal.originalPrice > deal.currentPrice
      );
      
      if (dealsWithPrices.length === 0) {
        // If no price drops, just take first few deals
        setSelectedDeals(deals.slice(0, Math.min(3, deals.length)));
      } else {
        // Sort by highest discount percentage and take top 3
        const sorted = [...dealsWithPrices].sort((a, b) => {
          const aOriginal = a.originalPrice || a.currentPrice;
          const bOriginal = b.originalPrice || b.currentPrice;
          const discountA = ((aOriginal - a.currentPrice) / aOriginal);
          const discountB = ((bOriginal - b.currentPrice) / bOriginal);
          return discountB - discountA;
        });
        setSelectedDeals(sorted.slice(0, Math.min(3, sorted.length)));
      }
    }
  }, [deals]);

  // Handle manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setLastUpdated("Just now");
    setIsRefreshing(false);
  };

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
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-blue-50 p-3 rounded-lg">
            <h4 className="text-sm font-medium text-blue-800 mb-1">Products Tracked</h4>
            <p className="text-2xl font-bold text-blue-600">{deals?.length || 0}</p>
          </div>
          <div className="bg-green-50 p-3 rounded-lg">
            <h4 className="text-sm font-medium text-green-800 mb-1">Price Drops</h4>
            <p className="text-2xl font-bold text-green-600">
              {deals?.filter((d: ProductDeal) => d.originalPrice && d.originalPrice > d.currentPrice).length || 0}
            </p>
          </div>
        </div>
        
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Latest Price Alerts</h4>
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {selectedDeals.length > 0 ? (
              selectedDeals.map((deal, index) => (
                <a 
                  href={deal.affiliateUrl || deal.url} 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center p-2 bg-gray-50 rounded-md border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <div className="w-12 h-12 min-w-[48px] bg-gray-100 rounded-md overflow-hidden mr-3 flex items-center justify-center">
                    {deal.imageUrl ? (
                      <img 
                        src={deal.imageUrl} 
                        alt={deal.title} 
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                        <span className="text-xs text-gray-500">No img</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{deal.title}</p>
                    <div className="flex items-center flex-wrap gap-1">
                      <span className="text-xs font-bold text-green-600">
                        {formatPrice(deal.currentPrice)}
                      </span>
                      {deal.originalPrice && deal.originalPrice > deal.currentPrice && (
                        <>
                          <span className="text-xs text-gray-500 line-through">
                            {formatPrice(deal.originalPrice)}
                          </span>
                          <span className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded-full flex items-center">
                            <TrendingDown className="h-3 w-3 mr-0.5" />
                            {calculateDiscount(deal.originalPrice, deal.currentPrice)}%
                          </span>
                        </>
                      )}
                    </div>
                    <div className="mt-1">
                      <span className="text-xs text-blue-600">View on Amazon →</span>
                    </div>
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

const HeroSection: React.FC = () => {
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative py-12 sm:py-16 lg:py-20 grid lg:grid-cols-2 gap-8 items-center">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl md:text-6xl">
              <span className="block">Track Amazon prices.</span>
              <span className="block text-primary-500">Save money automatically.</span>
            </h1>
            <p className="mt-3 text-base text-gray-500 sm:mt-5 sm:text-lg md:mt-5 md:text-xl">
              BytSave monitors Amazon product prices for you. Set your target price and get notified when it's time to buy.
            </p>
            <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row gap-3">
              <Button 
                size="lg" 
                className="w-full sm:w-auto"
                onClick={() => scrollToSection('tracker')}
              >
                Track a product
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="w-full sm:w-auto"
                onClick={() => scrollToSection('how-it-works')}
              >
                How it works
              </Button>
            </div>
          </div>
          <div className="relative">
            <PriceTrackerDashboard />
            
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
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
