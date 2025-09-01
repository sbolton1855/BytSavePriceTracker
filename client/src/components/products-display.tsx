import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import ProductCard from "./product-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { TrackedProductWithDetails } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import React from "react"; // Import React for useMemo

// Utility function to validate if a price is valid
function isValidPrice(price: any): price is number {
  return typeof price === 'number' && !isNaN(price) && price > 0;
}

interface ProductsDisplayProps {
  email: string;
  onProductsChange?: (products: TrackedProductWithDetails[]) => void;
}

type FilterOption = "all" | "price-dropped" | "target-reached" | "recently-added";

const ProductsDisplay: React.FC<ProductsDisplayProps> = ({ email, onProductsChange }) => {
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const [filter, setFilter] = useState<FilterOption>("all");
  const [showSignupModal, setShowSignupModal] = useState(false);

  // Fetch tracked products - adapts to auth status
  const { data, isLoading, isError, error, refetch } = useQuery<TrackedProductWithDetails[]>({
    queryKey: isAuthenticated ? ['/api/my/tracked-products'] : ['/api/tracked-products', email],
    enabled: isAuthenticated ? true : (!!email && email.length > 0),
    queryFn: async ({ queryKey }) => {
      if (isAuthenticated) {
        console.log("ProductsDisplay - Fetching tracked products for authenticated user");

        try {
          // Add timestamp to prevent caching
          const timestamp = new Date().getTime();
          const res = await fetch(`${queryKey[0]}?_t=${timestamp}`, {
            credentials: 'include' // Important for authenticated requests
          });

          if (!res.ok) throw new Error('Failed to fetch tracked products');

          // Check if response is valid JSON
          const contentType = res.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            const text = await res.text();
            console.error('Non-JSON response received:', text);
            throw new Error('Invalid response format');
          }

          const data = await res.json();
          console.log("ProductsDisplay - data changed:", data);
          return data;
        } catch (err) {
          console.error("Error fetching tracked products:", err);
          // Return empty array on error to prevent component crash
          return [];
        }
      } else {
        console.log("ProductsDisplay - Fetching tracked products by email:", email);

        if (!email || email.length === 0) {
          console.log("No email provided, returning empty array");
          return [];
        }

        try {
          // Force email to uppercase to match stored format
          const upperEmail = email.toUpperCase();
          // Add timestamp to prevent caching
          const timestamp = new Date().getTime();
          const res = await fetch(`/api/tracked-products?email=${encodeURIComponent(upperEmail)}&_t=${timestamp}`);
          if (!res.ok) throw new Error('Failed to fetch tracked products');
          const data = await res.json();
          console.log("ProductsDisplay - data changed:", data);
          return data;
        } catch (err) {
          console.error("Error fetching tracked products:", err);
          throw err;
        }
      }
    },
    retry: 1,
    // Shorter stale time to refresh data more frequently
    staleTime: 0, // Always fetch fresh data
    // Refetch on window focus to keep data fresh
    refetchOnWindowFocus: true,
    refetchOnMount: true
  });

  // Filter products based on selection - simplified to match deployed version
  const filteredProducts = useMemo(() => {
    console.log('ProductsDisplay - data changed:', data);

    if (!data) {
      console.log('ProductsDisplay - No data available');
      return [];
    }

    // Handle different data structures
    let products = [];
    if (Array.isArray(data)) {
      products = data;
    } else if (data.items && Array.isArray(data.items)) {
      products = data.items;
    } else if (data.products && Array.isArray(data.products)) {
      products = data.products;
    } else {
      console.warn('ProductsDisplay - Data structure not recognized:', data);
      return [];
    }

    // Ensure products is an array
    if (!Array.isArray(products)) {
      console.warn('ProductsDisplay - Products data is not an array:', products);
      return [];
    }

    console.log(`ProductsDisplay - Found ${products.length} products`);
    return products;
  }, [data]);

  // Filter products based on selection
  const finalFilteredProducts = filteredProducts.filter((product: any) => {
    // Handle different product data structures
    const currentPrice = product.currentPrice || product.product?.currentPrice;
    const originalPrice = product.originalPrice || product.product?.originalPrice;
    const targetPrice = product.targetPrice;
    const createdAt = product.createdAt;

    if (!currentPrice) {
      console.warn('Product missing currentPrice:', product);
      return false;
    }

    switch (filter) {
      case "price-dropped":
        return currentPrice < (originalPrice || Number.POSITIVE_INFINITY);
      case "target-reached":
        return currentPrice <= targetPrice;
      case "recently-added":
        if (!createdAt) return false;
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        return new Date(createdAt) >= oneWeekAgo;
      default:
        return true;
    }
  });

  // Handle refresh all
  const handleRefreshAll = () => {
    // Reset all tracked product queries
    queryClient.invalidateQueries({ queryKey: ['/api/tracked-products'] });
    queryClient.invalidateQueries({ queryKey: ['/api/my/tracked-products'] });

    // Force refetch
    refetch();

    toast({
      title: "Refreshing products",
      description: "Updating prices for all your tracked products...",
    });
  };

  // Listen for product tracking events
  useEffect(() => {
    const handleProductDeleted = () => {
      console.log("Product deletion detected, refetching data");
      // Force a complete data refresh
      queryClient.resetQueries({ queryKey: ['/api/tracked-products'] });
      setTimeout(() => {
        console.log("Performing manual refetch after deletion");
        refetch();
      }, 500);
    };

    const handleProductTracked = (event: any) => {
      console.log("Product tracking detected, refetching data", event.detail);

      // Update email from the event if provided
      if (event.detail?.email) {
        console.log("Updating email from tracked event:", event.detail.email);
        // Store the email in localStorage for consistency
        localStorage.setItem("bytsave_user_email", event.detail.email);
      }

      // Show signup modal for non-authenticated users after they track a product
      if (!isAuthenticated) {
        setTimeout(() => {
          setShowSignupModal(true);
        }, 1500); // Show modal after products are refreshed
      }

      // Reset tracked products queries to ensure fresh data
      queryClient.resetQueries({ queryKey: ['/api/tracked-products'] });

      // Wait a moment for the database to update
      setTimeout(() => {
        console.log("Performing manual refetch after tracking");
        refetch();
      }, 800);
    };

    // Add event listeners
    document.addEventListener('product-deleted', handleProductDeleted);
    document.addEventListener('product-tracked', handleProductTracked);

    // Clean up
    return () => {
      document.removeEventListener('product-deleted', handleProductDeleted);
      document.removeEventListener('product-tracked', handleProductTracked);
    };
  }, [refetch]);

  useEffect(() => {
    if (isError) {
      toast({
        title: "Error fetching products",
        description: error instanceof Error ? error.message : "Please try again later",
        variant: "destructive",
      });
    }
  }, [isError, error, toast]);

  // Debug effect to show data changes
  useEffect(() => {
    const currentEmail = email;
    console.log("ProductsDisplay - current email:", currentEmail);
    console.log("ProductsDisplay - data changed:", data);
    console.log("ProductsDisplay - filteredProducts:", finalFilteredProducts);

    // Show detailed debug info
    if (!currentEmail || currentEmail.length === 0) {
      console.log("ProductsDisplay - No email provided");
    } else if (isLoading) {
      console.log("ProductsDisplay - Loading data for email:", currentEmail);
    } else if (isError) {
      console.error("ProductsDisplay - Error fetching data:", error);
    } else if (!data || data.length === 0) {
      console.log("ProductsDisplay - No products found for email:", currentEmail);
    } else {
      console.log('ProductsDisplay - Found', finalFilteredProducts.length, 'products for email:', currentEmail);

      // Debug logging for TRUEplus product
      const trueplus = finalFilteredProducts.find(p => p.product.asin === 'B01DJGLYZQ');
      if (trueplus) {
        console.log('DEBUG: TRUEplus product in dashboard:', {
          asin: trueplus.product.asin,
          currentPrice: trueplus.product.currentPrice,
          originalPrice: trueplus.product.originalPrice,
          title: trueplus.product.title.substring(0, 50) + '...'
        });
      }
    }
  }, [email, data, finalFilteredProducts, isLoading, isError, error]);

  useEffect(() => {
    if (onProductsChange && finalFilteredProducts) {
      onProductsChange(finalFilteredProducts);
    }
  }, [finalFilteredProducts, onProductsChange]);

  // For non-authenticated users, we'll show a version of this section that encourages login
  // but they can still view tracked products by email

  return (
    <section className="py-12 bg-gray-50" id="dashboard">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Your Tracked Products</h2>
            <p className="mt-2 text-gray-500">Monitor price changes and manage your tracking list</p>
          </div>

          <div className="mt-4 md:mt-0 flex items-center">
            <Select
              value={filter}
              onValueChange={(value) => setFilter(value as FilterOption)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter products" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                <SelectItem value="price-dropped">Price Dropped</SelectItem>
                <SelectItem value="target-reached">Target Reached</SelectItem>
                <SelectItem value="recently-added">Recently Added</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              className="ml-3"
              onClick={handleRefreshAll}
              disabled={isLoading}
            >
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
                className="mr-2"
              >
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                <path d="M16 16h5v5" />
              </svg>
              {isLoading ? "Refreshing..." : "Refresh All"}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200 p-5">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/4 mb-4" />
                <div className="flex items-center">
                  <Skeleton className="h-24 w-24 rounded-md" />
                  <div className="ml-4 w-full">
                    <Skeleton className="h-6 w-1/2 mb-2" />
                    <Skeleton className="h-4 w-3/4 mb-1" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {finalFilteredProducts && finalFilteredProducts.length > 0 ? (
              <div className={`grid gap-6 md:grid-cols-2 lg:grid-cols-3 ${!isAuthenticated ? 'opacity-60 relative' : ''}`}>
                {!isAuthenticated && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 rounded-lg pointer-events-auto">
                    <div className="text-center p-6 bg-white rounded-lg shadow-lg border-2 border-primary-200">
                      <div className="h-12 w-12 rounded-full bg-primary-100 text-primary-500 flex items-center justify-center mx-auto mb-3">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 12l2 2 4-4" />
                          <path d="M21 12c.552 0 1-.448 1-1V5c0-.552-.448-1-1-1H3c-.552 0-1 .448-1 1v6c0 .552.448 1 1 1h18z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Unlock Full Features</h3>
                      <p className="text-sm text-gray-600 mb-4">Register to edit prices, save permanently, and get email alerts</p>
                      <Button
                        onClick={() => window.location.href = '/auth'}
                        className="w-full"
                      >
                        Create Free Account
                      </Button>
                    </div>
                  </div>
                )}

                {finalFilteredProducts.map((trackedProduct: any) => {
                  // Handle different data structures and create normalized structure for ProductCard
                  const normalizedProduct = {
                    ...trackedProduct,
                    product: trackedProduct.product || {
                      id: trackedProduct.id,
                      asin: trackedProduct.asin,
                      title: trackedProduct.title,
                      imageUrl: trackedProduct.image || trackedProduct.imageUrl,
                      currentPrice: trackedProduct.currentPrice,
                      originalPrice: trackedProduct.originalPrice,
                      url: trackedProduct.url || `https://amazon.com/dp/${trackedProduct.asin}`,
                      lastChecked: trackedProduct.lastCheckedAt || trackedProduct.lastChecked || new Date().toISOString()
                    },
                    email: trackedProduct.email || email
                  };

                  // Create a unique key that includes target price to force re-render when it changes
                  const currentPrice = normalizedProduct.product.currentPrice;
                  const lastChecked = normalizedProduct.product.lastChecked;
                  const cardKey = `${normalizedProduct.id}-${normalizedProduct.targetPrice}-${currentPrice}-${lastChecked}`;

                  return (
                    <div key={cardKey} className={!isAuthenticated ? 'pointer-events-none' : ''}>
                      <ProductCard
                        trackedProduct={normalizedProduct}
                        onRefresh={() => {
                          console.log("ProductCard refresh triggered");
                          queryClient.invalidateQueries({ queryKey: ['/api/tracked-products'] });
                          queryClient.invalidateQueries({ queryKey: ['/api/my/tracked-products'] });
                          refetch();
                        }}
                        isAuthenticated={isAuthenticated}
                      />
                    </div>
                  );
                })}

                {/* Add new product card - only for authenticated users */}
                {isAuthenticated && (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center text-center">
                    <div className="h-12 w-12 rounded-full bg-primary-100 text-primary-500 flex items-center justify-center mb-3">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14" />
                        <path d="M12 5v14" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">Add Another Product</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Track more Amazon products to maximize your savings
                    </p>
                    <Button
                      className="mt-4"
                      onClick={() => document.getElementById('search-section')?.scrollIntoView({ behavior: "smooth" })}
                    >
                      Add Product
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-lg shadow-sm">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-12 w-12 mx-auto text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-gray-900">No products tracked yet</h3>
                <p className="mt-1 text-gray-500">
                  {!isAuthenticated
                    ? "Register for free to start tracking products and get price alerts"
                    : "Start tracking an Amazon product to see it here"
                  }
                </p>
                <Button
                  className="mt-6"
                  onClick={() => !isAuthenticated
                    ? window.location.href = '/auth'
                    : document.getElementById('search-section')?.scrollIntoView({ behavior: "smooth" })
                  }
                >
                  {!isAuthenticated ? "Create Free Account" : "Track Your First Product"}
                </Button>
              </div>
            )}
          </>
        )}

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Want to track more than 10 products? <a href="#" className="text-primary-500 font-medium hover:text-primary-600">Upgrade to Premium</a>
          </p>
        </div>
      </div>

      {/* Signup Encouragement Modal */}
      <Dialog open={showSignupModal} onOpenChange={setShowSignupModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">🎉</span>
              Great choice! Want to save this permanently?
            </DialogTitle>
            <DialogDescription>
              Create a free account to permanently save your tracking, get email alerts when prices drop, and edit your target prices anytime!
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 mt-4">
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={() => window.location.href = '/auth'}
            >
              Sign Up Free
            </Button>
            <Button
              variant="outline"
              className="w-full border-blue-300 text-blue-700 hover:bg-blue-50"
              onClick={() => window.location.href = '/auth'}
            >
              Login to Existing Account
            </Button>
            <Button
              variant="ghost"
              className="w-full text-sm text-gray-500"
              onClick={() => setShowSignupModal(false)}
            >
              Continue as Guest
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default ProductsDisplay;