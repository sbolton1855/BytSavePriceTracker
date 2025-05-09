import React from 'react';

const NotificationDemo: React.FC = () => {
  return (
    <section className="py-12 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-gray-900">Stay Informed, Save Money</h2>
          <p className="mt-3 text-xl text-gray-500">
            Get timely price drop notifications right in your inbox
          </p>
        </div>
        
        <div className="relative mx-auto max-w-5xl">
          <div className="grid md:grid-cols-2 gap-6 lg:gap-12 items-center">
            <div className="bg-gray-50 rounded-lg p-6 md:p-8 shadow-md border border-gray-200">
              {/* Email notification mockup */}
              <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200">
                <div className="flex items-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-500 mr-2">
                    <path d="M4 7v6a4 4 0 0 0 4 4h10a2 2 0 0 0 2-2v-6a4 4 0 0 0-4-4H6a2 2 0 0 0-2 2Z"/>
                    <path d="M5 11h4"/>
                    <path d="M8 8v6"/>
                    <path d="M9 12a3 3 0 0 0 3 3h5l2-2v-6"/>
                    <path d="M19 10h-5a2 2 0 0 0-2 2"/>
                  </svg>
                  <h3 className="text-lg font-semibold text-gray-800">BytSave Price Alert</h3>
                </div>
                
                <p className="text-gray-700 mb-4">Good news! A product you're tracking has dropped in price.</p>
                
                <div className="bg-gray-50 rounded-md p-4 mb-4">
                  <div className="flex items-start">
                    <svg 
                      viewBox="0 0 200 200" 
                      className="w-16 h-16 object-cover rounded-md mr-3"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <rect width="200" height="200" fill="#e2e8f0" />
                      <circle cx="100" cy="100" r="40" fill="#3b82f6" opacity="0.5" />
                      <rect x="70" y="140" width="60" height="10" rx="2" fill="#94a3b8" />
                      <rect x="50" y="155" width="100" height="5" rx="2" fill="#cbd5e1" />
                      <rect x="60" y="165" width="80" height="5" rx="2" fill="#cbd5e1" />
                    </svg>
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-gray-900">Sony WH-1000XM4 Wireless Headphones</h4>
                      <div className="mt-1 flex items-center">
                        <span className="text-base font-bold text-success-500">$248.00</span>
                        <span className="ml-2 text-xs line-through text-gray-500">$349.99</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Your target: $250.00</p>
                    </div>
                  </div>
                </div>
                
                <div className="text-center">
                  <button className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-500 hover:bg-primary-600">
                    Buy Now on Amazon
                  </button>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Timely Notifications</h3>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary-100 text-primary-500 flex items-center justify-center mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </div>
                  <p className="ml-3 text-base text-gray-700">
                    <strong className="font-medium text-gray-900">Instant price drop alerts</strong> - Get notified as soon as prices fall below your target
                  </p>
                </li>
                <li className="flex items-start">
                  <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary-100 text-primary-500 flex items-center justify-center mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </div>
                  <p className="ml-3 text-base text-gray-700">
                    <strong className="font-medium text-gray-900">Detailed product information</strong> - See exactly how much you'll save at a glance
                  </p>
                </li>
                <li className="flex items-start">
                  <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary-100 text-primary-500 flex items-center justify-center mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </div>
                  <p className="ml-3 text-base text-gray-700">
                    <strong className="font-medium text-gray-900">One-click purchasing</strong> - Buy directly through our affiliate links when the price is right
                  </p>
                </li>
                <li className="flex items-start">
                  <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary-100 text-primary-500 flex items-center justify-center mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </div>
                  <p className="ml-3 text-base text-gray-700">
                    <strong className="font-medium text-gray-900">Price history insights</strong> - Make informed decisions with historical pricing data
                  </p>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NotificationDemo;
