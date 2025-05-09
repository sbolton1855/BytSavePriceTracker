import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const CtaSection: React.FC = () => {
  return (
    <section className="py-12 bg-primary-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl font-bold text-white">Start Saving on Amazon Today</h2>
        <p className="mt-3 text-xl text-primary-100 max-w-2xl mx-auto">
          Track your first product for free and never miss a price drop again.
        </p>
        <div className="mt-8">
          <Button asChild variant="secondary" size="lg">
            <Link href="#tracker">
              Track a Product Now
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default CtaSection;
