import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

/**
 * Simple direct tracker component with minimal dependencies
 */
export default function SimpleTracker() {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [price, setPrice] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Simple validation
  const isValid = url.includes("amazon.com") && parseFloat(price) > 0 && email.includes("@");

  const handleTrack = async () => {
    if (!isValid) {
      toast({
        title: "Invalid input",
        description: "Please enter a valid Amazon URL, price, and email address",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Direct tracking with minimal complexity
      const response = await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productUrl: url,
          targetPrice: parseFloat(price),
          email: email,
        }),
      });

      console.log("Response status:", response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log("Tracking success:", data);
        
        // Reset the form
        setUrl("");
        setPrice("");
        
        // Store email for consistent tracking across the app
        localStorage.setItem("bytsave_user_email", email);
        
        // Force refresh tracked products (make sure to include the email in the query key)
        queryClient.invalidateQueries({ queryKey: ["/api/tracked-products"] });
        
        // Fire custom event to notify other components
        const trackEvent = new CustomEvent('product-tracked', { 
          detail: { email: email }
        });
        document.dispatchEvent(trackEvent);
        
        // Show success message with longer duration and more visible styling
        toast({
          title: "✅ Product tracked successfully!",
          description: "You'll receive an email when the price drops below your target.",
          duration: 8000, // 8 seconds
          variant: "default",
        });
        
        // Optional: Scroll to the tracked products section
        setTimeout(() => {
          document.getElementById('dashboard')?.scrollIntoView({ behavior: 'smooth' });
        }, 1000);
      } else {
        const errorText = await response.text();
        console.error("Tracking error:", errorText);
        throw new Error(errorText || "Failed to track product");
      }
    } catch (error) {
      console.error("Track error:", error);
      toast({
        title: "Tracking failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Quick Track</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">Amazon Product URL</Label>
            <Input
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.amazon.com/dp/..."
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="price">Target Price</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="29.99"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">Email for Notifications</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
            />
          </div>
          
          <Button 
            className="w-full" 
            onClick={handleTrack}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? "Tracking..." : "Track Price"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}