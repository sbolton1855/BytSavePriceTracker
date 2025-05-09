import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Link, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
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
    queryKey: ["/api/products/search", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 3) {
        return [];
      }
      
      const res = await fetch(
        `/api/products/search?q=${encodeURIComponent(searchQuery)}`
      );
      if (!res.ok) {
        throw new Error("Failed to search products");
      }
      return res.json();
    },
    enabled: searchQuery.length >= 3 && searchTab === "name",
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
    
    if (email) {
      trackForm.setValue("email", email);
    }
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
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            placeholder="Target Price"
                            {...field}
                            onChange={(e) =>
                              field.onChange(parseFloat(e.target.value))
                            }
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
                      <h3 className="text-sm font-medium">Search Results</h3>
                      <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {searchResults.map((product) => (
                          <div
                            key={product.asin}
                            className={`flex items-start border p-3 rounded-md cursor-pointer transition-colors ${
                              selectedProduct?.asin === product.asin
                                ? "border-primary bg-primary/5"
                                : "hover:bg-accent"
                            }`}
                            onClick={() => selectProduct(product)}
                          >
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
                  <div className="mt-6 border-t pt-4">
                    <h3 className="font-medium mb-3">Set Tracking Details</h3>
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
                          name="targetPrice"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0.01"
                                  placeholder="Target Price"
                                  {...field}
                                  onChange={(e) =>
                                    field.onChange(parseFloat(e.target.value))
                                  }
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