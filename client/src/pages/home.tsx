import { useState } from "react";
import HeroSection from "@/components/hero-section";
import FeaturesSection from "@/components/features-section";
import TrackerForm from "@/components/tracker-form";
import ProductsDisplay from "@/components/products-display";
import NotificationDemo from "@/components/notification-demo";
import CtaSection from "@/components/cta-section";
import FAQSection from "@/components/faq-section";
import { useToast } from "@/hooks/use-toast";

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
      <TrackerForm onSuccess={handleTrackerSuccess} />
      <ProductsDisplay email={userEmail} />
      <NotificationDemo />
      <CtaSection />
      <FAQSection />
    </>
  );
};

export default Home;
