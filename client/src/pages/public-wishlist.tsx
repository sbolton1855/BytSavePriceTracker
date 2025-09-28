
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Heart, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  };
  items: WishlistItem[];
};

export default function PublicWishlistPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data: wishlistData, isLoading, error } = useQuery<WishlistData>({
    queryKey: ["/api/wishlist/public", slug],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/wishlist/public/${slug}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("Wishlist not found");
        }
        throw new Error("Failed to fetch wishlist");
      }
      return res.json();
    },
    enabled: !!slug,
  });

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="container max-w-6xl mx-auto py-8 px-4">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
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
      </div>
    );
  }

  if (error) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <Card>
          <CardContent className="p-8 text-center">
            <Heart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold mb-2">Wishlist Not Found</h2>
            <p className="text-muted-foreground mb-6">
              The wishlist you're looking for doesn't exist or has been removed.
            </p>
            <Button onClick={() => window.history.back()} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!wishlistData?.items || wishlistData.items.length === 0) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-6 w-6" />
              Shared Wishlist
            </CardTitle>
            <CardDescription>
              Created on {wishlistData?.wishlist ? formatDate(wishlistData.wishlist.createdAt) : "Unknown"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-center text-muted-foreground py-8">
              This wishlist is empty.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Heart className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Shared Wishlist</h1>
            <p className="text-muted-foreground">
              {wishlistData.items.length} item{wishlistData.items.length !== 1 ? "s" : ""} • 
              Created {formatDate(wishlistData.wishlist.createdAt)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {wishlistData.items.map((item) => (
            <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="aspect-square bg-slate-50 flex items-center justify-center">
                {item.product.imageUrl ? (
                  <img
                    src={item.product.imageUrl}
                    alt={item.product.title}
                    className="object-contain w-full h-full p-4"
                  />
                ) : (
                  <div className="text-slate-400">No image available</div>
                )}
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
    </div>
  );
}
