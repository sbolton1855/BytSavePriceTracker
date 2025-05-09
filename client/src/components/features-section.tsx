import { Link } from "wouter";

const FeaturesSection: React.FC = () => {
  return (
    <section id="how-it-works" className="bg-gray-50 py-12 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">How BytSave Works</h2>
          <p className="mt-3 max-w-2xl mx-auto text-xl text-gray-500 sm:mt-4">
            Track prices, set alerts, save money - it's that simple.
          </p>
        </div>
        
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {/* Feature 1 */}
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
            <div className="h-12 w-12 rounded-md bg-primary-100 text-primary-500 flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900">Add Products</h3>
            <p className="mt-2 text-base text-gray-500">
              Enter an Amazon product URL or ASIN. We'll automatically fetch the current price and details.
            </p>
          </div>
          
          {/* Feature 2 */}
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
            <div className="h-12 w-12 rounded-md bg-primary-100 text-primary-500 flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="m15 9-6 6" />
                <path d="m9 9 6 6" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900">Set Target Price</h3>
            <p className="mt-2 text-base text-gray-500">
              Tell us your ideal price - we'll monitor the product and notify you when the price drops.
            </p>
          </div>
          
          {/* Feature 3 */}
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
            <div className="h-12 w-12 rounded-md bg-primary-100 text-primary-500 flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900">Get Notifications</h3>
            <p className="mt-2 text-base text-gray-500">
              Receive email alerts when prices drop below your target. Click through our links to purchase and save.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
