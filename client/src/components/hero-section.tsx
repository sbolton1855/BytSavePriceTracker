import { Button } from "@/components/ui/button";

const HeroSection: React.FC = () => {
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative py-12 sm:py-16 lg:py-20 grid lg:grid-cols-2 gap-8 items-center">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl md:text-6xl">
              <span className="block">Track Amazon prices.</span>
              <span className="block text-primary-500">Save money automatically.</span>
            </h1>
            <p className="mt-3 text-base text-gray-500 sm:mt-5 sm:text-lg md:mt-5 md:text-xl">
              BytSave monitors Amazon product prices for you. Set your target price and get notified when it's time to buy.
            </p>
            <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row gap-3">
              <Button 
                size="lg" 
                className="w-full sm:w-auto"
                onClick={() => scrollToSection('tracker')}
              >
                Track a product
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="w-full sm:w-auto"
                onClick={() => scrollToSection('how-it-works')}
              >
                How it works
              </Button>
            </div>
          </div>
          <div className="relative">
            <div className="rounded-lg shadow-lg w-full h-auto overflow-hidden">
              <svg className="w-full h-auto aspect-[4/3]" viewBox="0 0 800 600" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="800" height="600" fill="#f8fafc" />
                <g transform="translate(100, 50)">
                  <rect x="0" y="0" width="600" height="500" rx="8" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" />
                  <rect x="20" y="20" width="560" height="60" rx="4" fill="#f1f5f9" />
                  <rect x="40" y="40" width="300" height="20" rx="2" fill="#cbd5e1" />
                  <rect x="20" y="100" width="270" height="380" rx="4" fill="#f1f5f9" />
                  <rect x="310" y="100" width="270" height="180" rx="4" fill="#f1f5f9" />
                  <rect x="310" y="300" width="270" height="180" rx="4" fill="#f1f5f9" />
                  <circle cx="155" cy="200" r="60" fill="#3b82f6" opacity="0.8" />
                  <path d="M125 200 L145 220 L185 180" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
                  <rect x="330" y="130" width="230" height="10" rx="2" fill="#cbd5e1" />
                  <rect x="330" y="150" width="180" height="10" rx="2" fill="#cbd5e1" />
                  <rect x="330" y="170" width="210" height="10" rx="2" fill="#cbd5e1" />
                  <rect x="330" y="190" width="160" height="10" rx="2" fill="#cbd5e1" />
                  <rect x="330" y="210" width="190" height="10" rx="2" fill="#cbd5e1" />
                  <rect x="330" y="230" width="230" height="10" rx="2" fill="#cbd5e1" />
                  <rect x="330" y="250" width="170" height="10" rx="2" fill="#cbd5e1" />
                  <rect x="40" y="330" width="230" height="10" rx="2" fill="#cbd5e1" />
                  <rect x="40" y="350" width="180" height="10" rx="2" fill="#cbd5e1" />
                  <rect x="40" y="370" width="210" height="10" rx="2" fill="#cbd5e1" />
                  <rect x="40" y="390" width="160" height="10" rx="2" fill="#cbd5e1" />
                  <rect x="40" y="410" width="190" height="10" rx="2" fill="#cbd5e1" />
                  <rect x="40" y="430" width="230" height="10" rx="2" fill="#cbd5e1" />
                  <rect x="40" y="450" width="170" height="10" rx="2" fill="#cbd5e1" />
                  <rect x="330" y="330" width="230" height="10" rx="2" fill="#cbd5e1" />
                  <rect x="330" y="350" width="180" height="10" rx="2" fill="#cbd5e1" />
                  <rect x="330" y="370" width="210" height="10" rx="2" fill="#cbd5e1" />
                  <rect x="330" y="390" width="160" height="10" rx="2" fill="#cbd5e1" />
                  <rect x="330" y="410" width="190" height="10" rx="2" fill="#cbd5e1" />
                  <rect x="330" y="430" width="230" height="10" rx="2" fill="#cbd5e1" />
                  <rect x="330" y="450" width="170" height="10" rx="2" fill="#cbd5e1" />
                </g>
              </svg>
            </div>
            <div className="absolute -bottom-6 -left-6 bg-white rounded-lg shadow-lg p-4 max-w-xs hidden md:block">
              <div className="flex items-center">
                <div className="bg-success-500 text-white p-2 rounded-full mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">Price Drop Alert!</p>
                  <p className="text-xs text-gray-500">Headphones now $79.99 (was $129.99)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
