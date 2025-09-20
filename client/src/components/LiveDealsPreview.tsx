
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface Deal {
  asin: string;
  title: string;
  price: number;
  imageUrl?: string;
  url: string;
  savings?: {
    Amount: number;
    Percentage: number;
    DisplayAmount: string;
    Currency: string;
  } | null;
}

type Category = 'seasonal' | 'health' | 'tech';

const categoryLabels: Record<Category, string> = {
  seasonal: 'Seasonal Deals',
  health: 'Health & Beauty',
  tech: 'Tech & Gadgets'
};

const LiveDealsPreview: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<Category>('seasonal');

  const { data: response, isLoading } = useQuery({
    queryKey: ['/api/products/deals', selectedCategory],
    queryFn: async ({ queryKey }) => {
      console.log('[LiveDealsPreview] Fetching deals for category:', queryKey[1]);
      const res = await fetch(`/api/products/deals?category=${queryKey[1]}&limit=8`);
      if (!res.ok) throw new Error('Failed to fetch deals');
      const data = await res.json();
      console.log('[LiveDealsPreview] Raw API response:', data);
      return data;
    },
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  const deals = response?.deals || [];
  console.log('[LiveDealsPreview] Mapped deals:', deals);
  console.log('[LiveDealsPreview] Rendering, deals.length:', deals.length, 'isLoading:', isLoading);

  const handleCategoryChange = (category: Category) => {
    setSelectedCategory(category);
  };

  return (
    <section className="bg-blue-50 py-16">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-8 text-blue-800">
          Live Deals
        </h2>
        
        {/* Category Filter Buttons */}
        <div className="flex justify-center space-x-4 mb-8">
          {(Object.keys(categoryLabels) as Category[]).map((category) => (
            <Button
              key={category}
              onClick={() => handleCategoryChange(category)}
              variant={selectedCategory === category ? "default" : "outline"}
              className={selectedCategory === category ? "bg-blue-600 hover:bg-blue-700" : ""}
            >
              {categoryLabels[category]}
            </Button>
          ))}
        </div>

        {/* Deals Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, index) => (
              <Card key={index} className="overflow-hidden">
                <CardContent className="p-4">
                  <Skeleton className="w-full h-48 mb-4" />
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2 mb-2" />
                  <Skeleton className="h-6 w-1/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : deals.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">
              No {categoryLabels[selectedCategory].toLowerCase()} available at this moment.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {deals.slice(0, 4).map((deal: Deal, index: number) => {
              console.log('[LiveDealsPreview] Rendering deal:', deal);
              
              const affiliateUrl = deal.url.includes('tag=bytsave-20') 
                ? deal.url 
                : deal.url + (deal.url.includes('?') ? '&' : '?') + 'tag=bytsave-20';

              return (
                <Card key={deal.asin} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
                    {deal.imageUrl && (
                      <div className="w-full h-48 mb-4 flex items-center justify-center bg-gray-100 rounded">
                        <img
                          src={deal.imageUrl}
                          alt={deal.title}
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                    )}
                    <h3 className="font-semibold text-sm mb-2 line-clamp-2">
                      {deal.title}
                    </h3>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-lg font-bold text-green-600">
                        ${deal.price.toFixed(2)}
                      </span>
                      {deal.savings && (
                        <span className="text-sm text-red-600 font-medium">
                          Save {deal.savings.Percentage}%
                        </span>
                      )}
                    </div>
                    <Button
                      asChild
                      className="w-full bg-orange-500 hover:bg-orange-600"
                    >
                      <a 
                        href={affiliateUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View Deal
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default LiveDealsPreview;
