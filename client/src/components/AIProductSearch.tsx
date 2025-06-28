
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Brain, ExternalLink } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

interface AISearchProduct {
  asin: string;
  title: string;
  price: number | null;
  originalPrice?: number | null;
  imageUrl?: string;
  url: string;
  affiliateUrl: string;
  searchTerm: string;
  couponDetected?: boolean;
}

interface AISearchResponse {
  success: boolean;
  searchTerms: string[];
  analysis: string;
  products: AISearchProduct[];
  searchResults: Record<string, AISearchProduct[]>;
  totalProducts: number;
}

interface AIProductSearchProps {
  trackedProducts: any[];
  userEmail?: string;
}

export default function AIProductSearch({ trackedProducts, userEmail }: AIProductSearchProps) {
  const { toast } = useToast();
  const [hasSearched, setHasSearched] = useState(false);

  // AI product search query
  const { data: aiSearchData, isLoading, error, refetch } = useQuery<AISearchResponse>({
    queryKey: ["/api/ai/product-search", trackedProducts.length],
    queryFn: async () => {
      const response = await fetch("/api/ai/product-search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          trackedProducts: trackedProducts.map(tp => ({
            title: tp.product?.title || tp.title,
            price: tp.product?.currentPrice || tp.price
          })),
          userEmail: userEmail
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to get AI product suggestions");
      }

      return response.json();
    },
    enabled: false // Don't auto-run, wait for user to click
  });

  const handleAISearch = async () => {
    if (trackedProducts.length === 0) {
      toast({
        title: "No Products to Analyze",
        description: "You need to track some products first before we can suggest related items.",
        variant: "destructive"
      });
      return;
    }

    setHasSearched(true);
    refetch();
  };

  if (trackedProducts.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            AI Product Discovery
          </CardTitle>
          <CardDescription>
            Track some products first, then I'll suggest related items you might like!
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            AI Product Discovery
          </CardTitle>
          <CardDescription>
            Let AI analyze your tracked products and find complementary items from Amazon
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={handleAISearch}
            disabled={isLoading}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                AI is analyzing your products...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Find Related Products with AI
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600 text-sm">
              Error: {error instanceof Error ? error.message : "Failed to get AI suggestions"}
            </p>
          </CardContent>
        </Card>
      )}

      {hasSearched && aiSearchData && (
        <div className="space-y-6">
          {/* AI Analysis */}
          <Card className="bg-purple-50 border-purple-200">
            <CardHeader>
              <CardTitle className="text-purple-800">AI Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-purple-700">{aiSearchData.analysis}</p>
              <div className="mt-3">
                <p className="text-sm text-purple-600 font-medium">Search terms used:</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {aiSearchData.searchTerms.map((term, index) => (
                    <span 
                      key={index} 
                      className="bg-purple-100 text-purple-800 px-2 py-1 rounded-md text-xs"
                    >
                      "{term}"
                    </span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Product Results */}
          {aiSearchData.products.length > 0 ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Recommended Products ({aiSearchData.totalProducts} found)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {aiSearchData.products.map((product, index) => (
                  <Card key={`${product.asin}-${index}`} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* Product Image */}
                        {product.imageUrl && (
                          <div className="flex justify-center">
                            <img
                              src={product.imageUrl}
                              alt={product.title}
                              className="w-20 h-20 object-contain"
                            />
                          </div>
                        )}

                        {/* Product Title */}
                        <h4 className="text-sm font-medium line-clamp-2 text-gray-900">
                          {product.title}
                        </h4>

                        {/* Price */}
                        <div className="flex items-center justify-between">
                          {product.price ? (
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-bold text-green-600">
                                ${product.price.toFixed(2)}
                              </span>
                              {product.originalPrice && product.originalPrice > product.price && (
                                <span className="text-sm text-gray-500 line-through">
                                  ${product.originalPrice.toFixed(2)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-500 text-sm">Price not available</span>
                          )}
                          
                          {product.couponDetected && (
                            <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full">
                              Coupon
                            </span>
                          )}
                        </div>

                        {/* Search Term Badge */}
                        <div className="text-xs text-gray-500">
                          Found via: <span className="font-medium">"{product.searchTerm}"</span>
                        </div>

                        {/* Amazon Link */}
                        <a
                          href={product.affiliateUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full"
                        >
                          <Button 
                            className="w-full bg-amber-500 hover:bg-amber-600 text-white text-sm"
                            size="sm"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View on Amazon
                          </Button>
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-gray-500">No products found. Try tracking different items first.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
