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

    toast({
      title: "Processing tracking request...",
      description: "Setting up price tracking for this product.",
    });

    try {
      if (!selectedProduct) {
        toast({
          title: "No product selected",
          description: "Please select a product to track",
          variant: "destructive",
        });
        return;
      }

      // Create simplified tracking data
      const trackingData = {
        productUrl: selectedProduct.url,
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
      let successMessage = `We'll notify you when ${selectedProduct.title.substring(0, 30)}... drops below $${data.targetPrice.toFixed(2)}.`;

      toast({
        title: "✅ Price tracking activated!",
        description: successMessage,
        duration: 5000,
      });

      // Refresh tracked products data
      queryClient.invalidateQueries({ queryKey: ["/api/tracked-products"] });
      if (isAuthenticated) {
        queryClient.invalidateQueries({ queryKey: ["/api/my/tracked-products"] });
      }

      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }

      // Scroll to the dashboard
      setTimeout(() => {
        document.getElementById('dashboard')?.scrollIntoView({ behavior: 'smooth' });
      }, 800);
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
              <div className="space-y-4">
                <form
                  onSubmit={trackForm.handleSubmit(onTrackSubmit)}
                  className="space-y-4"
                >
                  <div className="space-y-1">
                    <Label htmlFor="productUrl">
                      Product URL or ASIN
                    </Label>
                    <Input
                      id="productUrl"
                      placeholder="Amazon URL or ASIN"
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
                    disabled={!productData || trackForm.formState.isSubmitting}
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Search by Product Name Tab */}
        <TabsContent value="name">
          <Card>
            <CardHeader>
              <CardTitle>Search & Track Products</CardTitle>
              <CardDescription>
                Search for Amazon products by name
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search for products..."
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
                    <div className="space-y-3">
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

                {selectedProduct && (
                  <div className="mt-6 border-t pt-4" id="selected-product-form">
                    <h3 className="font-medium mb-3">Track Selected Product</h3>
                    <div className="bg-slate-50 p-3 rounded-md mb-4">
                      <div className="flex items-start gap-3">
                        {selectedProduct.imageUrl && (
                          <img
                            src={selectedProduct.imageUrl}
                            alt={selectedProduct.title}
                            className="w-16 h-16 object-contain"
                          />
                        )}
                        <div>
                          <p className="font-medium text-sm">{selectedProduct.title}</p>
                          {selectedProduct.price && (
                            <p className="text-primary font-semibold mt-1">
                              ${selectedProduct.price.toFixed(2)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    
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
        </TabsContent>
      </Tabs>
    </div>
  );
}