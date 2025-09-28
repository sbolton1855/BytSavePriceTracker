import { useState, useEffect } from "react";
import HeroSection from "@/components/hero-section";
import FeaturesSection from "@/components/features-section";
import ProductsDisplay from "@/components/products-display";
import ProductSearch from "@/components/product-search";
import ProductTeasers from "@/components/product-teasers";
import UnifiedDeals from "@/components/UnifiedDeals";
import NotificationDemo from "@/components/notification-demo";
import { AIRecommendations } from "@/components/AIRecommendations";
import AIProductSearch from "@/components/AIProductSearch";
import SimpleTracker from "@/components/simple-tracker";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OpenAITest } from "@/components/OpenAITest";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Target, Bell, ChevronDown, ChevronUp } from "lucide-react";
import DashboardToggle from "@/components/DashboardToggle";

const Home: React.FC = () => {
  const { user } = useAuth();
  const [userEmail, setUserEmail] = useState<string>(() => {
    // Use authenticated user's email or get from local storage
    return user?.email || localStorage.getItem("bytsave_user_email") || "";
  });
  const { toast } = useToast();
  const [showQuickTrack, setShowQuickTrack] = useState(false);
    const [trackedProducts, setTrackedProducts] = useState<any[]>([]);
  const [savedEmail, setSavedEmail] = useState<string | null>(null);


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
  const handleTrackerSuccess = (customEmail?: string) => {
    // Get the email either from the parameter or try to find it in the form
    let email = customEmail;

    if (!email) {
      const emailInput = document.querySelector('input[name="email"]') as HTMLInputElement;
      if (emailInput && emailInput.value) {
        email = emailInput.value;
      }
    }

    if (email) {
      setUserEmail(email);

      // Save to local storage for persistence
      localStorage.setItem("bytsave_user_email", email);

      // Show notification
      toast({
        title: "Product tracking started",
        description: "We'll send an email when the price drops below your target.",
      });
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
      setShowQuickTrack(false);

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

    useEffect(() => {
        const savedEmail = localStorage.getItem("bytsave_user_email");
        setSavedEmail(savedEmail);

        if (savedEmail) {
            fetch(`/api/tracked-products?email=${savedEmail}`)
                .then(response => {
                    // Check if response is valid JSON before parsing
                    const contentType = response.headers.get('content-type');
                    if (!response.ok || !contentType || !contentType.includes('application/json')) {
                        return response.text().then(text => {
                            console.error('Invalid JSON response:', text);
                            throw new Error('There was a problem fetching your tracked products. Please try again.');
                        });
                    }
                    return response.json();
                })
                .then(data => {
                    setTrackedProducts(data);
                })
                .catch(error => {
                    console.error("Error fetching tracked products:", error);
                    setTrackedProducts([]);
                });
        }
    }, []);

  return (
    <>
      {/* Above-the-Fold Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-16 lg:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-start lg:items-center">
            {/* Left Side: Headline, tagline, search input */}
            <div className="space-y-8">
              <div className="space-y-4">
                <h1 className="text-4xl lg:text-6xl font-bold text-gray-900 leading-tight">
                  Track Amazon Prices
                </h1>
                <p className="text-xl text-gray-600 leading-relaxed">
                  Enter a product name or link to set alerts for price drops.
                </p>
              </div>

              {/* Main Search Box */}
              <Card className="bg-white/90 backdrop-blur-sm shadow-xl border-0">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <Label className="text-lg font-medium text-gray-800">Search by Product Name</Label>
                    <ProductSearch onSuccess={handleTrackerSuccess} />
                  </div>
                </CardContent>
              </Card>

              {/* Quick Track Toggle */}
              <div className="text-center">
                <button
                  onClick={() => setShowQuickTrack(!showQuickTrack)}
                  className="inline-flex items-center text-primary-600 hover:text-primary-700 font-medium transition-colors"
                >
                  Want to paste a link instead? Click to expand
                  {showQuickTrack ? (
                    <ChevronUp className="ml-2 h-4 w-4" />
                  ) : (
                    <ChevronDown className="ml-2 h-4 w-4" />
                  )}
                </button>
              </div>

              {/* Collapsible Quick Track */}
              {showQuickTrack && (
                <Card className="bg-amber-50 border-amber-200 animate-fadeIn">
                  <CardContent className="p-6">
                    <form onSubmit={handleQuickTrackSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="productUrl">Product URL</Label>
                        <Input
                          id="productUrl"
                          name="productUrl"
                          placeholder="https://amazon.com/dp/..."
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="targetPrice">Target Price ($)</Label>
                          <Input
                            id="targetPrice"
                            name="targetPrice"
                            type="number"
                            step="0.01"
                            placeholder="25.99"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="your@email.com"
                            value={userEmail}
                            onChange={(e) => setUserEmail(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <Button type="submit" className="w-full">
                        Track Price Drop
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Side: Dashboard Toggle */}
            <div className="relative">
              <DashboardToggle />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section - Visual and Trust-Building */}
      <section className="py-20 bg-white" id="how-it-works">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Simple, automated price tracking that saves you money
            </p>
          </div>

          {/* 3-Column Benefit Section */}
          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            <div className="text-center group">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-primary-200 transition-colors">
                <Search className="h-8 w-8 text-primary-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Search or paste a product
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Enter a product name to search Amazon, or paste any Amazon product URL directly.
              </p>
            </div>

            <div className="text-center group">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-primary-200 transition-colors">
                <Target className="h-8 w-8 text-primary-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Set your target price
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Choose the price you want to pay. We'll monitor the product and wait for the perfect moment.
              </p>
            </div>

            <div className="text-center group">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-primary-200 transition-colors">
                <Bell className="h-8 w-8 text-primary-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Get notified when it drops
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Receive instant email alerts when your target price is reached. Never miss a deal again.
              </p>
            </div>
          </div>


        </div>
      </section>

      {/* Price Drop Dashboard - Moved down and styled as feed */}
      {userEmail && (
        <section id="dashboard" className="py-20 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Your Active Price Watches
              </h2>
              <p className="text-lg text-gray-600">
                Track your products and see price history
              </p>
            </div>
            <ProductsDisplay email={userEmail} />
          </div>
        </section>
      )}

      <NotificationDemo />

      {/* Live Deals Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              🔥 Live Deals Right Now
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Fresh deals updated in real-time from Amazon
            </p>
          </div>
          <UnifiedDeals type="live" title="Live Deals Right Now" />
        </div>
      </section>

      {/* Trending Deals Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              📈 Trending Now
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Popular products with the best discounts
            </p>
          </div>
          <UnifiedDeals type="trending" title="Trending Now" />
        </div>
      </section>

      {/* AI Recommendations Section */}
      <section className="py-16 bg-gradient-to-br from-purple-50 to-indigo-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              🤖 AI-Powered Product Discovery
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Let our AI analyze your tracked products and find real Amazon products you'll love
            </p>
          </div>

          <div className="space-y-8">
            {/* AI Product Search - Real Amazon Products */}
            <AIProductSearch 
              trackedProducts={trackedProducts || []} 
              userEmail={user?.email || savedEmail} 
            />

            
          </div>
        </div>
      </section>
    </>
  );
};

export default Home;