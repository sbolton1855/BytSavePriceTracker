import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Search, Link, ChevronRight, ArrowDown, Bell, Percent, DollarSign, TrendingDown } from "lucide-react";

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
import PriceHistoryChart from "@/components/price-history-chart";

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
      const res = await apiRequest("POST", "/api/my/track", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to track product");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Product tracking set up",
        description: "We'll notify you when the price drops below your target.",
        duration: 5000,
      });
      
      // Reset forms
      trackForm.reset();
      searchForm.reset();
      setSelectedProduct(null);
      
      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error: Error) => {
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
    // For percentage-based alerts, calculate the target price if we have a current price
    if (data.percentageAlert && selectedProduct?.price && data.percentageThreshold) {
      const calculatedPrice = selectedProduct.price * (1 - data.percentageThreshold / 100);
      // Round to 2 decimal places
      data.targetPrice = Math.round(calculatedPrice * 100) / 100;
    }
    
    // Always ensure we use the user's email if they're authenticated
    if (isAuthenticated && user?.email) {
      data.email = user.email;
    } else if (!data.email || data.email.trim() === '') {
      toast({
        title: "Email required",
        description: "Please provide an email address for price drop notifications",
        variant: "destructive",
      });
      return;
    }
    
    trackMutation.mutate(data);
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
                      
                      {/* Display price history if product has an ID */}
                      {productData.id && (
                        <div className="mt-4 bg-white p-4 rounded-md border">
                          <h3 className="text-sm font-medium mb-2">Price History</h3>
                          <PriceHistoryChart productId={productData.id} />
                        </div>
                      )}
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

                  {!isAuthenticated && (
                    <FormField
                      control={trackForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
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
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

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

                        <div className="mb-6 bg-primary/5 p-4 rounded-lg border border-primary/10">
                          <h3 className="text-base font-medium mb-2">Set Your Price Alert</h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            Choose how you want to be notified when the price drops
                          </p>
                          
                          <FormField
                            control={trackForm.control}
                            name="percentageAlert"
                            render={({ field }) => (
                              <FormItem>
                                <div className="flex flex-col space-y-1.5">
                                  <div className="flex">
                                    <Button
                                      type="button"
                                      variant={field.value ? "outline" : "default"}
                                      className={`flex-1 rounded-r-none text-sm py-6 ${!field.value ? "bg-primary hover:bg-primary/90" : ""}`}
                                      onClick={() => {
                                        field.onChange(false);
                                      }}
                                    >
                                      <div className="flex flex-col items-center">
                                        <DollarSign className="h-5 w-5 mb-1" />
                                        <span>Fixed Price</span>
                                        <span className="text-xs opacity-80 mt-1">
                                          Alert at specific price
                                        </span>
                                      </div>
                                    </Button>
                                    <Button
                                      type="button"
                                      variant={field.value ? "default" : "outline"}
                                      className={`flex-1 rounded-l-none text-sm py-6 ${field.value ? "bg-primary hover:bg-primary/90" : ""}`}
                                      onClick={() => {
                                        field.onChange(true);
                                        // Default to 10% if not set
                                        if (!trackForm.watch("percentageThreshold")) {
                                          trackForm.setValue("percentageThreshold", 10);
                                        }
                                      }}
                                    >
                                      <div className="flex flex-col items-center">
                                        <Percent className="h-5 w-5 mb-1" />
                                        <span>Percentage Drop</span>
                                        <span className="text-xs opacity-80 mt-1">
                                          Alert when price drops by %
                                        </span>
                                      </div>
                                    </Button>
                                  </div>
                                </div>
                              </FormItem>
                            )}
                          />
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
                                        value={field.value > 0 ? field.value.toString() : ''}
                                        onChange={(e) => {
                                          // Remove leading zeros and allow only valid price format
                                          const value = e.target.value.replace(/^0+(?=\d)/, '');
                                          const price = parseFloat(value);
                                          field.onChange(isNaN(price) ? 0 : price);
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
                                      {field.value > 0 && field.value < selectedProduct.price && (
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
                                      
                                      {field.value && field.value > 0 && (
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
                                  
                                  {/* Custom percentage input */}
                                  <div className="pt-3 border-t">
                                    <FormLabel className="text-sm mb-2 block">
                                      Or enter a custom percentage:
                                    </FormLabel>
                                    <FormControl>
                                      <div className="flex items-center relative">
                                        <Input
                                          type="number"
                                          inputMode="numeric"
                                          min={1}
                                          max={99}
                                          className="text-right pr-10 text-lg h-12"
                                          placeholder="0"
                                          {...field}
                                          value={field.value || ""}
                                          onChange={(e) => {
                                            const value = parseInt(e.target.value);
                                            field.onChange(isNaN(value) ? 5 : Math.min(99, Math.max(1, value)));
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
                              trackForm.watch("percentageAlert") ? (
                                <div className="space-y-3">
                                  {/* Percentage alert summary */}
                                  <div className="flex items-center">
                                    <Percent className="h-5 w-5 mr-2 text-primary" />
                                    <div>
                                      <div className="font-medium">Percentage-based alert</div>
                                      <div className="text-xs text-muted-foreground mt-0.5">Current price: ${selectedProduct.price ? selectedProduct.price.toFixed(2) : "0.00"}</div>
                                    </div>
                                  </div>
                                  
                                  <div className="bg-green-50 p-2 rounded-md border border-green-100">
                                    <div className="flex">
                                      <div className="flex-shrink-0 mr-2">
                                        <ArrowDown className="h-5 w-5 text-green-600" />
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium mb-1 text-slate-800">
                                          {trackForm.watch("percentageThreshold") || 0}% price drop alert
                                        </p>
                                        {(trackForm.watch("percentageThreshold") || 0) > 0 ? (
                                          <p className="text-xs text-slate-600">
                                            You'll be notified when price drops below <strong className="text-green-700">${selectedProduct.price ? (selectedProduct.price * (1 - (trackForm.watch("percentageThreshold") || 0) / 100)).toFixed(2) : "0.00"}</strong>
                                          </p>
                                        ) : (
                                          <p className="text-xs text-orange-600">
                                            Please select a percentage drop value
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  {/* Fixed price alert summary */}
                                  <div className="flex items-center">
                                    <DollarSign className="h-5 w-5 mr-2 text-primary" />
                                    <div>
                                      <div className="font-medium">Fixed price alert</div>
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
                                          Exact price alert: <strong className="text-blue-700">${trackForm.watch("targetPrice") || 0}</strong>
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
                              )
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
                                  ${selectedProduct.lowestPrice ? selectedProduct.lowestPrice.toFixed(2) : "N/A"}
                                </p>
                              </div>
                              <div className="px-3 py-2 bg-white rounded-md border border-slate-200">
                                <p className="text-xs text-muted-foreground mb-1">Highest Recorded Price</p>
                                <p className="text-base font-semibold text-red-500">
                                  ${selectedProduct.highestPrice ? selectedProduct.highestPrice.toFixed(2) : "N/A"}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        <Button
                          type="submit"
                          className="w-full mt-4"
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