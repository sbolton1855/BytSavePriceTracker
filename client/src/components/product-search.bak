import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Search, Link, ChevronRight, ArrowDown, Bell, Percent, DollarSign, TrendingDown } from "lucide-react";
import PriceHistoryChart from "@/components/price-history-chart";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [searchTab, setSearchTab] = useState<string>("url");
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

  // We'll add the user email effect after trackForm is defined
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

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
      percentageThreshold: 0, // No default percentage, user must select one
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
    if (searchTimeout) clearTimeout(searchTimeout);

    searchForm.setValue("query", value);

    const timeout = setTimeout(() => {
      setSearchQuery(value);
    }, 800); // Wait 800ms after user stops typing

    setSearchTimeout(timeout);
  };
  
  // Set email for both search modes
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    trackForm.setValue("email", e.target.value);
  };

  // Search results query
  const {
    data: searchResults,
    isLoading: isSearching,
    isFetching: isFetchingSearch,
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
      if (!url || url.length < 10) { // Basic validation for URL or ASIN
        return null;
      }

      const res = await fetch(
        `/api/product?url=${encodeURIComponent(url)}`
      );
      if (!res.ok) {
        throw new Error("Failed to fetch product details");
      }

      const data = await res.json();
      // Automatically set selected product when data is returned
      if (data) {
        setSelectedProduct(data);
      }
      return data;
    },
    enabled: trackForm.watch("productUrl").length >= 10 && searchTab === "url",
  });

  // Product tracking mutation
  const trackMutation = useMutation({
    mutationFn: async (data: TrackingFormData) => {
      console.log("About to send track request with data:", data);

      // Check authentication first
      if (!isAuthenticated) {
        console.error("User not authenticated, redirecting to login");
        window.location.href = "/auth";
        throw new Error("Please log in to track products");
      }

      // Use the correct endpoint
      const endpoint = "/api/my/track";
      console.log(`Calling endpoint ${endpoint} with data:`, JSON.stringify(data));

      // Use the API request utility which handles credentials properly
      try {
        const response = await apiRequest("POST", endpoint, data);
        const result = await response.json();
        console.log("Track API response:", result);
        return result;
      } catch (error) {
        console.error("Track API request failed:", error);

        // Check if the error is due to authentication
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes("401") || errorMessage.includes("Unauthorized")) {
          window.location.href = "/auth";
          throw new Error("Please log in to track products");
        }

        throw error;
      }
    },
    onSuccess: (result) => {
      console.log("Track mutation succeeded with result:", result);

      // Get the target price from the form data or result
      const targetPrice = trackForm.getValues("targetPrice");
      const isPercentage = trackForm.getValues("percentageAlert");
      const percentThreshold = trackForm.getValues("percentageThreshold");

      // Create a more descriptive success message
      let alertDescription = "";
      if (isPercentage) {
        alertDescription = `We'll notify you when ${selectedProduct?.title?.substring(0, 25)}... drops by ${percentThreshold}% (to $${targetPrice.toFixed(2)}).`;
      } else {
        alertDescription = `We'll notify you when ${selectedProduct?.title?.substring(0, 25)}... drops below $${targetPrice.toFixed(2)}.`;
      }

      // Show success toast with product details
      toast({
        title: "✅ Product tracking set up!",
        description: alertDescription,
        duration: 5000,
      });

      // Reset forms
      trackForm.reset();
      searchForm.reset();
      setSelectedProduct(null);

      console.log("Product tracked, invalidating queries...");

      // Forcefully invalidate and reset all related queries
      queryClient.invalidateQueries({ queryKey: ['/api/my/tracked-products'] });

      // Make a direct API call to fetch the latest data
      fetch('/api/my/tracked-products', { 
        credentials: 'include',
        headers: { 'Cache-Control': 'no-cache' }
      })
      .then(response => response.json())
      .then(data => {
        console.log("Fresh tracked products data:", data);
        // Update the cache with fresh data
        queryClient.setQueryData(['/api/my/tracked-products'], data);

        // Dispatch a custom event to notify other components
        document.dispatchEvent(new CustomEvent('product-tracked', { detail: data }));

        // Show additional confirmation with specific instructions
        toast({
          title: "Product Added to Dashboard",
          description: "Your tracked product has been added to your dashboard",
          action: (
            <Button 
              onClick={() => document.getElementById('dashboard')?.scrollIntoView({ behavior: "smooth" })}
              variant="outline"
              size="sm"
            >
              View My Products
            </Button>
          ),
        });

        // Call success callback if provided
        if (onSuccess) {
          onSuccess();
        }
      })
      .catch(error => {
        console.error("Error fetching updated tracked products:", error);
      });
    },
    onError: (error: Error) => {
      console.error("Track mutation failed:", error);
      toast({
        title: "Failed to track product",
        description: error.message,
        variant: "destructive",
        duration: 5000,
      });
    },
  });

  // Search products by name
  const onSearchSubmit = (data: z.infer<typeof searchSchema>) => {
    // Search is handled by the useQuery hook
  };

  // Track product form submission
  const onTrackSubmit = (data: TrackingFormData) => {
    // If user is authenticated, we'll use their account
    // If not, we'll use the provided email to track the product
    if (isAuthenticated) {
      console.log("Tracking product with authenticated user");
    } else {
      console.log("Tracking product with email:", data.email);
      // Validate email
      if (!data.email || !data.email.includes('@')) {
        toast({
          title: "Valid email required",
          description: "Please provide a valid email address to receive price drop alerts",
          variant: "destructive",
        });
        return;
      }
    }

    // Make sure we have a selected product
    if (!selectedProduct) {
      toast({
        title: "Product required",
        description: "Please select a product to track",
        variant: "destructive",
      });
      return;
    }

    // Create a copy of the data to avoid mutating the original form data
    const trackingData = { ...data };

    // For percentage-based alerts, calculate the target price if we have a current price
    if (trackingData.percentageAlert && selectedProduct?.price && trackingData.percentageThreshold) {
      const calculatedPrice = selectedProduct.price * (1 - trackingData.percentageThreshold / 100);
      // Round to 2 decimal places
      trackingData.targetPrice = Math.round(calculatedPrice * 100) / 100;
      console.log(`Calculated target price: $${trackingData.targetPrice} based on ${trackingData.percentageThreshold}% off $${selectedProduct.price}`);
    }

    // Always ensure we use the user's email if they're authenticated
    if (isAuthenticated && user?.email) {
      trackingData.email = user.email;
      console.log(`Using authenticated user email: ${trackingData.email}`);
    } else if (!trackingData.email || trackingData.email.trim() === '') {
      toast({
        title: "Email required",
        description: "Please provide an email address for price drop notifications",
        variant: "destructive",
      });
      return;
    }

    // Log the data being prepared
    console.log("Preparing tracking data:", trackingData);

    if (trackingData.percentageAlert && (!trackingData.percentageThreshold || trackingData.percentageThreshold <= 0)) {
      toast({
        title: "Percentage required",
        description: "Please select a percentage for the price drop alert",
        variant: "destructive",
      });
      return;
    }

    if (!trackingData.percentageAlert && (!trackingData.targetPrice || trackingData.targetPrice <= 0)) {
      toast({
        title: "Target price required",
        description: "Please enter a target price for the alert",
        variant: "destructive",
      });
      return;
    }

    // Make sure productId is set from the selected product
    if (selectedProduct.id) {
      trackingData.productId = selectedProduct.id;
      console.log(`Using product ID: ${trackingData.productId}`);

      // Double-check that other required fields are set
      if (!trackingData.targetPrice) {
        console.error("Missing targetPrice before submission");
        toast({
          title: "Missing price target",
          description: "Please set a target price for the alert",
          variant: "destructive",
        });
        return;
      }

      // All validations passed, show pending toast
      toast({
        title: "Setting up price tracking...",
        description: "Adding product to your tracked items",
      });

    } else {
      console.log(`No product ID available, will use URL: ${trackingData.productUrl}`);
      if (!trackingData.productUrl) {
        toast({
          title: "Missing product information",
          description: "Please select a product first",
          variant: "destructive",
        });
        return;
      }
    }

    // Submit the tracking request with full details
    console.log("Submitting tracking request with validated data:", JSON.stringify(trackingData));

    // Manually trigger the API call instead of using the mutation to have more control
    // Use different endpoints based on authentication status
    const trackEndpoint = isAuthenticated ? '/api/my/track' : '/api/track';
    
    fetch(trackEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(trackingData)
    })
    .then(response => {
      console.log("Track API response status:", response.status);

      if (response.status === 401) {
        console.error("Authentication required");
        toast({
          title: "Authentication required",
          description: "Please log in to track products",
          variant: "destructive",
        });
        setTimeout(() => window.location.href = "/auth", 1500);
        throw new Error("Authentication required");
      }

      if (!response.ok) {
        return response.text().then(text => {
          console.error("Track API error:", text);
          throw new Error(text || "Failed to track product");
        });
      }

      return response.json();
    })
    .then(result => {
      console.log("Track API success:", result);

      // Show success toast
      toast({
        title: "✅ Product tracking set up!",
        description: trackingData.percentageAlert ? 
          `We'll notify you when ${selectedProduct?.title?.substring(0, 25)}... drops by ${trackingData.percentageThreshold}%.` :
          `We'll notify you when ${selectedProduct?.title?.substring(0, 25)}... drops below $${trackingData.targetPrice.toFixed(2)}.`,
        duration: 5000,
      });

      // Reset forms
      trackForm.reset();
      searchForm.reset();
      setSelectedProduct(null);

      // Forcefully invalidate and refresh the product list
      queryClient.invalidateQueries({ queryKey: ['/api/tracked-products'] });
      queryClient.resetQueries({ queryKey: ['/api/tracked-products'] });

      // Force a fetch with a fresh request to update the UI
      fetch('/api/tracked-products', { credentials: 'include', cache: 'no-store' })
        .then(res => res.json())
        .then(data => {
          queryClient.setQueryData(['/api/tracked-products'], data);
          document.dispatchEvent(new CustomEvent('product-tracked'));

          // Show confirmation with view option
          toast({
            title: "Product Added to Dashboard",
            description: "Your tracked product has been added to your dashboard",
            action: (
              <Button 
                onClick={() => document.getElementById('dashboard')?.scrollIntoView({ behavior: "smooth" })}
                variant="outline"
                size="sm"
              >
                View My Products
              </Button>
            ),
          });

          // Call success callback if provided
          if (onSuccess) onSuccess();
        });
    })
    .catch(error => {
      console.error("Track product error:", error);
      toast({
        title: "Failed to track product",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    });
  };

  // Set product URL and email when a search result is selected
  const selectProduct = (product: ProductSearchResult) => {
    setSelectedProduct(product);
    trackForm.setValue("productUrl", product.url);

    // Set up default values based on the current price
    if (product.price) {
      // Default fixed price: 10% below current price, rounded to 2 decimal places
      const suggestedPrice = Math.round(product.price * 0.9 * 100) / 100;
      trackForm.setValue("targetPrice", suggestedPrice);

      // Reset percentage threshold, requiring user selection
      trackForm.setValue("percentageThreshold", 0);
      trackForm.setValue("percentageAlert", false); // Default to fixed price mode
    }

    // Set email - prioritize authenticated user's email
    if (user?.email) {
      trackForm.setValue("email", user.email);
    } else if (email) {
      trackForm.setValue("email", email);
    }

    // Scroll to the tracking form
    setTimeout(() => {
      document.getElementById("tracking-form")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  // Set email for both search modes
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    trackForm.setValue("email", e.target.value);
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <Tabs
        defaultValue={searchTab}
        value={searchTab}
        onValueChange={setSearchTab}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="url">Track by URL/ASIN</TabsTrigger>
          <TabsTrigger value="name">Search by Product Name</TabsTrigger>
        </TabsList>

        {/* URL/ASIN Search Tab */}
        <TabsContent value="url">
          <Card>
            <CardHeader>
              <CardTitle>Track Amazon Product</CardTitle>
              <CardDescription>
                Enter an Amazon product URL or ASIN to start tracking its price
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...trackForm}>
                <form
                  onSubmit={trackForm.handleSubmit(onTrackSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={trackForm.control}
                    name="productUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            placeholder="Amazon URL or ASIN"
                            {...field}
                            disabled={trackMutation.isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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

                      {/* Removed duplicate price history chart */}
                    </div>
                  )}

                  <FormField
                    control={trackForm.control}
                    name="targetPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Desired Price</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            inputMode="decimal"
                            placeholder="Enter your desired price"
                            {...field}
                            value={field.value > 0 ? field.value.toString() : ''}
                            onChange={(e) => {
                              // Remove leading zeros and allow only valid price format
                              const value = e.target.value.replace(/^0+(?=\d)/, '');
                              const price = parseFloat(value);
                              field.onChange(isNaN(price) ? 0 : price);
                            }}
                            disabled={trackMutation.isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {!isAuthenticated ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0 text-amber-500">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="font-medium">Login Required</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            You need to login to track prices and receive alerts
                          </p>
                        </div>
                      </div>
                      <div className="mt-4">
                        <Button 
                          className="w-full" 
                          onClick={() => window.location.href = "/auth"}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                            <polyline points="10 17 15 12 10 7"/>
                            <line x1="15" y1="12" x2="3" y2="12"/>
                          </svg>
                          Login to Track Prices
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {isAuthenticated && (
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={trackMutation.isPending}
                    >
                      {trackMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Setting up tracking...
                        </>
                      ) : (
                        "Track Price"
                      )}
                    </Button>
                  )}
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Product Name Search Tab */}
        <TabsContent value="name">
          <Card>
            <CardHeader>
              <CardTitle>Search Products</CardTitle>
              <CardDescription>
                Search for Amazon products by name and select one to track
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Form {...searchForm}>
                  <form
                    onSubmit={searchForm.handleSubmit(onSearchSubmit)}
                    className="space-y-4"
                  >
                    <div className="flex space-x-2">
                      <FormField
                        control={searchForm.control}
                        name="query"
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input
                                placeholder="Search for products..."
                                {...field}
                                value={field.value}
                                onChange={(e) => handleSearchInput(e.target.value)}
                                disabled={isSearching}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" disabled={isSearching}>
                        <Search className="h-4 w-4" />
                      </Button>
                    </div>
                  </form>
                </Form>

                {/* Search Results */}
                <div className="mt-4">
                  {(isSearching || isFetchingSearch) && (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  )}

                  {searchResults && searchResults.length === 0 && searchForm.watch("query").length >= 3 && !(isSearching || isFetchingSearch) && (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No products found</p>
                    </div>
                  )}

                  {searchResults && searchResults.length > 0 && !(isSearching || isFetchingSearch) && (
                    <div className="space-y-2">
                      <h3 className="font-medium mb-2 text-lg flex items-center">
                        <span className="mr-2 bg-primary text-white px-2 py-1 rounded-full text-xs">1</span>
                        Select a Product to Track
                      </h3>
                      <p className="text-sm text-muted-foreground mb-2">Click on a product below to set up price tracking</p>
                      <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {searchResults.map((product) => (
                          <div
                            key={product.asin}
                            className={`flex items-start border p-3 rounded-md cursor-pointer transition-colors ${
                              selectedProduct?.asin === product.asin
                                ? "border-primary bg-primary/5"
                                : "hover:bg-accent hover:border-primary"
                            } relative`}
                            onClick={() => selectProduct(product)}
                          >
                            {/* Now at the bottom instead of top-right */}
                            {product.imageUrl && (
                              <div className="mr-3 flex-shrink-0">
                                <img
                                  src={product.imageUrl}
                                  alt={product.title}
                                  className="w-16 h-16 object-contain"
                                />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm mb-1 line-clamp-2">
                                {product.title}
                              </h4>
                              {product.price !== undefined ? (
                                <p className="text-primary font-bold">
                                  ${product.price.toFixed(2)}
                                </p>
                              ) : (
                                <p className="text-muted-foreground text-sm">
                                  Price unavailable
                                </p>
                              )}
                              <div className="text-xs bg-primary text-white px-2 py-1 rounded-md inline-block mt-2">
                                Click to Track
                              </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Product Tracking Form (when product is selected) */}
                {selectedProduct && (
                  <div id="tracking-form" className="mt-6 border-t pt-4 bg-primary-50 p-4 rounded-lg">
                    <h3 className="font-medium mb-3 text-lg flex items-center">
                      <span className="mr-2 bg-primary text-white px-2 py-1 rounded-full text-xs">2</span>
                      Set Price Drop Alert
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      We'll notify you when the price drops below your desired price
                    </p>
                    
                    {!isAuthenticated ? (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0 text-amber-500">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                            </svg>
                          </div>
                          <div>
                            <h4 className="font-medium">Create an Account for More Features</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              For the best experience, login to access your dashboard, manage all your tracked products, and more advanced features.
                            </p>
                          </div>
                        </div>
                        <div className="mt-4">
                          <Button 
                            className="w-full mb-2" 
                            onClick={() => window.location.href = "/auth"}
                            variant="outline"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                              <polyline points="10 17 15 12 10 7"/>
                              <line x1="15" y1="12" x2="3" y2="12"/>
                            </svg>
                            Sign Up or Login for Full Features
                          </Button>
                        </div>
                      </div>
                    ) : null}
                    
                    <Form {...trackForm}>
                      <form
                        onSubmit={trackForm.handleSubmit(onTrackSubmit)}
                        className="space-y-4"
                      >
                        <div className="flex items-center space-x-3 mb-3">
                          {selectedProduct.imageUrl && (
                            <img
                              src={selectedProduct.imageUrl}
                              alt={selectedProduct.title}
                              className="w-12 h-12 object-contain"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm line-clamp-2">
                              {selectedProduct.title}
                            </h4>
                            {selectedProduct.price && (
                              <p className="text-primary font-bold">
                                ${selectedProduct.price.toFixed(2)}
                              </p>
                            )}
                          </div>
                          <a
                            href={selectedProduct.affiliateUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0"
                          >
                            <Button variant="outline" size="sm">
                              <Link className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </a>
                        </div>

                        {/* Removed duplicate price history chart - only kept in the alert section below */}

                        <div className="mb-6 bg-primary/5 p-4 rounded-lg border border-primary/10">
                          <div className="mb-4">
                            <h3 className="text-base font-medium">Set Your Price Alert</h3>
                            <p className="text-xs text-muted-foreground">
                              Choose how you want to be notified when the price drops
                            </p>
                              
                            {/* Show email field for non-authenticated users */}
                            {!isAuthenticated && (
                              <div className="mt-3">
                                <FormField
                                  control={trackForm.control}
                                  name="email"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-xs font-medium">Email for price alerts</FormLabel>
                                      <FormControl>
                                        <Input
                                          type="email"
                                          placeholder="Your Email"
                                          {...field}
                                          value={email || field.value}
                                          onChange={(e) => {
                                            field.onChange(e);
                                            handleEmailChange(e);
                                          }}
                                          disabled={trackMutation.isPending}
                                        />
                                      </FormControl>
                                      <FormMessage className="text-xs" />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            )}
                          </div>

                          {/* Hidden field to always set percentageAlert to false */}
                          <input type="hidden" {...trackForm.register("percentageAlert")} value="false" />
                          
                          <div className="space-y-3">
                            <div className="grid">
                              <div className="border rounded-lg p-3 bg-primary/10 border-primary/30 shadow-sm">
                                <div className="flex flex-col items-center text-center h-full justify-center py-3 text-primary">
                                  <DollarSign className="h-8 w-8 mb-2 text-primary" />
                                  <div className="font-medium">Price Alert</div>
                                  <div className="text-xs mt-1 text-muted-foreground">
                                    Alert when price falls below your target price
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Conditional field based on alert type */}
                        {!trackForm.watch("percentageAlert") ? (
                          <FormField
                            control={trackForm.control}
                            name="targetPrice"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Desired Price</FormLabel>
                                <div className="space-y-4">
                                  <FormControl>
                                    <div className="flex items-center">
                                      <span className="bg-muted px-3 py-2 rounded-l-md border border-r-0 border-input">$</span>
                                      <Input
                                        type="text"
                                        inputMode="decimal"
                                        className="rounded-l-none"
                                        placeholder="Enter your desired price"
                                        {...field}
                                        value={field.value !== undefined && field.value !== null && field.value > 0 ? field.value.toString() : ''}
                                        onChange={(e) => {
                                          // Allow decimal input and proper formatting
                                          const value = e.target.value;
                                          // Allow empty input, single decimal point, or valid decimal number
                                          if (value === '' || value === '.' || /^\d*\.?\d*$/.test(value)) {
                                            // For display purposes only, store as string in field
                                            field.onChange(value === '' || value === '.' ? 0 : parseFloat(value));
                                          }
                                        }}
                                        disabled={trackMutation.isPending}
                                      />
                                    </div>
                                  </FormControl>

                                  <FormMessage />

                                  {/* Quick suggestions based on current price */}
                                  {selectedProduct?.price && typeof selectedProduct.price === 'number' && (
                                    <div>
                                      <div className="flex items-center mb-2">
                                        <span className="text-xs text-muted-foreground">Quick suggestions:</span>
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        {[5, 10, 15, 20].map((discount) => {
                                          const suggestedPrice = Math.round(selectedProduct.price! * (1 - discount/100) * 100) / 100;
                                          return (
                                            <Button
                                              key={discount}
                                              type="button"
                                              size="sm"
                                              variant="outline"
                                              className="text-xs"
                                              onClick={() => field.onChange(suggestedPrice)}
                                            >
                                              ${suggestedPrice} <span className="text-muted-foreground ml-1">({discount}% off)</span>
                                            </Button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {/* Current price display */}
                                  {selectedProduct?.price && typeof selectedProduct.price === 'number' && (
                                    <div className="bg-slate-100 p-2 rounded-md border border-slate-200">
                                      <p className="text-sm">
                                        <span className="text-muted-foreground">Current price: </span>
                                        <span className="font-medium">${selectedProduct.price.toFixed(2)}</span>
                                      </p>
                                      {field.value !== undefined && field.value !== null && field.value > 0 && field.value < selectedProduct.price && (
                                        <p className="text-sm mt-1 text-green-600 flex items-center">
                                          <ArrowDown className="h-3 w-3 mr-1" />
                                          Potential savings: ${(selectedProduct.price - field.value).toFixed(2)} 
                                          ({Math.round((1 - field.value/selectedProduct.price) * 100)}% off)
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </FormItem>
                            )}
                          />
                        ) : (
                          <FormField
                            control={trackForm.control}
                            name="percentageThreshold"
                            render={({ field }) => (
                              <FormItem>
                                <div className="space-y-4">
                                  <div className="mb-2">
                                    <FormLabel className="text-base font-medium mb-2 inline-flex items-center">
                                      <Percent className="h-4 w-4 mr-1 text-primary" />
                                      Price Drop Percentage
                                    </FormLabel>
                                    <p className="text-xs text-muted-foreground">
                                      Select how much the price needs to drop before we alert you
                                    </p>
                                  </div>

                                  {/* Current price display and preview calculation */}
                                  {selectedProduct?.price && typeof selectedProduct.price === 'number' && (
                                    <div className="bg-primary/5 p-3 rounded-lg border border-primary/10 mb-4">
                                      <div className="flex items-center text-sm font-medium">
                                        <span>Current price: </span>
                                        <span className="font-bold text-primary ml-1">${selectedProduct.price.toFixed(2)}</span>
                                      </div>

                                      {field.value !== undefined && field.value !== null && field.value > 0 && (
                                        <div className="mt-2 pt-2 border-t border-primary/10">
                                          <div className="flex items-center text-sm">
                                            <ArrowDown className="h-4 w-4 mr-1 text-green-600" />
                                            <span>
                                              Alert at: <strong className="text-green-600">${(selectedProduct.price * (1 - field.value / 100)).toFixed(2)}</strong> 
                                              <span className="text-muted-foreground ml-1">({field.value}% off)</span>
                                            </span>
                                          </div>
                                          <div className="mt-1 text-xs text-muted-foreground">
                                            Potential savings: ${(selectedProduct.price * field.value / 100).toFixed(2)}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Quick selection buttons in a grid */}
                                  <div className="grid grid-cols-3 gap-2">
                                    {[5, 10, 15, 20, 30, 50].map((percent) => (
                                      <Button
                                        key={percent}
                                        type="button"
                                        variant={field.value === percent ? "default" : "outline"}
                                        className={`${field.value === percent ? "bg-primary hover:bg-primary/90 border-2 border-primary" : "border border-input"} h-12`}
                                        onClick={() => field.onChange(percent)}
                                      >
                                        <span className="text-lg font-semibold">{percent}%</span>
                                      </Button>
                                    ))}
                                  </div>

                                  {/* Custom percentage input - acts as an alternative to buttons */}
                                  <div className="pt-3 border-t">
                                    <div className="flex justify-between mb-2">
                                      <FormLabel className="text-sm">
                                        Or enter a custom percentage:
                                      </FormLabel>
                                      {field.value !== undefined && field.value !== null && field.value > 0 && (
                                        <Button 
                                          type="button" 
                                          variant="ghost" 
                                          size="sm" 
                                          className="h-6 text-xs text-muted-foreground"
                                          onClick={() => field.onChange(0)}
                                        >
                                          Clear
                                        </Button>
                                      )}
                                    </div>
                                    <FormControl>
                                      <div className="flex items-center relative">
                                        <Input
                                          type="text"
                                          inputMode="decimal"
                                          className="text-right pr-10 text-lg h-12"
                                          placeholder="Enter custom %"
                                          {...field}
                                          value={field.value !== undefined && field.value !== null ? field.value : ""}
                                          onChange={(e) => {
                                            // Allow decimal percentages for more precise alerts
                                            const value = e.target.value;
                                            // Allow empty input, single decimal point, or valid decimal number
                                            if (value === '' || value === '.' || /^\d*\.?\d*$/.test(value)) {
                                              const numValue = value === '' || value === '.' ? 0 : parseFloat(value);
                                              // Ensure the percentage is between 0.1 and 99
                                              if (value === '' || value === '.' || isNaN(numValue)) {
                                                field.onChange(0);
                                              } else {
                                                field.onChange(Math.min(99, Math.max(0.1, numValue)));
                                              }
                                            }
                                          }}
                                          disabled={trackMutation.isPending}
                                        />
                                        <div className="absolute right-3 pointer-events-none">
                                          <span className="text-lg">%</span>
                                        </div>
                                      </div>
                                    </FormControl>
                                  </div>

                                  <FormMessage />

                                  {/* Remove the redundant preview box since we already have one above */}
                                </div>
                              </FormItem>
                            )}
                          />
                        )}

                        {/* Email field completely removed for authenticated users */}

                        <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg mt-6 mb-4">
                          <div className="flex items-center mb-3">
                            <Bell className="h-5 w-5 mr-2 text-primary" />
                            <span className="font-semibold text-base">Price Alert Summary</span>
                          </div>

                          <div className="p-3 bg-white rounded-md border border-gray-100">
                            {selectedProduct?.price && typeof selectedProduct.price === 'number' ? (
                              <div className="space-y-3">
                                {/* Fixed price alert summary */}
                                <div className="flex items-center">
                                  <DollarSign className="h-5 w-5 mr-2 text-primary" />
                                  <div>
                                    <div className="font-medium">Price alert</div>
                                    <div className="text-xs text-muted-foreground mt-0.5">Current price: ${selectedProduct.price.toFixed(2)}</div>
                                  </div>
                                </div>

                                <div className="bg-blue-50 p-2 rounded-md border border-blue-100">
                                  <div className="flex">
                                    <div className="flex-shrink-0 mr-2">
                                      <DollarSign className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium mb-1 text-slate-800">
                                        Target price: <strong className="text-blue-700">${trackForm.watch("targetPrice") || 0}</strong>
                                      </p>
                                      {trackForm.watch("targetPrice") > 0 ? (
                                        trackForm.watch("targetPrice") < selectedProduct.price ? (
                                          <p className="text-xs flex items-center text-slate-600">
                                            <span className="mr-1">Potential savings:</span>
                                            <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                                              ${(selectedProduct.price - trackForm.watch("targetPrice")).toFixed(2)} ({Math.round((1 - trackForm.watch("targetPrice")/selectedProduct.price) * 100)}% off)
                                            </span>
                                          </p>
                                        ) : (
                                          <p className="text-xs text-amber-600">
                                            Target price is above current price
                                          </p>
                                        )
                                      ) : (
                                        <p className="text-xs text-orange-600">
                                          Please enter a target price
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="text-center p-3 text-muted-foreground text-sm">
                                <div className="mb-2 opacity-70">
                                  <Bell className="h-5 w-5 mx-auto mb-1" />
                                </div>
                                Select a product to see your alert summary
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Price History Chart for informed decision making */}
                        {selectedProduct?.id && (
                          <div className="mt-6 mb-6 border rounded-lg p-4 bg-slate-50">
                            <div className="flex items-center mb-3">
                              <TrendingDown className="h-5 w-5 mr-2 text-primary" />
                              <h3 className="text-lg font-semibold">Price History</h3>
                            </div>
                            <p className="text-sm text-muted-foreground mb-4">
                              Review the price history below to help set a reasonable target price or percentage alert
                            </p>
                            <PriceHistoryChart productId={selectedProduct.id} />

                            {/* Price stats and recommendations */}
                            <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-200">
                              <div className="px-3 py-2 bg-white rounded-md border border-slate-200">
                                <p className="text-xs text-muted-foreground mb-1">Lowest Recorded Price</p>
                                <p className="text-base font-semibold text-green-600">
                                  ${selectedProduct?.lowestPrice ? selectedProduct.lowestPrice.toFixed(2) : "N/A"}
                                </p>
                              </div>
                              <div className="px-3 py-2 bg-white rounded-md border border-slate-200">
                                <p className="text-xs text-muted-foreground mb-1">Highest Recorded Price</p>
                                <p className="text-base font-semibold text-red-500">
                                  ${selectedProduct?.highestPrice ? selectedProduct.highestPrice.toFixed(2) : "N/A"}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        <Button
                          type="submit"
                          className="w-full mt-6"
                          size="lg"
                          disabled={trackMutation.isPending}
                          variant="default"
                        >
                          {trackMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                              Setting up tracking...
                            </>
                          ) : (
                            <>
                              <Bell className="mr-2 h-5 w-5" />
                              Track Price
                            </>
                          )}
                        </Button>
                      </form>
                    </Form>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}