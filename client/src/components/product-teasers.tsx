
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingDown } from "lucide-react";

interface ProductTeaser {
  id: number;
  title: string;
  currentPrice: number;
  originalPrice: number | null;
  imageUrl: string | null;
  affiliateUrl: string;
}

const ProductTeasers = () => {
  const { data: teasers, isLoading } = useQuery<ProductTeaser[]>({
    queryKey: ["/api/products/teasers"],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (!teasers || teasers.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {teasers.map((teaser) => (
        <a
          key={teaser.id}
          href={teaser.affiliateUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center p-2 bg-white/50 backdrop-blur-sm rounded-lg border border-gray-200 hover:bg-white/75 transition-colors"
        >
          <div className="w-12 h-12 min-w-[48px] bg-gray-100 rounded-md overflow-hidden mr-3">
            {teaser.imageUrl ? (
              <img
                src={teaser.imageUrl}
                alt={teaser.title}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                <span className="text-xs text-gray-500">No img</span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-800 truncate">
              {teaser.title}
            </p>
            <div className="flex items-center gap-1">
              <span className="text-sm font-bold text-green-600">
                ${teaser.currentPrice.toFixed(2)}
              </span>
              {teaser.originalPrice && teaser.originalPrice > teaser.currentPrice && (
                <>
                  <span className="text-xs text-gray-500 line-through">
                    ${teaser.originalPrice.toFixed(2)}
                  </span>
                  <span className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded-full flex items-center">
                    <TrendingDown className="h-3 w-3 mr-0.5" />
                    {Math.round(
                      ((teaser.originalPrice - teaser.currentPrice) /
                        teaser.originalPrice) *
                        100
                    )}%
                  </span>
                </>
              )}
            </div>
          </div>
        </a>
      ))}
    </div>
  );
};

export default ProductTeasers;
