import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Loader2, ArrowLeft, RefreshCw, Bell } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import PriceHistoryChart from "@/components/price-history-chart";
import { TrackingFormData, trackingFormSchema } from "@shared/schema";

type Product = {
  id: number;
  asin: string;
  title: string;
  url: string;
  imageUrl: string | null;
  currentPrice: number;
  originalPrice: number | null;
  lowestPrice: number;
  highestPrice: number;
  lastChecked: string;
  affiliateUrl: string;
};

type TrackedProduct = {
  id: number;
  userId: number | null;
  email: string;
  productId: number;
  targetPrice: number;
  notified: boolean;
  createdAt: string;
  product: Product;
};

export default function ProductDetailsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { id } = useParams<{ id: string }>();
  const productId = parseInt(id);
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [showTrackingForm, setShowTrackingForm] = useState(false);

  // Format price as currency
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(price);
  };

  // Format discount percentage
  const calculateDiscount = (originalPrice: number, currentPrice: number) => {
    if (!originalPrice || originalPrice <= currentPrice) return null;
    const discount = ((originalPrice - currentPrice) / originalPrice) * 100;
    return discount.toFixed(0) + "%";
  };

  // Get product details
  const {
    data: product,
    isLoading: isProductLoading,
    error: productError,
    refetch: refetchProduct,
  } = useQuery<Product>({
    queryKey: [`/api/products/${productId}`],
    enabled: !isNaN(productId),
  });

  // Get tracked product (if the user is tracking this product)
  const {
    data: trackedProduct,
    isLoading: isTrackedProductLoading,
    refetch: refetchTrackedProduct,
  } = useQuery<TrackedProduct>({
    queryKey: [
      isAuthenticated ? `/api/my/tracked-products` : `/api/tracked-products`,
      isAuthenticated ? null : user?.email,
      productId,
    ],
    enabled: !isNaN(productId) && (isAuthenticated || !!user?.email),
    select: (data: TrackedProduct[]) =>
      data.find((tp) => tp.productId === productId),
  });

  // Form for setting target price
  const form = useForm<TrackingFormData>({
    resolver: zodResolver(trackingFormSchema),
    defaultValues: {
      productUrl: "",
      targetPrice: 0,
      email: user?.email || "",
    },
  });

  // Update form values when product is loaded
  useState(() => {
    if (product) {
      form.setValue("productUrl", product.url);
      form.setValue("targetPrice", product.currentPrice * 0.9); // Default to 10% off
    }
    if (user?.email) {
      form.setValue("email", user.email);
    }
  });

  // Refresh product price
  const refreshMutation = useMutation({
    mutationFn: async () => {
      if (!product) throw new Error("Product not found");

      const endpoint = trackedProduct
        ? isAuthenticated
          ? `/api/my/refresh-price/${trackedProduct.id}`
          : `/api/refresh-price/${trackedProduct.id}`
        : null;

      if (!endpoint) throw new Error("Product not being tracked");

      const res = await apiRequest("POST", endpoint);
      if (!res.ok) {
        throw new Error("Failed to refresh price");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Price updated",
        description: "The product price has been refreshed",
      });
      refetchProduct();
      refetchTrackedProduct();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to refresh price",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Track product (or update existing tracking)
  const trackMutation = useMutation({
    mutationFn: async (data: TrackingFormData) => {
      if (trackedProduct) {
        // Update existing tracking
        const endpoint = isAuthenticated
          ? `/api/my/tracked-products/${trackedProduct.id}`
          : `/api/tracked-products/${trackedProduct.id}`;

        const res = await apiRequest("PATCH", endpoint, {
          targetPrice: data.targetPrice,
        });

        if (!res.ok) {
          throw new Error("Failed to update tracking");
        }
        return res.json();
      } else {
        // Create new tracking
        const endpoint = isAuthenticated ? "/api/my/track" : "/api/track";
        const res = await apiRequest("POST", endpoint, data);
        
        if (!res.ok) {
          throw new Error("Failed to track product");
        }
        return res.json();
      }
    },
    onSuccess: () => {
      // Create a more descriptive success message
      const priceFormatted = formatPrice(targetPrice);
      const productTitle = product.title.substring(0, 40) + (product.title.length > 40 ? '...' : '');
      
      toast({
        title: "✅ Price tracking confirmed!",
        description: (
          <div className="space-y-2">
            <p><strong>Product:</strong> {productTitle}</p>
            <p><strong>Target Price:</strong> {priceFormatted}</p>
            <p><strong>Email:</strong> {email || user?.email}</p>
            <p className="text-sm text-muted-foreground">We'll email you when the price drops below your target.</p>
          </div>
        ),
        duration: 7000,
      });
      setShowTrackingForm(false);
      refetchTrackedProduct();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to track product",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete tracking
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!trackedProduct) throw new Error("Product not tracked");

      const endpoint = isAuthenticated
        ? `/api/my/tracked-products/${trackedProduct.id}`
        : `/api/tracked-products/${trackedProduct.id}`;

      const res = await apiRequest("DELETE", endpoint);
      if (!res.ok) {
        throw new Error("Failed to delete tracking");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Tracking removed",
        description: "You are no longer tracking this product",
      });
      refetchTrackedProduct();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to remove tracking",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: TrackingFormData) => {
    trackMutation.mutate(data);
  };

  if (isProductLoading || isAuthLoading) {
    return (
      <div className="container max-w-4xl py-8">
        <div className="flex items-center justify-center h-60">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container max-w-4xl py-8">
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => setLocation("/")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Card>
          <CardContent className="py-10">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">Product Not Found</h2>
              <p className="text-muted-foreground">
                The product you're looking for doesn't exist or has been removed.
              </p>
              <Button
                className="mt-6"
                onClick={() => setLocation("/")}
              >
                Return to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const discount = product.originalPrice
    ? calculateDiscount(product.originalPrice, product.currentPrice)
    : null;

  return (
    <div className="container max-w-4xl py-8">
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => setLocation("/")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Product Details Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-6">
                {/* Product Image */}
                <div className="flex-shrink-0 flex justify-center">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.title}
                      className="max-w-[150px] max-h-[150px] object-contain"
                    />
                  ) : (
                    <div className="w-[150px] h-[150px] bg-muted flex items-center justify-center">
                      <span className="text-muted-foreground">No Image</span>
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <div className="flex-1">
                  <h1 className="text-xl font-semibold mb-2">
                    {product.title}
                  </h1>
                  
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-2xl font-bold text-primary">
                      {formatPrice(product.currentPrice)}
                    </span>
                    
                    {product.originalPrice && product.originalPrice > product.currentPrice && (
                      <>
                        <span className="text-md line-through text-muted-foreground">
                          {formatPrice(product.originalPrice)}
                        </span>
                        
                        {discount && (
                          <Badge className="bg-green-600 hover:bg-green-700">
                            {discount} OFF
                          </Badge>
                        )}
                      </>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">ASIN:</span>
                      <span>{product.asin}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Last checked:</span>
                      <span>
                        {format(new Date(product.lastChecked), "MMM d, yyyy 'at' h:mm a")}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Lowest price:</span>
                      <span className="text-green-600 font-medium">
                        {formatPrice(product.lowestPrice)}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Highest price:</span>
                      <span className="text-red-600 font-medium">
                        {formatPrice(product.highestPrice)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button asChild>
                      <a
                        href={product.affiliateUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View on Amazon
                      </a>
                    </Button>
                    
                    {trackedProduct ? (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => refreshMutation.mutate()}
                          disabled={refreshMutation.isPending}
                        >
                          {refreshMutation.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="mr-2 h-4 w-4" />
                          )}
                          Refresh Price
                        </Button>
                        
                        <Button
                          variant={showTrackingForm ? "secondary" : "outline"}
                          onClick={() => setShowTrackingForm(!showTrackingForm)}
                        >
                          <Bell className="mr-2 h-4 w-4" />
                          {showTrackingForm
                            ? "Cancel"
                            : "Update Target Price"}
                        </Button>
                        
                        <Button
                          variant="outline"
                          onClick={() => deleteMutation.mutate()}
                          disabled={deleteMutation.isPending}
                          className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          {deleteMutation.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            "Stop Tracking"
                          )}
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant={showTrackingForm ? "secondary" : "outline"}
                        onClick={() => setShowTrackingForm(!showTrackingForm)}
                      >
                        <Bell className="mr-2 h-4 w-4" />
                        {showTrackingForm
                          ? "Cancel"
                          : "Track Price"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Price Tracking Form */}
              {showTrackingForm && (
                <div className="mt-6 pt-6 border-t">
                  <h3 className="text-lg font-medium mb-4">
                    {trackedProduct ? "Update Price Alert" : "Set Price Alert"}
                  </h3>
                  
                  <Form {...form}>
                    <form
                      onSubmit={form.handleSubmit(onSubmit)}
                      className="space-y-4"
                    >
                      <FormField
                        control={form.control}
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
                                defaultValue={
                                  trackedProduct
                                    ? trackedProduct.targetPrice
                                    : product.currentPrice * 0.9
                                }
                                disabled={trackMutation.isPending}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {!isAuthenticated && (
                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  type="email"
                                  placeholder="Your Email"
                                  {...field}
                                  disabled={trackMutation.isPending}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      <div className="flex justify-end">
                        <Button
                          type="submit"
                          disabled={trackMutation.isPending}
                        >
                          {trackMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              {trackedProduct
                                ? "Updating..."
                                : "Setting up..."}
                            </>
                          ) : (
                            <>
                              {trackedProduct
                                ? "Update Target Price"
                                : "Set Price Alert"}
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Price History Chart */}
          <PriceHistoryChart productId={productId} />
        </div>

        {/* Tracking Status Card */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Tracking Status</CardTitle>
            </CardHeader>
            <CardContent>
              {isTrackedProductLoading ? (
                <div className="py-4 flex justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : trackedProduct ? (
                <div className="space-y-4">
                  <div className="bg-primary/10 rounded-md p-4 text-center">
                    <h3 className="font-semibold mb-1">Target Price</h3>
                    <p className="text-2xl font-bold text-primary">
                      {formatPrice(trackedProduct.targetPrice)}
                    </p>
                    
                    {product.currentPrice <= trackedProduct.targetPrice ? (
                      <Badge className="mt-2 bg-green-600">
                        Price target reached!
                      </Badge>
                    ) : (
                      <p className="text-sm mt-2 text-muted-foreground">
                        {formatPrice(product.currentPrice - trackedProduct.targetPrice)}{" "}
                        to go ({(((product.currentPrice - trackedProduct.targetPrice) / product.currentPrice) * 100).toFixed(0)}% drop needed)
                      </p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <span className="font-medium">
                        {product.currentPrice <= trackedProduct.targetPrice
                          ? "Target reached"
                          : "Waiting for price drop"}
                      </span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tracking since:</span>
                      <span>
                        {format(new Date(trackedProduct.createdAt), "MMM d, yyyy")}
                      </span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Notification sent:
                      </span>
                      <span>{trackedProduct.notified ? "Yes" : "No"}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground mb-4">
                    You're not tracking this product yet.
                  </p>
                  <Button onClick={() => setShowTrackingForm(true)}>
                    <Bell className="mr-2 h-4 w-4" />
                    Start Tracking
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}