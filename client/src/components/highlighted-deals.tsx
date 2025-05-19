import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, ArrowDownRight, Loader2, RefreshCw } from "lucide-react";
import { Product } from "@shared/schema";

type HighlightedDeal = Product & {
  discountPercentage: number;
  savings?: number;
  affiliateUrl?: string;
  isNewAddition?: boolean;
};

export default function HighlightedDeals() {
  const [deals, setDeals] = useState<HighlightedDeal[]>([]);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  
  // Fetch the top deals from the API
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["/api/products/deals", refreshKey],
    queryFn: async () => {
      // Add rotation parameter and timestamp to ensure different products
      const timestamp = Date.now();
      const rotation = refreshKey % 10; // Create 10 different product sets
      const res = await fetch(`/api/products/deals?t=${timestamp}&rotate=${rotation}`);
      
      if (!res.ok) {
        throw new Error("Failed to fetch deals");
      }
      
      const data = await res.json();
      console.log(`Received ${data.length} products, rotation: ${rotation}`, 
                 data.map((p: any) => p.id));
      return data;
    },
    // Disable caching for fresh data
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
  
  // Function to manually refresh deals
  const refreshDeals = () => {
    setRefreshKey(prev => prev + 1);
  };

  // Process deals to calculate discount percentages and rotate them for variety
  useEffect(() => {
    if (data && Array.isArray(data)) {
      const processedDeals = data.map(product => {
        const savings = product.savings || 
          (product.originalPrice ? (product.originalPrice - product.currentPrice) : 0);
        
        return {
          ...product,
          discountPercentage: product.discountPercentage || 
            (product.originalPrice ? Math.round(((product.originalPrice - product.currentPrice) / product.originalPrice) * 100) : 0),
          savings: Math.round(savings * 100) / 100
        };
      });
      
      // Add extra randomization using refreshKey in the sort
      // This helps produce different results each time
      const shuffleAmount = refreshKey % 4 + 1; // 1-4 based on refreshKey
      
      // Get all deals with any discount
      const dealsWithDiscount = processedDeals.filter(deal => deal.discountPercentage > 0);
      
      // Apply multiple shuffling passes for better randomization
      let shuffledDeals = [...dealsWithDiscount];
      for (let i = 0; i < shuffleAmount; i++) {
        shuffledDeals = shuffledDeals.sort(() => Math.random() - 0.5);
      }
      
      // Take a variable number of top deals based on refreshKey
      const dealsCount = Math.min(6, Math.max(3, shuffledDeals.length));
      let selectedDeals = shuffledDeals.slice(0, dealsCount);
      
      // If we need more deals, add regular products
      if (selectedDeals.length < 6) {
        // Get non-discounted deals and shuffle them with multiple passes
        let regularDeals = processedDeals
          .filter(deal => deal.discountPercentage === 0 || deal.discountPercentage === null);
        
        // Multiple shuffle passes
        for (let i = 0; i < shuffleAmount; i++) {
          regularDeals = regularDeals.sort(() => Math.random() - 0.5);
        }
        
        // Take what we need to fill the grid
        regularDeals = regularDeals.slice(0, 6 - selectedDeals.length);
        selectedDeals = [...selectedDeals, ...regularDeals];
      }
      
      // One final shuffle to mix discounted and regular products
      selectedDeals = selectedDeals.sort(() => Math.random() - 0.5);
      
      setDeals(selectedDeals);
    }
  }, [data, refreshKey]);

  if (isLoading) {
    return (
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Price Drop Dashboard</h2>
          <div className="h-9 w-32 bg-slate-100 rounded-md animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden h-full">
              <div className="aspect-video bg-slate-100 flex items-center justify-center relative">
                <Skeleton className="h-[140px] w-[200px]" />
                <div className="absolute top-2 right-2">
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </div>
              <CardHeader className="p-4">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </CardHeader>
              <CardContent className="p-4 pt-0 flex-grow">
                <Skeleton className="h-6 w-24 mb-3" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <div className="mt-3 flex justify-between">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </CardContent>
              <CardFooter className="p-4 pt-0">
                <div className="space-y-2 w-full">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-7 w-full" />
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (isError || !deals.length) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-center">No Deals Available</CardTitle>
          <CardDescription className="text-center">
            We couldn't find any top deals right now. Please check back later.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Price Drop Dashboard</h2>
        <Button 
          onClick={refreshDeals} 
          variant="outline"
          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-100 border border-amber-300 text-amber-800 hover:bg-amber-200 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh Deals
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {deals.map((deal) => (
          <Card key={deal.id} className="overflow-hidden flex flex-col h-full hover:shadow-lg transition-shadow">
            <div className="aspect-video bg-slate-50 flex items-center justify-center relative overflow-hidden">
              {deal.imageUrl ? (
                <img 
                  src={deal.imageUrl} 
                  alt={deal.title} 
                  className="object-contain w-full h-full p-2"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-slate-400">
                  No image available
                </div>
              )}
              <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                {deal.discountPercentage > 0 && (
                  <Badge className="bg-red-600 text-white">
                    {deal.discountPercentage}% OFF
                  </Badge>
                )}
                {deal.isNewAddition && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    New Find
                  </Badge>
                )}
              </div>
            </div>
            <CardHeader className="p-4 pb-0">
              <CardTitle className="text-sm font-medium line-clamp-2">
                {deal.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2 flex-grow">
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-primary">
                  ${deal.currentPrice.toFixed(2)}
                </span>
                {deal.originalPrice && deal.originalPrice > deal.currentPrice && (
                  <span className="text-sm line-through text-muted-foreground">
                    ${deal.originalPrice.toFixed(2)}
                  </span>
                )}
              </div>
              
              {/* Price drop info */}
              {deal.discountPercentage > 0 && (
                <div className="flex flex-col gap-1 mt-1">
                  <div className="flex items-center text-red-600 text-sm">
                    <ArrowDownRight className="h-4 w-4 mr-1" />
                    Price dropped {deal.discountPercentage}%
                  </div>
                  {deal.savings && deal.savings > 0 && (
                    <div className="text-green-600 text-sm font-medium">
                      Save ${deal.savings.toFixed(2)}
                    </div>
                  )}
                </div>
              )}
              
              {/* Historical price context */}
              <div className="mt-2 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Lowest: ${(deal.lowestPrice ?? deal.currentPrice).toFixed(2)}</span>
                  <span>Highest: ${(deal.highestPrice ?? deal.currentPrice).toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="p-4 pt-0">
              <div className="space-y-2 w-full">
                <Button asChild className="w-full">
                  <a href={deal.affiliateUrl || deal.url} target="_blank" rel="noopener noreferrer">
                    View Deal <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Badge variant="outline" className="w-full justify-center py-1 border-dashed text-xs text-muted-foreground hover:bg-primary/5 cursor-pointer hover:border-primary transition-colors">
                  <a href={`/dashboard?track=${deal.asin}`} className="flex items-center w-full justify-center">
                    Track Price
                  </a>
                </Badge>
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}