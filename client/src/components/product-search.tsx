import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Search, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  TrackingFormData,
  trackingFormSchema,
} from "@shared/schema";

const searchSchema = z.object({
  query: z.string().min(3, "Search query must be at least 3 characters"),
});

type ProductSearchResult = {
  asin: string;
  title: string;
  price?: number;
  imageUrl?: string;
  url: string;
  affiliateUrl: string;
  id?: number;
  lowestPrice?: number;
  highestPrice?: number;
};

export default function ProductSearch({
  onSuccess
}: {
  onSuccess?: () => void
}) {
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [searchTab, setSearchTab] = useState<string>("name");
  const [selectedProduct, setSelectedProduct] = useState<ProductSearchResult | null>(null);
  const [email, setEmail] = useState<string>(user?.email || "");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>("");

  // Debounce the search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500); // 500ms delay

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

  // Form for searching products
  const searchForm = useForm<z.infer<typeof searchSchema>>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      query: "",
    },
  });

  // Form for tracking products
  const trackForm = useForm<TrackingFormData>({
    resolver: zodResolver(trackingFormSchema),
    defaultValues: {
      productUrl: "",
      targetPrice: 0,
      email: user?.email || "",
      percentageAlert: false,
      percentageThreshold: 0,
    },
  });

  // Update email when user authentication changes
  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
      trackForm.setValue("email", user.email);
    }
  }, [user, trackForm]);

  // Handle search input with debounce
  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
  };

  // Search results query
  const {
    data: searchResults,
    isLoading: isSearching,
  } = useQuery<ProductSearchResult[]>({
    queryKey: ["/api/search", debouncedSearchQuery],
    queryFn: async () => {
      if (!debouncedSearchQuery || debouncedSearchQuery.length < 3) {
        return [];
      }

      const res = await fetch(
        `/api/search?q=${encodeURIComponent(debouncedSearchQuery)}`
      );
      if (!res.ok) {
        throw new Error("Failed to search products");
      }
      return res.json();
    },
    enabled: debouncedSearchQuery.length >= 3 && searchTab === "name",
  });

  // URL/ASIN search query
  const {
    data: productData,
    isLoading: isProductLoading,
  } = useQuery<ProductSearchResult>({
    queryKey: ["/api/product", trackForm.watch("productUrl")],
    queryFn: async () => {
      const url = trackForm.watch("productUrl");
      if (!url || url.length < 10) {
        return null;
      }

      const res = await fetch(
        `/api/product?url=${encodeURIComponent(url)}`
      );
      if (!res.ok) {
        throw new Error("Failed to fetch product details");
      }

      const data = await res.json();
      if (data) {
        setSelectedProduct(data);
      }
      return data;
    },
    enabled: trackForm.watch("productUrl").length >= 10 && searchTab === "url",
  });

  // Track product form submission
  const onTrackSubmit = async (data: TrackingFormData) => {
    console.log("Starting tracking request with data:", data);

    // Show loading toast
    toast({
      title: "Processing tracking request...",
      description: "Setting up price tracking for this product.",
    });

    try {
      // Get current product details
      const productToTrack = selectedProduct || productData;
      
      if (!productToTrack) {
        toast({
          title: "No product selected",
          description: "Please select a product or enter a valid Amazon URL",
          variant: "destructive",
        });
        return;
      }

      // Create simplified tracking data
      const trackingData = {
        productUrl: productToTrack.url,
        targetPrice: parseFloat(data.targetPrice.toString()),
        email: isAuthenticated ? user?.email : data.email
      };

      console.log("Submitting tracking data:", trackingData);

      // Use consistent endpoint for tracking
      const endpoint = '/api/track';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(trackingData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      const result = await response.json();
      console.log("Tracking success:", result);

      // Create success message
      const productTitle = productToTrack.title.length > 30 
        ? productToTrack.title.substring(0, 30) + "..." 
        : productToTrack.title;
      
      let successMessage = `We'll notify you when <strong>${productTitle}</strong> drops below <strong>$${data.targetPrice.toFixed(2)}</strong>.`;

      // We don't need to dismiss the previous toast as a new one will replace it
      
      // Show success toast
      toast({
        title: "✅ Price tracking activated!",
        description: successMessage,
        duration: 6000,
      });

      // Force refresh tracked products data - important to show newly added item
      queryClient.invalidateQueries({ queryKey: ["/api/tracked-products"] });
      if (isAuthenticated) {
        queryClient.invalidateQueries({ queryKey: ["/api/my/tracked-products"] });
      }
      
      // Also refetch without cache to ensure we get latest data
      await fetch(`/api/tracked-products?email=${encodeURIComponent(data.email || '')}&_t=${Date.now()}`, {
        credentials: 'include'
      });

      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }

      // Reset form and selection for a clean state
      if (searchTab === "name") {
        setSelectedProduct(null);
        setSearchQuery("");
      } else {
        trackForm.reset({
          productUrl: "",
          targetPrice: 0,
          email: trackForm.getValues("email")
        });
      }

      // Scroll to the dashboard
      setTimeout(() => {
        const dashboardElement = document.getElementById('dashboard');
        if (dashboardElement) {
          dashboardElement.scrollIntoView({ behavior: 'smooth' });
          // Highlight the dashboard briefly to draw attention
          dashboardElement.classList.add('pulse-highlight');
          setTimeout(() => {
            dashboardElement.classList.remove('pulse-highlight');
          }, 2000);
        }
      }, 500);
    } catch (error) {
      console.error("Track submission error:", error);
      toast({
        title: "Failed to track product",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    }
  };

  // Set product info when selected from search results
  const selectProduct = (product: ProductSearchResult) => {
    setSelectedProduct(product);
    trackForm.setValue("productUrl", product.url);

    // Set default target price 10% below current price
    if (product.price) {
      const suggestedPrice = Math.round(product.price * 0.9 * 100) / 100;
      trackForm.setValue("targetPrice", suggestedPrice);
    }

    // Set email
    if (user?.email) {
      trackForm.setValue("email", user.email);
    } else if (email) {
      trackForm.setValue("email", email);
    }
    
    // Scroll to the tracking form section
    setTimeout(() => {
      // Find the selected product form area
      const trackingForm = document.getElementById("selected-product-form");
      if (trackingForm) {
        trackingForm.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Track Amazon Products</CardTitle>
          <CardDescription>
            Find products to track by URL or search by name
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Product Search Method Selection */}
            <div className="flex flex-col space-y-2">
              <Label>How would you like to find products?</Label>
              <div className="flex space-x-4 pt-2">
                <div className="flex items-center space-x-2">
                  <input 
                    type="radio" 
                    id="search-by-name" 
                    name="search-method" 
                    checked={searchTab === "name"} 
                    onChange={() => setSearchTab("name")}
                    className="h-4 w-4 border-gray-300 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="search-by-name" className="cursor-pointer">Product Name</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input 
                    type="radio" 
                    id="search-by-url" 
                    name="search-method" 
                    checked={searchTab === "url"} 
                    onChange={() => setSearchTab("url")}
                    className="h-4 w-4 border-gray-300 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="search-by-url" className="cursor-pointer">URL or ASIN</Label>
                </div>
              </div>
            </div>

            {/* Product Search Input */}
            <div className="border-t pt-5">
              {searchTab === "url" ? (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label htmlFor="productUrl">
                      Enter Amazon Product URL or ASIN
                    </Label>
                    <Input
                      id="productUrl"
                      placeholder="https://www.amazon.com/dp/B0123456 or B0123456"
                      {...trackForm.register("productUrl")}
                    />
                    {trackForm.formState.errors.productUrl && (
                      <p className="text-sm text-red-500">
                        {trackForm.formState.errors.productUrl.message}
                      </p>
                    )}
                  </div>

                  {isProductLoading && (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                      <span>Loading product details...</span>
                    </div>
                  )}

                  {productData && (
                    <div className="mt-4">
                      <div className="bg-slate-50 p-4 rounded-md">
                        <div className="flex items-start gap-3">
                          {productData.imageUrl && (
                            <img 
                              src={productData.imageUrl} 
                              alt={productData.title} 
                              className="w-16 h-16 object-contain"
                            />
                          )}
                          <div>
                            <p className="font-medium text-sm">{productData.title}</p>
                            {productData.price && (
                              <p className="text-primary font-bold mt-1">${productData.price.toFixed(2)}</p>
                            )}
                            <a 
                              href={productData.affiliateUrl} 
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline inline-flex items-center mt-1"
                            >
                              View on Amazon <ChevronRight className="h-3 w-3 ml-1" />
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label htmlFor="searchQuery">
                      Search for Products
                    </Label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="searchQuery"
                        placeholder="Search for products by name..."
                        className="pl-8"
                        value={searchQuery}
                        onChange={(e) => handleSearchInput(e.target.value)}
                      />
                    </div>
                  </div>

                  {isSearching && (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                      <span>Searching for products...</span>
                    </div>
                  )}

                  {searchResults && searchResults.length === 0 && searchQuery.length >= 3 && !isSearching && (
                    <div className="text-center py-4 text-muted-foreground">
                      No products found for "{searchQuery}"
                    </div>
                  )}

                  {searchResults && searchResults.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="font-medium text-sm">
                        Found {searchResults.length} products
                      </h3>
                      <div className="max-h-[300px] overflow-y-auto space-y-3 pr-1">
                        {searchResults.map((product) => (
                          <div
                            key={product.asin}
                            className="border rounded-md overflow-hidden hover:border-primary/50 transition-colors cursor-pointer"
                            onClick={() => selectProduct(product)}
                          >
                            <div className="flex p-3 gap-3">
                              {product.imageUrl ? (
                                <img
                                  src={product.imageUrl}
                                  alt={product.title}
                                  className="w-16 h-16 object-contain"
                                />
                              ) : (
                                <div className="w-16 h-16 bg-slate-100 flex items-center justify-center text-muted-foreground text-xs">
                                  No image
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium line-clamp-2">
                                  {product.title}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  {product.price && (
                                    <p className="text-primary font-semibold">
                                      ${product.price.toFixed(2)}
                                    </p>
                                  )}
                                  <a
                                    href={product.affiliateUrl}
                                    className="text-xs text-blue-600 hover:underline inline-flex items-center"
                                    onClick={(e) => e.stopPropagation()}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    View <ChevronRight className="h-3 w-3 ml-0.5" />
                                  </a>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Selected Product Form Section */}
            {(productData || selectedProduct) && (
              <div className="border-t pt-5" id="selected-product-form">
                <h3 className="font-medium mb-4">Set Your Price Target</h3>
                
                <form
                  onSubmit={trackForm.handleSubmit(onTrackSubmit)}
                  className="space-y-4"
                >
                  <div className="space-y-1">
                    <Label htmlFor="targetPrice">
                      Desired Price ($)
                    </Label>
                    <Input
                      id="targetPrice"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="Enter your desired price"
                      {...trackForm.register("targetPrice", {
                        valueAsNumber: true,
                      })}
                    />
                    <p className="text-xs text-muted-foreground">
                      We'll notify you when the price drops to this amount or lower
                    </p>
                    {trackForm.formState.errors.targetPrice && (
                      <p className="text-sm text-red-500">
                        {trackForm.formState.errors.targetPrice.message}
                      </p>
                    )}
                  </div>

                  {!isAuthenticated && (
                    <div className="space-y-1">
                      <Label htmlFor="email">
                        Email for Notifications
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="Enter your email"
                        {...trackForm.register("email")}
                      />
                      <p className="text-xs text-muted-foreground">
                        We'll send you an email when the price drops to your target
                      </p>
                      {trackForm.formState.errors.email && (
                        <p className="text-sm text-red-500">
                          {trackForm.formState.errors.email.message}
                        </p>
                      )}
                    </div>
                  )}

                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={trackForm.formState.isSubmitting}
                  >
                    {trackForm.formState.isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Processing...
                      </>
                    ) : (
                      "Track Price"
                    )}
                  </Button>
                </form>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}