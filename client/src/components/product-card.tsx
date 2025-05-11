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
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
}

const ProductCard: React.FC<ProductCardProps> = ({ trackedProduct, onRefresh }) => {
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
    mutationFn: async (targetPrice: number) => {
      return apiRequest("PATCH", `/api/tracked-products/${trackedProduct.id}`, { targetPrice });
    },
    onSuccess: () => {
      toast({
        title: "Target price updated",
        description: "We'll notify you when the price drops below your new target.",
      });
      setShowEditDialog(false);
      onRefresh();
    },
    onError: (error) => {
      toast({
        title: "Failed to update target price",
        description: error instanceof Error ? error.message : "Please try again later",
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
      
      // Include credentials to ensure the auth cookie is sent
      const res = await fetch(`/api/my/tracked-products/${trackedProduct.id}`, {
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
            <Badge variant={badgeVariant}>
              {badgeText}
            </Badge>
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
                {percentOff > 0 && (
                  <span className="ml-2 text-xs font-medium text-success-500">-{percentOff}%</span>
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
            className="text-primary-500 hover:text-primary-600 text-sm font-medium"
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
              className="ml-1 inline"
            >
              <path d="M7 7h10v10" />
              <path d="M7 17 17 7" />
            </svg>
          </a>
          <div className="flex space-x-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => setShowEditDialog(true)}
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
