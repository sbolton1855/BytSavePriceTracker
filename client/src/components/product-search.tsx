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
  const [email, setEmail] = useState("");
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

    // Check email for non-authenticated users
    if (!user && (!email || email.trim() === "")) {
      toast({
        title: "Email Required",
        description: "Please provide your email to receive price drop alerts",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Use the email from the authenticated user or the input field
      const trackingEmail = user?.email || email;
      
      console.log("Sending tracking request with:", {
        url: selectedProduct.url,
        price: parseFloat(targetPrice),
        email: trackingEmail
      });
      
      const response = await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productUrl: selectedProduct.url,
          targetPrice: parseFloat(targetPrice),
          email: trackingEmail
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
                  className={`border rounded-md p-3 cursor-pointer transition-all duration-200 ${
                    selectedProduct?.asin === product.asin 
                      ? "border-primary border-2 bg-primary/5 shadow-md" 
                      : "hover:border-primary/50 hover:shadow-sm"
                  }`}
                  onClick={() => {
                    setSelectedProduct(product);
                    // Auto-scroll to target price field after a short delay
                    setTimeout(() => {
                      document.getElementById('target-price-section')?.scrollIntoView({ 
                        behavior: 'smooth',
                        block: 'center'
                      });
                    }, 200);
                  }}
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
                      <div className="flex justify-between">
                        <p className="text-sm font-medium line-clamp-2">
                          {product.title}
                        </p>
                        {selectedProduct?.asin === product.asin && (
                          <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full ml-2 whitespace-nowrap">
                            ✓ Selected
                          </span>
                        )}
                      </div>
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
        <div className="border-t pt-6 animate-fadeIn" id="target-price-section">
          {/* Product Summary Card */}
          <div className="bg-muted/40 p-3 rounded-lg mb-4 border">
            <div className="flex items-center gap-3">
              {selectedProduct.imageUrl && (
                <img 
                  src={selectedProduct.imageUrl} 
                  alt={selectedProduct.title} 
                  className="w-14 h-14 object-contain"
                />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium line-clamp-1">{selectedProduct.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-primary font-bold">
                    ${selectedProduct.price ? selectedProduct.price.toFixed(2) : "N/A"}
                  </span>
                  <span className="text-xs text-muted-foreground">Current Price</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="target-price">Target Price ($)</Label>
              <Input
                id="target-price"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Enter your target price"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className="focus:border-primary focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground">
                We'll notify you when the price falls below this amount
              </p>
            </div>
            
            {!user && (
              <div className="space-y-2">
                <Label htmlFor="alert-email">Email for Price Alerts</Label>
                <Input
                  id="alert-email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="focus:border-primary focus:ring-primary"
                />
                <p className="text-xs text-muted-foreground">
                  We'll send you alerts when the price drops below your target
                </p>
              </div>
            )}

            <Button 
              onClick={handleTrackSubmit}
              className="w-full"
              disabled={isSubmitting || (!user && !email)}
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