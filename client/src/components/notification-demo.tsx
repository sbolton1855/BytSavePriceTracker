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
          <div className="grid md:grid-cols-1 gap-6 lg:gap-12 items-center">
            <div className="max-w-2xl mx-auto">
              <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">Features You'll Love</h3>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary-100 text-primary-500 flex items-center justify-center mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </div>
                  <p className="ml-3 text-base text-gray-700">
                    <strong className="font-medium text-gray-900">Instant alerts</strong> - Get notified when prices fall below your target
                  </p>
                </li>
                <li className="flex items-start">
                  <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary-100 text-primary-500 flex items-center justify-center mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </div>
                  <p className="ml-3 text-base text-gray-700">
                    <strong className="font-medium text-gray-900">Product details</strong> - See exactly how much you'll save
                  </p>
                </li>
                <li className="flex items-start">
                  <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary-100 text-primary-500 flex items-center justify-center mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </div>
                  <p className="ml-3 text-base text-gray-700">
                    <strong className="font-medium text-gray-900">One-click buying</strong> - Purchase through our affiliate links
                  </p>
                </li>
                <li className="flex items-start">
                  <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary-100 text-primary-500 flex items-center justify-center mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </div>
                  <p className="ml-3 text-base text-gray-700">
                    <strong className="font-medium text-gray-900">Price history</strong> - Make decisions with historical data
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
