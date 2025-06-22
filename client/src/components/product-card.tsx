import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from "./ui/dialog";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { TrackedProductWithDetails, Product } from "@shared/schema";

// Extended product type to include optional affiliateUrl
interface ProductWithAffiliate extends Product {
  affiliateUrl?: string;
}

interface ProductCardProps {
  trackedProduct: TrackedProductWithDetails;
  onRefresh: () => void;
  isAuthenticated: boolean;
}

const ProductCard: React.FC<ProductCardProps> = ({ trackedProduct, onRefresh, isAuthenticated }) => {
  const { toast } = useToast();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [newTargetPrice, setNewTargetPrice] = useState(trackedProduct.targetPrice.toString());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Cast the product to our extended type that includes affiliateUrl
  const product = trackedProduct.product as ProductWithAffiliate;

  // Calculate price difference percentage
  const percentOff = product.originalPrice 
    ? Math.round(((product.originalPrice - product.currentPrice) / product.originalPrice) * 100) 
    : 0;

  // Determine badge status
  let badgeText = "Monitoring";
  let badgeVariant: "success" | "monitoring" | "priceDropped" = "monitoring";

  if (product.currentPrice <= trackedProduct.targetPrice) {
    badgeText = "Target Reached!";
    badgeVariant = "success";
  } else if (product.originalPrice && product.currentPrice < product.originalPrice) {
    badgeText = "Price Dropped";
    badgeVariant = "priceDropped";
  }

  // Format last checked time
  const formatLastChecked = (date: Date) => {
    const now = new Date();
    const lastChecked = new Date(date);
    const diffMs = now.getTime() - lastChecked.getTime();
    const diffMins = Math.round(diffMs / 60000);

    if (diffMins < 60) {
      return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diffMins < 1440) {
      const hours = Math.floor(diffMins / 60);
      return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    } else {
      const days = Math.floor(diffMins / 1440);
      return `${days} ${days === 1 ? 'day' : 'days'} ago`;
    }
  };

  // Update target price mutation
  const updateTargetPriceMutation = useMutation({
    mutationFn: async (newPrice: number) => {
      const endpoint = trackedProduct.userId 
        ? `/api/my/tracked-products/${trackedProduct.id}`
        : `/api/tracked-products/${trackedProduct.id}?email=${encodeURIComponent(trackedProduct.email)}`;

      const res = await apiRequest("PATCH", endpoint, { targetPrice: newPrice });
      return await res.json();
    },
    onSuccess: () => {
      setShowEditDialog(false);
      setNewTargetPrice(trackedProduct.targetPrice.toString());

      // Use a timeout to ensure state updates don't interfere with auth
      setTimeout(() => {
        // Invalidate both possible query keys
        queryClient.invalidateQueries({ queryKey: ['/api/tracked-products'] });
        queryClient.invalidateQueries({ queryKey: ['/api/my/tracked-products'] });
      }, 100);

      toast({
        title: "Target price updated",
        description: `New target price: $${parseFloat(newTargetPrice).toFixed(2)}`,
      });
    },
    onError: (error: any) => {
      console.error("Update target price error:", error);

      // Handle authentication errors gracefully
      if (error?.status === 401) {
        toast({
          title: "Session expired",
          description: "Please refresh the page and try again.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Failed to update target price",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  // Refresh price mutation
  const refreshPriceMutation = useMutation({
    mutationFn: async () => {
      console.log(`Refreshing price for tracked product with ID: ${trackedProduct.id}`);
      return apiRequest("POST", `/api/my/refresh-price/${trackedProduct.id}`, {});
    },
    onSuccess: () => {
      toast({
        title: "Price refreshed",
        description: "The product price has been updated with the latest data.",
      });
      setIsRefreshing(false);
      queryClient.invalidateQueries({ queryKey: ['/api/tracked-products'] });
    },
    onError: (error) => {
      toast({
        title: "Failed to refresh price",
        description: error instanceof Error ? error.message : "Please try again later",
        variant: "destructive",
      });
      setIsRefreshing(false);
    },
  });

  // Delete tracking mutation
  const deleteTrackingMutation = useMutation({
    mutationFn: async () => {
      console.log(`Deleting tracked product with ID: ${trackedProduct.id}`);

      // Determine which endpoint to use based on whether we have a userId
      const hasUserId = !!trackedProduct.userId;

      // Make sure we have a valid email for non-authenticated users
      const email = trackedProduct.email || '';

      let url = hasUserId 
        ? `/api/my/tracked-products/${trackedProduct.id}`
        : `/api/tracked-products/${trackedProduct.id}?email=${encodeURIComponent(email)}`;

      console.log(`Using delete endpoint: ${url}`);
      console.log(`Product data for deletion:`, {
        id: trackedProduct.id,
        email: email,
        hasUserId: hasUserId
      });

      // Include credentials to ensure the auth cookie is sent
      const res = await fetch(url, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Delete API error response:", errorText);
        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(errorJson.error || errorJson.message || "Failed to delete product");
        } catch (e) {
          throw new Error(errorText || "Failed to delete product");
        }
      }

      return res;
    },
    onSuccess: () => {
      // Show confirmation toast
      toast({
        title: "Product removed from tracking ✓",
        description: "You'll no longer receive price alerts for this product.",
      });

      setIsDeleting(false);
      setShowDeleteConfirm(false);

      console.log("Product deleted, invalidating queries");

      // Reset the cache completely for tracked products
      queryClient.resetQueries({ queryKey: ['/api/tracked-products'] });

      // Force an immediate refetch of the tracked products
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ['/api/tracked-products'] });

        // Force re-render any components using the data
        document.dispatchEvent(new CustomEvent('product-deleted'));

        // Also trigger the parent's refresh callback
        onRefresh();
      }, 300);
    },
    onError: (error) => {
      toast({
        title: "Failed to remove tracking",
        description: error instanceof Error ? error.message : "Please try again later",
        variant: "destructive",
      });
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    },
  });

  const handleEditClick = () => {
    console.log('Edit button clicked');
    setShowEditDialog(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(newTargetPrice);
    if (isNaN(price) || price <= 0) {
      toast({
        title: "Invalid price",
        description: "Please enter a valid price greater than zero.",
        variant: "destructive",
      });
      return;
    }
    updateTargetPriceMutation.mutate(price);
  };

  const handleRefreshPrice = () => {
    setIsRefreshing(true);
    refreshPriceMutation.mutate();
  };

  const handleDeleteTracking = () => {
    setIsDeleting(true);
    deleteTrackingMutation.mutate();
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
        <div className="p-5 border-b border-gray-100">
          <div className="flex justify-between items-start">
            <div className="flex-1 pr-4">
              <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">{product.title}</h3>
              <p className="text-sm text-gray-500 mt-1">ASIN: {product.asin}</p>
            </div>
            <div className="flex flex-col gap-1 items-end">
              {percentOff > 0 && (
                <Badge variant="destructive" className="text-xs font-medium">
                  {percentOff}% OFF
                </Badge>
              )}
              {product.currentPrice < 10 ? (
                <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 border-green-300">
                  UNDER $10
                </Badge>
              ) : percentOff > 0 ? (
                <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 border-blue-300">
                  GREAT VALUE
                </Badge>
              ) : (
                <Badge variant={badgeVariant} className="text-xs">
                  {badgeText}
                </Badge>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center">
            {product.imageUrl && (
              <img 
                src={product.imageUrl} 
                alt={product.title} 
                className="w-24 h-24 object-cover rounded-md"
              />
            )}
            <div className="ml-4">
              <div className="flex items-baseline">
                <span className="text-2xl font-bold text-gray-900">${product.currentPrice.toFixed(2)}</span>
                {product.originalPrice && (
                  <span className="ml-2 text-sm line-through text-gray-500">${product.originalPrice.toFixed(2)}</span>
                )}
              </div>
              <div className="mt-1">
                <p className="text-sm text-gray-600">Your target: <span className="font-medium">${trackedProduct.targetPrice.toFixed(2)}</span></p>
                <p className="text-xs text-gray-500 mt-1">Last checked: {formatLastChecked(new Date(product.lastChecked))}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 bg-gray-50 flex items-center justify-between">
          <a 
            href={product.affiliateUrl || product.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-1.5 rounded-md text-sm font-medium flex items-center transition-colors border border-amber-200"
          >
            View on Amazon 
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="12" 
              height="12" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="ml-1.5"
            >
              <path d="M7 7h10v10" />
              <path d="M7 17 17 7" />
            </svg>
          </a>
          <div className="flex space-x-2">
            {isAuthenticated ? (
              <>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={handleEditClick}
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
                        >
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                          <path d="m15 5 4 4" />
                        </svg>
                        <span className="sr-only">Edit tracking</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Edit target price</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={handleRefreshPrice}
                        disabled={isRefreshing}
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
                          className={isRefreshing ? "animate-spin" : ""}
                        >
                          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                          <path d="M3 3v5h5" />
                          <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                          <path d="M16 16h5v5" />
                        </svg>
                        <span className="sr-only">Refresh price</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Refresh price</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive"
                        onClick={() => setShowDeleteConfirm(true)}
                        disabled={isDeleting}
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
                        >
                          <path d="M3 6h18" />
                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                          <line x1="10" x2="10" y1="11" y2="17" />
                          <line x1="14" x2="14" y1="11" y2="17" />
                        </svg>
                        <span className="sr-only">Remove tracking</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Remove from tracking</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => window.location.href = '/auth'}
                      className="text-xs"
                    >
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        width="14" 
                        height="14" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                        className="mr-1"
                      >
                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                        <polyline points="10,17 15,12 10,7" />
                        <line x1="15" x2="3" y1="12" y2="12" />
                      </svg>
                      Register
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Register to edit and manage tracking</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </div>

      {/* Edit Target Price Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Target Price</DialogTitle>
            <DialogDescription>
              Update your target price for "{product.title}"
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="targetPrice">Target Price ($)</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">$</span>
                  </div>
                  <Input
                    id="targetPrice"
                    className="pl-7"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={newTargetPrice}
                    onChange={(e) => setNewTargetPrice(e.target.value)}
                  />
                </div>
                <p className="text-xs text-gray-500">Current price: ${product.currentPrice.toFixed(2)}</p>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit">Update Target Price</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Product Tracking</DialogTitle>
            <DialogDescription>
              Are you sure you want to stop tracking this product? You'll no longer receive price alerts.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-gray-50 p-3 rounded-md">
              <p className="font-medium text-sm">{product.title}</p>
              <p className="text-sm text-gray-500">Target price: ${trackedProduct.targetPrice.toFixed(2)}</p>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button 
              variant="destructive" 
              onClick={handleDeleteTracking}
              disabled={isDeleting}
            >
              {isDeleting ? "Removing..." : "Remove Tracking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProductCard;