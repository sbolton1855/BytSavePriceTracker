const Footer: React.FC = () => {
  const navigateTo = (path: string) => {
    window.location.href = path;
  };

  return (
    <footer className="bg-gray-800">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-400 mr-2">
                <path d="M4 7v6a4 4 0 0 0 4 4h10a2 2 0 0 0 2-2v-6a4 4 0 0 0-4-4H6a2 2 0 0 0-2 2Z"/>
                <path d="M5 11h4"/>
                <path d="M8 8v6"/>
                <path d="M9 12a3 3 0 0 0 3 3h5l2-2v-6"/>
                <path d="M19 10h-5a2 2 0 0 0-2 2"/>
              </svg>
              <span className="text-2xl font-semibold text-white">Byt<span className="text-primary-400">Save</span></span>
            </div>
            <p className="mt-2 text-base text-gray-300">
              Track Amazon prices, get alerts, and save money on your favorite products.
            </p>
            <div className="mt-4 flex space-x-6">
              <a href="#" className="text-gray-400 hover:text-gray-300">
                <span className="sr-only">Facebook</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                </svg>
              </a>
              <a href="#" className="text-gray-400 hover:text-gray-300">
                <span className="sr-only">Twitter</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
                </svg>
              </a>
              <a href="#" className="text-gray-400 hover:text-gray-300">
                <span className="sr-only">Instagram</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                </svg>
              </a>
              <a href="#" className="text-gray-400 hover:text-gray-300">
                <span className="sr-only">GitHub</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                  <path d="M9 18c-4.51 2-5-2-7-2" />
                </svg>
              </a>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">Resources</h3>
            <ul className="mt-4 space-y-4">
              <li>
                <div 
                  className="text-base text-gray-300 hover:text-white cursor-pointer"
                  onClick={() => navigateTo('/how-it-works')}
                >
                  How It Works
                </div>
              </li>
              <li>
                <a href="#" className="text-base text-gray-300 hover:text-white">Pricing</a>
              </li>
              <li>
                <a href="#" className="text-base text-gray-300 hover:text-white">FAQ</a>
              </li>
              <li>
                <a href="#" className="text-base text-gray-300 hover:text-white">API Documentation</a>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">Company</h3>
            <ul className="mt-4 space-y-4">
              <li>
                <a href="#" className="text-base text-gray-300 hover:text-white">About</a>
              </li>
              <li>
                <a href="#" className="text-base text-gray-300 hover:text-white">Blog</a>
              </li>
              <li>
                <a href="#" className="text-base text-gray-300 hover:text-white">Contact</a>
              </li>
              <li>
                <a href="#" className="text-base text-gray-300 hover:text-white">Careers</a>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="mt-8 border-t border-gray-700 pt-8 md:flex md:items-center md:justify-between">
          <div className="flex space-x-6 md:order-2">
            <a href="#" className="text-gray-400 hover:text-gray-300 text-sm">Terms</a>
            <a href="#" className="text-gray-400 hover:text-gray-300 text-sm">Privacy</a>
            <a href="#" className="text-gray-400 hover:text-gray-300 text-sm">Cookies</a>
          </div>
          <p className="mt-8 text-base text-gray-400 md:mt-0 md:order-1">
            &copy; {new Date().getFullYear()} BytSave. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
