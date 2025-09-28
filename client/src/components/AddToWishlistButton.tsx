
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { Button } from "./ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AddToWishlistButtonProps {
  productId: number;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline" | "ghost";
}

export default function AddToWishlistButton({ 
  productId, 
  size = "sm", 
  variant = "outline" 
}: AddToWishlistButtonProps) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAdded, setIsAdded] = useState(false);

  const addToWishlistMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/wishlist/add", {
        productId
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to add to wishlist");
      }
      return res.json();
    },
    onSuccess: () => {
      setIsAdded(true);
      toast({
        title: "Added to Wishlist",
        description: "Product has been added to your wishlist",
      });
      // Invalidate wishlist queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/wishlist/mine"] });
    },
    onError: (error: Error) => {
      if (error.message.includes("already in wishlist")) {
        toast({
          title: "Already in Wishlist",
          description: "This product is already in your wishlist",
          variant: "default",
        });
      } else {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  if (!isAuthenticated) {
    return (
      <Button
        size={size}
        variant="ghost"
        onClick={() => {
          toast({
            title: "Login Required",
            description: "Please log in to add items to your wishlist",
          });
        }}
      >
        <Heart className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      size={size}
      variant={variant}
      onClick={() => addToWishlistMutation.mutate()}
      disabled={addToWishlistMutation.isPending || isAdded}
      className={isAdded ? "text-red-500" : ""}
    >
      <Heart className={`h-4 w-4 ${isAdded ? "fill-current" : ""}`} />
      {addToWishlistMutation.isPending ? "Adding..." : isAdded ? "Added" : ""}
    </Button>
  );
}
