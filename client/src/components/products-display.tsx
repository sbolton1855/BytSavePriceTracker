import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import ProductCard from "./product-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import type { TrackedProductWithDetails } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";

interface ProductsDisplayProps {
  email: string;
}

type FilterOption = "all" | "price-dropped" | "target-reached" | "recently-added";

const ProductsDisplay: React.FC<ProductsDisplayProps> = ({ email }) => {
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const [filter, setFilter] = useState<FilterOption>("all");
  
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
          const data = await res.json();
          console.log("ProductsDisplay - data changed:", data);
          return data;
        } catch (err) {
          console.error("Error fetching tracked products:", err);
          throw err;
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

  // Filter products based on selection
  const filteredProducts = data ? data.filter((product: TrackedProductWithDetails) => {
    switch (filter) {
      case "price-dropped":
        return product.product.currentPrice < (product.product.originalPrice || Number.POSITIVE_INFINITY);
      case "target-reached":
        return product.product.currentPrice <= product.targetPrice;
      case "recently-added":
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        return new Date(product.createdAt) >= oneWeekAgo;
      default:
        return true;
    }
  }) : [];

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
    console.log("ProductsDisplay - current email:", email);
    console.log("ProductsDisplay - data changed:", data);
    console.log("ProductsDisplay - filteredProducts:", filteredProducts);
    
    // Show detailed debug info
    if (!email || email.length === 0) {
      console.log("ProductsDisplay - No email provided");
    } else if (isLoading) {
      console.log("ProductsDisplay - Loading data for email:", email);
    } else if (isError) {
      console.error("ProductsDisplay - Error fetching data:", error);
    } else if (!data || data.length === 0) {
      console.log("ProductsDisplay - No products found for email:", email);
    } else {
      console.log("ProductsDisplay - Found", data.length, "products for email:", email);
    }
  }, [email, data, filteredProducts, isLoading, isError, error]);

  // For non-authenticated users, we'll show a version of this section that encourages login
  // but they can still view tracked products by email

  return (
    <section className="py-12 bg-gray-50" id="dashboard">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {!isAuthenticated && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-amber-800">Limited Session-Based Tracking</h3>
                <div className="mt-2 text-sm text-amber-700">
                  <p>You're viewing in guest mode. Some features are disabled. <strong>Register for free</strong> to unlock full functionality including price editing, permanent tracking, and email notifications.</p>
                  <Button 
                    size="sm" 
                    className="mt-2"
                    onClick={() => window.location.href = '/auth'}
                  >
                    Create Free Account
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
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
            {filteredProducts && filteredProducts.length > 0 ? (
              <div className={`grid gap-6 md:grid-cols-2 lg:grid-cols-3 ${!isAuthenticated ? 'opacity-60 pointer-events-none relative' : ''}`}>
                {!isAuthenticated && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 rounded-lg">
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
                
                {filteredProducts.map((trackedProduct: TrackedProductWithDetails) => {
                  // Create a unique key that includes target price to force re-render when it changes
                  const cardKey = `${trackedProduct.id}-${trackedProduct.targetPrice}-${trackedProduct.product.currentPrice}-${trackedProduct.product.lastChecked}`;
                  return (
                    <ProductCard 
                      key={cardKey}
                      trackedProduct={trackedProduct} 
                      onRefresh={() => {
                        console.log("ProductCard refresh triggered");
                        queryClient.invalidateQueries({ queryKey: ['/api/tracked-products'] });
                        queryClient.invalidateQueries({ queryKey: ['/api/my/tracked-products'] });
                        refetch();
                      }}
                      isAuthenticated={isAuthenticated}
                    />
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
    </section>
  );
};

export default ProductsDisplay;
