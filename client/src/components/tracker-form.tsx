import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { trackingFormSchema, type TrackingFormData } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface TrackerFormProps {
  onSuccess?: () => void;
}

const TrackerForm: React.FC<TrackerFormProps> = ({ onSuccess }) => {
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Define form
  const form = useForm<TrackingFormData>({
    resolver: zodResolver(trackingFormSchema),
    defaultValues: {
      productUrl: "",
      targetPrice: 0,
      email: "",
    },
  });

  // Set up mutation
  const trackProductMutation = useMutation({
    mutationFn: async (data: TrackingFormData) => {
      console.log("DEBUG - Starting track request with data:", JSON.stringify(data));
      try {
        // Enhanced error logging
        const response = await fetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
          credentials: "include"
        });
        
        console.log("DEBUG - Track request status:", response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error("Track request failed with status:", response.status);
          console.error("Error response:", errorText);
          
          try {
            const errorData = JSON.parse(errorText);
            throw new Error(errorData.error || "Failed to track product");
          } catch (parseError) {
            throw new Error(`Server error (${response.status}): ${errorText || "Unknown error"}`);
          }
        }
        
        return response.json();
      } catch (error) {
        console.error("Error tracking product:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      // Show a clear confirmation notification
      toast({
        title: "✅ Product tracking added!",
        description: "You'll receive an email when the price drops below your target.",
        variant: "default",
        duration: 6000,
      });
      
      // Reset the form
      form.reset();
      
      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
      
      // Force refresh tracked products list
      queryClient.invalidateQueries({ queryKey: ['/api/tracked-products'] });
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['/api/my/tracked-products'] });
      }
      
      setIsSubmitting(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to track product",
        description: error instanceof Error ? error.message : "Please try again later",
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });

  // Form submission handler
  const onSubmit = (data: TrackingFormData) => {
    console.log('Track price button clicked with data:', data);
    setIsSubmitting(true);
    
    // Store email in session if not authenticated
    if (!isAuthenticated && data.email) {
      sessionStorage.setItem("bytsave_user_session", data.email);
    }
    
    // Add confirmation toast before tracking
    toast({
      title: "Starting price tracking...",
      description: "Please wait while we set up tracking for this product.",
    });

    // For detailed debugging
    console.log(`Sending tracking request to /api/track with data:`, JSON.stringify(data, null, 2));
    
    trackProductMutation.mutate(data, {
      onError: (error) => {
        console.error('Track price error:', error);
        console.error('Error details:', error instanceof Error ? error.message : "Unknown error");
        console.error('Error stack:', error instanceof Error ? error.stack : "No stack trace");
        
        toast({
          title: "Failed to track price",
          description: error instanceof Error ? error.message : "An unexpected error occurred",
          variant: "destructive",
        });
        setIsSubmitting(false);
      },
      onSuccess: (response) => {
        console.log('Track price success. Response data:', JSON.stringify(response, null, 2));
        toast({
          title: "✅ Price tracking confirmed!",
          description: `We'll notify you when the price drops below $${data.targetPrice}`,
          duration: 5000,
        });
        setIsSubmitting(false);
        if (onSuccess) {
          onSuccess();
        }
      }
    });
  };

  return (
    <section id="tracker" className="py-12 sm:py-16 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-gray-900">Track an Amazon Product</h2>
          <p className="mt-3 text-xl text-gray-500">
            Enter an Amazon product URL or ASIN to start tracking
          </p>
        </div>

        <div className="bg-gray-50 rounded-xl p-6 md:p-8 shadow-sm border border-gray-200">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="productUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amazon Product URL or ASIN</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="https://www.amazon.com/dp/B0123ABCDE or B0123ABCDE" 
                        {...field} 
                      />
                    </FormControl>
                    <p className="text-xs text-gray-500">Paste a complete Amazon product URL or just the ASIN code</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="targetPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Price ($)</FormLabel>
                    <FormControl>
                      <div className="relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 sm:text-sm">$</span>
                        </div>
                        <Input 
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="49.99"
                          className="pl-7"
                          {...field}
                          onChange={(e) => {
                            const value = e.target.value === "" ? 0 : parseFloat(e.target.value);
                            field.onChange(value);
                          }}
                        />
                      </div>
                    </FormControl>
                    <p className="text-xs text-gray-500">We'll notify you when the price drops below this amount</p>
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
                      <FormLabel>Email for Notifications</FormLabel>
                      <FormControl>
                        <Input 
                          type="email"
                          placeholder="your@email.com" 
                          {...field} 
                        />
                      </FormControl>
                      <p className="text-xs text-gray-500">We'll send price drop alerts to this email</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              
              <Button 
                type="submit" 
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Tracking..." : "Start Tracking Price"}
              </Button>

              <div className="text-center text-xs text-gray-500">
                <p>By submitting, you agree to our <a href="#" className="text-primary-500 hover:text-primary-600">Terms of Service</a> and <a href="#" className="text-primary-500 hover:text-primary-600">Privacy Policy</a></p>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </section>
  );
};

export default TrackerForm;
