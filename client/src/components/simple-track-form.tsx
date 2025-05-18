import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bell } from "lucide-react";

/**
 * Simple tracker form for directly testing the tracking API
 */
const SimpleTrackForm = () => {
  const [productUrl, setProductUrl] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [email, setEmail] = useState("test@example.com");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    toast({
      title: "Sending tracking request...",
      description: "Please wait while we process your request",
    });
    
    console.log("Submitting tracking request with data:", {
      productUrl, 
      targetPrice: parseFloat(targetPrice), 
      email
    });
    
    try {
      const response = await fetch("/api/track", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          productUrl,
          targetPrice: parseFloat(targetPrice),
          email
        })
      });
      
      console.log("Response status:", response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }
      
      const result = await response.json();
      console.log("Tracking successful:", result);
      
      toast({
        title: "Product tracking added!",
        description: `We'll notify you at ${email} when the price drops below $${targetPrice}`,
        duration: 5000,
      });
      
      // Reset form
      setProductUrl("");
      setTargetPrice("");
    } catch (error) {
      console.error("Error submitting tracking request:", error);
      toast({
        title: "Failed to track product",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    }
    
    setIsSubmitting(false);
  };
  
  return (
    <div className="p-6 bg-white rounded-lg shadow-sm border">
      <h2 className="text-xl font-bold mb-4">Simple Product Tracker</h2>
      <p className="text-sm text-gray-500 mb-6">
        Enter an Amazon product URL and your target price to start tracking
      </p>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Amazon Product URL
          </label>
          <Input
            type="text"
            placeholder="https://www.amazon.com/dp/B123456789"
            value={productUrl}
            onChange={(e) => setProductUrl(e.target.value)}
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">
            Target Price
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500">$</span>
            </div>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="29.99"
              className="pl-7"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              required
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">
            Email for Notifications
          </label>
          <Input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        
        <Button 
          type="submit"
          className="w-full"
          disabled={isSubmitting}
        >
          <Bell className="mr-2 h-4 w-4" />
          {isSubmitting ? "Processing..." : "Track This Product"}
        </Button>
      </form>
    </div>
  );
};

export default SimpleTrackForm;