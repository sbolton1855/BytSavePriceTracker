
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, ExternalLink, Copy, Heart } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Skeleton } from "./ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type WishlistItem = {
  id: number;
  wishlistId: number;
  productId: number;
  createdAt: string;
  product: {
    id: number;
    asin: string;
    title: string;
    imageUrl: string | null;
    currentPrice: number;
    originalPrice: number | null;
    affiliateUrl: string;
  };
};

type WishlistData = {
  wishlist: {
    id: number;
    userId: string;
    slug: string;
    createdAt: string;
  } | null;
  items: WishlistItem[];
};

export default function WishlistDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: wishlistData, isLoading, error } = useQuery<WishlistData>({
    queryKey: ["/api/wishlist/mine"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/wishlist/mine");
      if (!res.ok) {
        throw new Error("Failed to fetch wishlist");
      }
      return res.json();
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: async (itemId: number) => {
      const res = await apiRequest("DELETE", `/api/wishlist/remove/${itemId}`);
      if (!res.ok) {
        throw new Error("Failed to remove item");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Item Removed",
        description: "Product has been removed from your wishlist",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/wishlist/mine"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const copyWishlistLink = () => {
    if (wishlistData?.wishlist?.slug) {
      const publicUrl = `${window.location.origin}/wishlist/${wishlistData.wishlist.slug}`;
      navigator.clipboard.writeText(publicUrl);
      toast({
        title: "Link Copied",
        description: "Wishlist link has been copied to clipboard",
      });
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(price);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-40 w-full mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-red-600">Failed to load wishlist</p>
        </CardContent>
      </Card>
    );
  }

  if (!wishlistData?.items || wishlistData.items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5" />
            My Wishlist
          </CardTitle>
          <CardDescription>
            Your wishlist is empty. Start adding products you love!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            Browse products and click the heart icon to add them to your wishlist.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Heart className="h-6 w-6" />
            My Wishlist
          </h2>
          <p className="text-muted-foreground">
            {wishlistData.items.length} item{wishlistData.items.length !== 1 ? "s" : ""}
          </p>
        </div>
        {wishlistData.wishlist && (
          <Button onClick={copyWishlistLink} variant="outline" size="sm">
            <Copy className="h-4 w-4 mr-2" />
            Copy Share Link
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {wishlistData.items.map((item) => (
          <Card key={item.id} className="overflow-hidden">
            <div className="aspect-square bg-slate-50 flex items-center justify-center relative">
              {item.product.imageUrl ? (
                <img
                  src={item.product.imageUrl}
                  alt={item.product.title}
                  className="object-contain w-full h-full p-4"
                />
              ) : (
                <div className="text-slate-400">No image available</div>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                onClick={() => removeItemMutation.mutate(item.id)}
                disabled={removeItemMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <CardContent className="p-4">
              <h3 className="font-medium text-sm line-clamp-2 mb-2">
                {item.product.title}
              </h3>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-lg font-bold text-primary">
                  {formatPrice(item.product.currentPrice)}
                </span>
                {item.product.originalPrice && 
                 item.product.originalPrice > item.product.currentPrice && (
                  <span className="text-sm line-through text-muted-foreground">
                    {formatPrice(item.product.originalPrice)}
                  </span>
                )}
              </div>
              <Button asChild className="w-full" size="sm">
                <a
                  href={item.product.affiliateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Buy on Amazon
                  <ExternalLink className="h-4 w-4 ml-2" />
                </a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
