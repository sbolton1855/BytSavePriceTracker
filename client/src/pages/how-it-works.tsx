import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const HowItWorks: React.FC = () => {
  return (
    <div className="bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl">
            How BytSave Works
          </h1>
          <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
            Our Amazon price tracking system is designed to save you money automatically. Here's how it works in 3 simple steps.
          </p>
        </div>
        
        {/* Step-by-step guide */}
        <div className="grid gap-12 lg:gap-16 mb-16">
          {/* Step 1 */}
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="md:order-2">
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <svg className="w-full h-auto" viewBox="0 0 500 300" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="500" height="300" fill="#f8fafc" />
                  <rect x="50" y="50" width="400" height="50" rx="4" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" />
                  <rect x="60" y="65" width="200" height="20" rx="2" fill="#cbd5e1" />
                  <rect x="380" y="60" width="60" height="30" rx="4" fill="#3B82F6" />
                  <rect x="50" y="120" width="400" height="130" rx="4" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" />
                  <circle cx="100" cy="160" r="30" fill="#f1f5f9" />
                  <rect x="150" y="145" width="280" height="10" rx="2" fill="#cbd5e1" />
                  <rect x="150" y="165" width="220" height="10" rx="2" fill="#cbd5e1" />
                  <rect x="150" y="185" width="250" height="10" rx="2" fill="#cbd5e1" />
                </svg>
              </div>
            </div>
            <div className="space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-100 text-primary-600 font-bold text-lg">1</div>
              <h2 className="text-3xl font-bold text-gray-900">Add Amazon Products</h2>
              <p className="text-lg text-gray-600">
                Start by entering an Amazon product URL or ASIN in our tracking form. Our system will automatically fetch the current price and product details from Amazon.
              </p>
              <ul className="space-y-2">
                <li className="flex items-start">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary-500 mt-1 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Works with any Amazon product URL</span>
                </li>
                <li className="flex items-start">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary-500 mt-1 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Automatically detects product information</span>
                </li>
                <li className="flex items-start">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary-500 mt-1 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>No account required to start tracking</span>
                </li>
              </ul>
            </div>
          </div>
          
          {/* Step 2 */}
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <svg className="w-full h-auto" viewBox="0 0 500 300" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="500" height="300" fill="#f8fafc" />
                  <rect x="50" y="30" width="400" height="240" rx="4" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" />
                  <line x1="50" y1="80" x2="450" y2="80" stroke="#e2e8f0" strokeWidth="2" />
                  <rect x="70" y="45" width="120" height="20" rx="2" fill="#3B82F6" fillOpacity="0.1" />
                  <path d="M70 150 L120 180 L170 120 L220 200 L270 160 L320 210 L370 100 L420 140" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="120" cy="180" r="4" fill="#3B82F6" />
                  <circle cx="170" cy="120" r="4" fill="#3B82F6" />
                  <circle cx="220" cy="200" r="4" fill="#3B82F6" />
                  <circle cx="270" cy="160" r="4" fill="#3B82F6" />
                  <circle cx="320" cy="210" r="4" fill="#3B82F6" />
                  <circle cx="370" cy="100" r="4" fill="#3B82F6" />
                  <circle cx="420" cy="140" r="4" fill="#3B82F6" />
                  <line x1="50" y1="230" x2="450" y2="230" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 4" />
                  <line x1="250" y1="230" x2="250" y2="80" stroke="#10B981" strokeWidth="1" strokeDasharray="4 4" />
                  <rect x="230" y="240" width="40" height="15" rx="2" fill="#10B981" fillOpacity="0.1" />
                  <line x1="50" y1="140" x2="450" y2="140" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 4" />
                </svg>
              </div>
            </div>
            <div className="space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-100 text-primary-600 font-bold text-lg">2</div>
              <h2 className="text-3xl font-bold text-gray-900">Set Your Target Price</h2>
              <p className="text-lg text-gray-600">
                Tell us how much you want to pay. Our system will monitor the product's price around the clock and detect any price drops.
              </p>
              <ul className="space-y-2">
                <li className="flex items-start">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary-500 mt-1 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Price checks run every few hours</span>
                </li>
                <li className="flex items-start">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary-500 mt-1 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Track price history and trends</span>
                </li>
                <li className="flex items-start">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary-500 mt-1 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Adjustable target price at any time</span>
                </li>
              </ul>
            </div>
          </div>
          
          {/* Step 3 */}
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="md:order-2">
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <svg className="w-full h-auto" viewBox="0 0 500 300" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="500" height="300" fill="#f8fafc" />
                  <rect x="100" y="50" width="300" height="200" rx="4" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" />
                  <rect x="120" y="70" width="260" height="30" rx="2" fill="#f1f5f9" />
                  <rect x="130" y="80" width="150" height="10" rx="1" fill="#cbd5e1" />
                  <rect x="120" y="110" width="260" height="1" fill="#e2e8f0" />
                  <rect x="120" y="130" width="50" height="50" rx="2" fill="#f1f5f9" />
                  <rect x="180" y="130" width="140" height="10" rx="1" fill="#cbd5e1" />
                  <rect x="180" y="150" width="100" height="10" rx="1" fill="#cbd5e1" />
                  <rect x="180" y="170" width="120" height="10" rx="1" fill="#cbd5e1" />
                  <rect x="120" y="200" width="260" height="1" fill="#e2e8f0" />
                  <rect x="200" y="220" width="100" height="10" rx="4" fill="#3B82F6" />
                </svg>
              </div>
            </div>
            <div className="space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-100 text-primary-600 font-bold text-lg">3</div>
              <h2 className="text-3xl font-bold text-gray-900">Get Price Drop Alerts</h2>
              <p className="text-lg text-gray-600">
                When the price drops below your target, we'll send you an immediate email notification with an affiliate link to purchase the product.
              </p>
              <ul className="space-y-2">
                <li className="flex items-start">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary-500 mt-1 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Email notifications with product details</span>
                </li>
                <li className="flex items-start">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary-500 mt-1 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>One-click purchase through our affiliate links</span>
                </li>
                <li className="flex items-start">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary-500 mt-1 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Never miss a price drop again</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
        
        {/* Technical details */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Technical Details</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                  </svg>
                  Amazon Product API
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  BytSave connects to Amazon's Product Advertising API to fetch real-time pricing data and product information.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z" />
                  </svg>
                  Background Processing
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Our system runs automatic price checks every few hours, ensuring you always have the most up-to-date pricing information.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                  Email Notifications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  We use a reliable email delivery system to ensure you receive alerts as soon as prices drop below your target.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
        
        {/* FAQ */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">How accurate is the price tracking?</h3>
              <p className="mt-2 text-gray-600">
                BytSave uses Amazon's official Product Advertising API to fetch real-time pricing data, ensuring high accuracy. Our system checks prices approximately every 4 hours, so there might be a short delay between a price change and our notification.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Do I need to create an account?</h3>
              <p className="mt-2 text-gray-600">
                While you can track products without an account by just providing your email address, creating an account gives you additional benefits like viewing your price history, managing all your tracked items in one place, and customizing notification settings.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Is BytSave completely free?</h3>
              <p className="mt-2 text-gray-600">
                BytSave's basic plan allows you to track up to 10 products for free. We also offer premium plans with additional features like more tracked products, advanced price history analytics, and customized notification schedules.
              </p>
            </div>
          </div>
        </div>
        
        {/* Call to action */}
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Ready to Start Saving?</h2>
          <p className="mt-4 text-xl text-gray-600 max-w-2xl mx-auto">
            Don't miss another price drop. Start tracking your favorite Amazon products today and get notified when it's time to buy.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg">
              <Link href="/#tracker">
                Track Your First Product
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/dashboard">
                View Dashboard
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HowItWorks;
