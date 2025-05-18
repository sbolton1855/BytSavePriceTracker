import { useState } from "react";
import HeroSection from "@/components/hero-section";
import FeaturesSection from "@/components/features-section";
import ProductSearch from "@/components/product-search";
import ProductsDisplay from "@/components/products-display";
import NotificationDemo from "@/components/notification-demo";
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

            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Quick Track</CardTitle>
                  <CardDescription>
                    Directly track an Amazon product URL
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();

                      // Get form values
                      const form = e.target as HTMLFormElement;
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
                        sessionStorage.setItem("bytsave_user_email", email);

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
                    }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <label htmlFor="productUrl" className="block text-sm font-medium">
                        Amazon Product URL
                      </label>
                      <input
                        id="productUrl"
                        name="productUrl"
                        type="url"
                        required
                        className="w-full p-2 border rounded-md"
                        placeholder="https://www.amazon.com/dp/B0123ABCDE"
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="targetPrice" className="block text-sm font-medium">
                        Target Price ($)
                      </label>
                      <input
                        id="targetPrice"
                        name="targetPrice"
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        className="w-full p-2 border rounded-md"
                        placeholder="19.99"
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="email" className="block text-sm font-medium">
                        Email for Notifications
                      </label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        className="w-full p-2 border rounded-md"
                        placeholder="you@example.com"
                        defaultValue={userEmail}
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition"
                    >
                      Track Price
                    </button>
                  </form>
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