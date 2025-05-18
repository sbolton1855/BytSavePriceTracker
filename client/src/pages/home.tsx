import { useState, useEffect } from "react";
import HeroSection from "@/components/hero-section";
import FeaturesSection from "@/components/features-section";
import ProductSearch from "@/components/product-search";
import ProductsDisplay from "@/components/products-display";
import NotificationDemo from "@/components/notification-demo";
import SimpleTracker from "@/components/simple-tracker";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const Home: React.FC = () => {
  const { user } = useAuth();
  const [userEmail, setUserEmail] = useState<string>(() => {
    // Use authenticated user's email or get from local storage
    return user?.email || localStorage.getItem("bytsave_user_email") || "";
  });
  const { toast } = useToast();
  
  // Update email when user changes or localStorage changes
  useEffect(() => {
    const storedEmail = localStorage.getItem("bytsave_user_email");
    if (user?.email) {
      setUserEmail(user.email);
    } else if (storedEmail && storedEmail !== userEmail) {
      setUserEmail(storedEmail);
    }
    
    // Handle product tracked events
    const handleProductTracked = (event: any) => {
      if (event.detail?.email) {
        setUserEmail(event.detail.email);
      }
    };
    
    document.addEventListener('product-tracked', handleProductTracked);
    return () => {
      document.removeEventListener('product-tracked', handleProductTracked);
    };
  }, [user]);

  // Handle successful tracker form submission
  const handleTrackerSuccess = () => {
    // Get the email from the form
    const emailInput = document.querySelector('input[name="email"]') as HTMLInputElement;
    if (emailInput && emailInput.value) {
      const email = emailInput.value;
      setUserEmail(email);
      
      // Save to local storage for persistence
      localStorage.setItem("bytsave_user_email", email);
      
      // Show notification
      toast({
        title: "Product tracking started",
        description: "We'll send an email when the price drops below your target.",
      });
      
      // Scroll to dashboard
      document.getElementById("dashboard")?.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Handle quick track form submission
  const handleQuickTrackSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Get form values
    const form = e.currentTarget;
    const urlInput = form.elements.namedItem("productUrl") as HTMLInputElement;
    const priceInput = form.elements.namedItem("targetPrice") as HTMLInputElement;
    const emailInput = form.elements.namedItem("email") as HTMLInputElement;
    
    const productUrl = urlInput.value;
    const targetPrice = parseFloat(priceInput.value);
    const email = emailInput.value;
    
    if (!productUrl || !targetPrice || !email) {
      toast({
        title: "Missing required fields",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }
    
    // Send simple tracking request
    fetch("/api/track", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        productUrl,
        targetPrice,
        email
      })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error("Failed to track product");
      }
      return response.json();
    })
    .then(data => {
      console.log("Tracking success:", data);
      toast({
        title: "Product tracked!",
        description: "We'll notify you when the price drops",
      });
      
      // Set the email for the dashboard
      setUserEmail(email);
      localStorage.setItem("bytsave_user_email", email);
      
      // Reset form
      form.reset();
      
      // Scroll to dashboard
      document.getElementById("dashboard")?.scrollIntoView({ behavior: "smooth" });
    })
    .catch(error => {
      console.error("Tracking error:", error);
      toast({
        title: "Tracking failed",
        description: error.message,
        variant: "destructive"
      });
    });
  };

  return (
    <>
      <HeroSection />
      <FeaturesSection />
      
      <section id="tracker" className="py-16 bg-slate-50">
        <div className="container">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-4">Track Amazon Prices</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Enter an Amazon product URL or search by name to start tracking prices
              and get notified when they drop.
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Main product search and tracking component */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Search & Track</CardTitle>
                  <CardDescription>
                    Search for products by name or ASIN
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ProductSearch onSuccess={handleTrackerSuccess} />
                </CardContent>
              </Card>
            </div>
            
            {/* Simple tracker for debugging */}
            <div>
              <Card className="bg-white border-2 border-amber-200">
                <CardHeader className="bg-amber-50">
                  <CardTitle>Quick Track (Simplified)</CardTitle>
                  <CardDescription>
                    Try this direct tracking form if the regular one isn't working
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mt-2">
                    <p className="text-sm text-amber-700 mb-4">⚠️ This form bypasses the advanced features and directly tracks a product by URL.</p>
                    {/* Import the SimpleTracker component */}
                    <SimpleTracker />
                  </div>
                </CardContent>
              </Card>
            </div>
            
          </div>
        </div>
      </section>
      
      <ProductsDisplay email={userEmail} />
      <NotificationDemo />
    </>
  );
};

export default Home;