import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Link, ChevronRight, ArrowDown, Bell, Percent, DollarSign } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
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
};

export default function ProductSearch({ 
  onSuccess 
}: { 
  onSuccess?: () => void 
}) {
  const { toast } = useToast();
  const [searchTab, setSearchTab] = useState<string>("url");
  const [selectedProduct, setSelectedProduct] = useState<ProductSearchResult | null>(null);
  const [email, setEmail] = useState<string>("");
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
      email: "",
      percentageAlert: false,
      percentageThreshold: 10, // Default 10% discount
    },
  });
  
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
    queryKey: ["/api/products/search", debouncedSearchQuery],
    queryFn: async () => {
      if (!debouncedSearchQuery || debouncedSearchQuery.length < 3) {
        return [];
      }
      
      const res = await fetch(
        `/api/products/search?q=${encodeURIComponent(debouncedSearchQuery)}`
      );
      if (!res.ok) {
        throw new Error("Failed to search products");
      }
      return res.json();
    },
    enabled: debouncedSearchQuery.length >= 3 && searchTab === "name",
  });
  
  // Product tracking mutation
  const trackMutation = useMutation({
    mutationFn: async (data: TrackingFormData) => {
      const res = await apiRequest("POST", "/api/track", data);
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
    trackMutation.mutate(data);
  };
  
  // Set product URL and email when a search result is selected
  const selectProduct = (product: ProductSearchResult) => {
    setSelectedProduct(product);
    trackForm.setValue("productUrl", product.url);
    
    // Set a default target price 10% below the current price
    if (product.price) {
      const suggestedPrice = Math.round(product.price * 0.9 * 100) / 100; // 10% discount, rounded to 2 decimal places
      trackForm.setValue("targetPrice", suggestedPrice);
    }
    
    if (email) {
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
                            {/* Click indicator badge */}
                            <div className="absolute top-2 right-2 text-xs bg-primary text-white px-2 py-1 rounded-md opacity-80">
                              Click to Track
                            </div>
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

                        <FormField
                          control={trackForm.control}
                          name="percentageAlert"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex flex-col space-y-1.5">
                                <FormLabel>Alert Type</FormLabel>
                                <div className="flex">
                                  <Button
                                    type="button"
                                    variant={field.value ? "outline" : "default"}
                                    className={`flex-1 rounded-r-none ${!field.value ? "bg-primary hover:bg-primary/90" : ""}`}
                                    onClick={() => {
                                      field.onChange(false);
                                    }}
                                  >
                                    <DollarSign className="h-4 w-4 mr-1" />
                                    Fixed Price
                                  </Button>
                                  <Button
                                    type="button"
                                    variant={field.value ? "default" : "outline"}
                                    className={`flex-1 rounded-l-none ${field.value ? "bg-primary hover:bg-primary/90" : ""}`}
                                    onClick={() => {
                                      field.onChange(true);
                                    }}
                                  >
                                    <Percent className="h-4 w-4 mr-1" />
                                    Percentage
                                  </Button>
                                </div>
                              </div>
                            </FormItem>
                          )}
                        />

                        {/* Conditional field based on alert type */}
                        {!trackForm.watch("percentageAlert") ? (
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
                                {selectedProduct.price && (
                                  <FormDescription>
                                    Current price: ${selectedProduct.price.toFixed(2)}
                                  </FormDescription>
                                )}
                              </FormItem>
                            )}
                          />
                        ) : (
                          <FormField
                            control={trackForm.control}
                            name="percentageThreshold"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Price Drop Percentage</FormLabel>
                                <div className="space-y-2">
                                  <div className="flex justify-between">
                                    <div className="flex space-x-2">
                                      {[5, 10, 15, 20, 30].map((percent) => (
                                        <Button
                                          key={percent}
                                          type="button"
                                          size="sm"
                                          variant={field.value === percent ? "default" : "outline"}
                                          className={field.value === percent ? "bg-primary hover:bg-primary/90" : ""}
                                          onClick={() => field.onChange(percent)}
                                        >
                                          {percent}%
                                        </Button>
                                      ))}
                                    </div>
                                  </div>
                                  <FormControl>
                                    <div className="flex items-center space-x-2">
                                      <Input
                                        type="number"
                                        inputMode="numeric"
                                        min={1}
                                        max={99}
                                        placeholder="Custom percentage"
                                        {...field}
                                        value={field.value || ""}
                                        onChange={(e) => {
                                          const value = parseInt(e.target.value);
                                          field.onChange(isNaN(value) ? 5 : Math.min(99, Math.max(1, value)));
                                        }}
                                        disabled={trackMutation.isPending}
                                      />
                                      <span>%</span>
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                  {selectedProduct.price && field.value && (
                                    <FormDescription>
                                      Alert when price drops below ${(selectedProduct.price * (1 - field.value / 100)).toFixed(2)}
                                    </FormDescription>
                                  )}
                                </div>
                              </FormItem>
                            )}
                          />
                        )}

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