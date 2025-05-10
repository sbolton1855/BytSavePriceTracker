import { useState } from "react";
import HeroSection from "@/components/hero-section";
import FeaturesSection from "@/components/features-section";
import ProductSearch from "@/components/product-search";
import ProductsDisplay from "@/components/products-display";
import NotificationDemo from "@/components/notification-demo";
import CtaSection from "@/components/cta-section";
import HighlightedDeals from "@/components/highlighted-deals";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const Home: React.FC = () => {
  const [userEmail, setUserEmail] = useState<string>(() => {
    // Try to get email from local storage
    return localStorage.getItem("bytsave_user_email") || "";
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
      
      <section className="py-16 bg-slate-50">
        <div className="container">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-4">Track Amazon Prices</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Enter an Amazon product URL or search by name to start tracking prices
              and get notified when they drop.
            </p>
          </div>
          
          <ProductSearch onSuccess={handleTrackerSuccess} />
        </div>
      </section>
      
      <section className="py-16">
        <div className="container">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-4">Top Amazon Price Drops</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Check out these products with the biggest recent price drops. Updated daily.
            </p>
          </div>
          <HighlightedDeals />
        </div>
      </section>
      
      <ProductsDisplay email={userEmail} />
      <NotificationDemo />
      <CtaSection />
    </>
  );
};

export default Home;
