import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

export default function ProductSearch({
  onSuccess
}: {
  onSuccess?: () => void
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [targetPrice, setTargetPrice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Search products query
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ["/api/search", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 3) return [];
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: searchQuery.length >= 3
  });

  const handleTrackSubmit = async () => {
    if (!selectedProduct || !targetPrice) {
      toast({
        title: "Missing information",
        description: "Please select a product and set a target price",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productUrl: selectedProduct.url,
          targetPrice: parseFloat(targetPrice),
          email: user?.email || sessionStorage.getItem("bytsave_user_session")
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      const result = await response.json();

      toast({
        title: "✅ Product tracking added!",
        description: `We'll notify you when the price drops below $${targetPrice}`,
        duration: 5000,
      });

      // Reset form
      setSelectedProduct(null);
      setTargetPrice("");
      setSearchQuery("");

      // Refresh tracked products
      queryClient.invalidateQueries({ queryKey: ["/api/tracked-products"] });

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error tracking product:", error);
      toast({
        title: "Failed to track product",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    }

    setIsSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Search for Products</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search for products by name..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {isSearching && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
            <span>Searching...</span>
          </div>
        )}

        {searchResults && searchResults.length > 0 && (
          <div className="space-y-3">
            <div className="max-h-[300px] overflow-y-auto space-y-3">
              {searchResults.map((product) => (
                <div
                  key={product.asin}
                  className={`border rounded-md p-3 cursor-pointer transition-colors ${
                    selectedProduct?.asin === product.asin 
                      ? "border-primary bg-primary/5" 
                      : "hover:border-primary/50"
                  }`}
                  onClick={() => setSelectedProduct(product)}
                >
                  <div className="flex gap-3">
                    {product.imageUrl && (
                      <img
                        src={product.imageUrl}
                        alt={product.title}
                        className="w-16 h-16 object-contain"
                      />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium line-clamp-2">
                        {product.title}
                      </p>
                      {product.price && (
                        <p className="text-primary font-semibold mt-1">
                          ${product.price.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedProduct && (
        <div className="border-t pt-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Target Price ($)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Enter your target price"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
              />
            </div>

            <Button 
              onClick={handleTrackSubmit}
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                "Track Price"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}