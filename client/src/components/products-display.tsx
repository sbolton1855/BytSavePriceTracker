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
    
    const handleProductTracked = () => {
      console.log("Product tracking detected, refetching data");
      // Force a complete data refresh
      queryClient.resetQueries({ queryKey: ['/api/tracked-products'] });
      setTimeout(() => {
        console.log("Performing manual refetch after tracking");
        refetch();
      }, 500);
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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Your Tracked Products</h2>
            <p className="mt-2 text-gray-500">Monitor price changes and manage your tracking list</p>
            
            {!isAuthenticated && (
              <div className="mt-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-blue-100 rounded-full p-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="font-medium text-sm text-blue-800">Create an account for additional features</h3>
                    <p className="text-xs text-blue-600 mt-1">Sign in to get a personalized dashboard, manage multiple products, and get additional price tracking features.</p>
                    <Button 
                      variant="link" 
                      className="p-0 h-auto text-xs text-blue-700 font-medium mt-1"
                      onClick={() => window.location.href = "/auth"}
                    >
                      Sign up or log in →
                    </Button>
                  </div>
                </div>
              </div>
            )}
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
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredProducts.map((trackedProduct: TrackedProductWithDetails) => (
                  <ProductCard 
                    key={trackedProduct.id} 
                    trackedProduct={trackedProduct} 
                    onRefresh={() => refetch()}
                  />
                ))}
                
                {/* Add new product card */}
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
                <p className="mt-1 text-gray-500">Start tracking an Amazon product to see it here</p>
                <Button 
                  className="mt-6"
                  onClick={() => document.getElementById('search-section')?.scrollIntoView({ behavior: "smooth" })}
                >
                  Track Your First Product
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
