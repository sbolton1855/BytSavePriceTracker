import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, ArrowDownRight, Loader2 } from "lucide-react";
import { Product } from "@shared/schema";

type HighlightedDeal = Product & {
  discountPercentage: number;
  affiliateUrl?: string;
};

export default function HighlightedDeals() {
  const [deals, setDeals] = useState<HighlightedDeal[]>([]);
  
  // Fetch the top deals from the API
  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/products/deals"],
    queryFn: async () => {
      const res = await fetch("/api/products/deals");
      if (!res.ok) {
        throw new Error("Failed to fetch deals");
      }
      return res.json();
    },
  });

  // Process deals to calculate discount percentages
  useEffect(() => {
    if (data && Array.isArray(data)) {
      const processedDeals = data.map(product => {
        const originalPrice = product.originalPrice || product.highestPrice;
        const discountPercentage = originalPrice 
          ? Math.round(((originalPrice - product.currentPrice) / originalPrice) * 100) 
          : 0;
        
        return {
          ...product,
          discountPercentage
        };
      });
      
      // Sort by highest discount percentage
      processedDeals.sort((a, b) => b.discountPercentage - a.discountPercentage);
      
      // Take top 4 deals
      setDeals(processedDeals.slice(0, 4));
    }
  }, [data]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <div className="aspect-video bg-slate-100 flex items-center justify-center">
              <Skeleton className="h-[140px] w-[200px]" />
            </div>
            <CardHeader className="p-4">
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <Skeleton className="h-6 w-24 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
            <CardFooter className="p-4 pt-0">
              <Skeleton className="h-10 w-full" />
            </CardFooter>
          </Card>
        ))}
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {deals.map((deal) => (
        <Card key={deal.id} className="overflow-hidden flex flex-col">
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
            {deal.discountPercentage > 0 && (
              <Badge className="absolute top-2 right-2 bg-red-600">
                {deal.discountPercentage}% OFF
              </Badge>
            )}
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
            {deal.discountPercentage > 0 && (
              <div className="flex items-center text-red-600 text-sm mt-1">
                <ArrowDownRight className="h-4 w-4 mr-1" />
                Price dropped {deal.discountPercentage}%
              </div>
            )}
          </CardContent>
          <CardFooter className="p-4 pt-0">
            <div className="space-y-2">
              <Button asChild className="w-full">
                <a href={deal.affiliateUrl || deal.url} target="_blank" rel="noopener noreferrer">
                  View Deal <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Badge variant="outline" className="w-full justify-center py-1 border-dashed text-xs text-muted-foreground hover:bg-primary/5 cursor-pointer hover:border-primary transition-colors">
                <a href={`/dashboard?track=${deal.asin}`} className="flex items-center w-full justify-center">
                  Click to Track
                </a>
              </Badge>
            </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}