
import { useQuery } from "@tanstack/react-query";
import { UnifiedProductCard } from "./UnifiedProductCard";
import { Loader2 } from "lucide-react";

export function FeaturedDealsGrid() {
  const { data: gridProducts, isLoading } = useQuery({
    queryKey: ['featured-deals-grid'],
    queryFn: async () => {
      const response = await fetch('/api/amazon/deals?limit=4');
      if (!response.ok) throw new Error('Failed to fetch products');
      const result = await response.json();
      return result.data?.deals || [];
    },
    refetchInterval: 300000, // Refetch every 5 minutes
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!gridProducts || gridProducts.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No featured deals available at the moment.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {gridProducts.slice(0, 4).map((product: any) => {
        const currentPrice = product.price || product.currentPrice || 0;
        const originalPrice = product.msrp || product.originalPrice || null;
        const savings = product.savings || {};
        
        return (
          <UnifiedProductCard
            key={product.asin}
            title={product.title || 'Product'}
            image={product.imageUrl || ''}
            url={product.url || `https://www.amazon.com/dp/${product.asin}?tag=bytsave-20`}
            currentPrice={currentPrice.toString()}
            originalPrice={originalPrice?.toString()}
            savings={{
              amount: savings.Amount?.toString() || (originalPrice && originalPrice > currentPrice ? (originalPrice - currentPrice).toFixed(2) : undefined),
              percentage: savings.Percentage || (originalPrice && originalPrice > currentPrice ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100) : undefined)
            }}
            asin={product.asin}
          />
        );
      })}
    </div>
  );
}
