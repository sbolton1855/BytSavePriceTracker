import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";

const Navbar: React.FC = () => {
  const [location] = useLocation();

  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-500 mr-2">
                <path d="M4 7v6a4 4 0 0 0 4 4h10a2 2 0 0 0 2-2v-6a4 4 0 0 0-4-4H6a2 2 0 0 0-2 2Z"/>
                <path d="M5 11h4"/>
                <path d="M8 8v6"/>
                <path d="M9 12a3 3 0 0 0 3 3h5l2-2v-6"/>
                <path d="M19 10h-5a2 2 0 0 0-2 2"/>
              </svg>
              <span className="text-2xl font-semibold text-gray-800">Byt<span className="text-primary-500">Save</span></span>
            </div>
          </div>
          <div className="flex items-center">
            <Link href="/">
              <a className={`text-gray-600 hover:text-primary-500 px-3 py-2 rounded-md text-sm font-medium ${location === "/" ? "text-primary-500" : ""}`}>
                Home
              </a>
            </Link>
            <Link href="/dashboard">
              <a className={`text-gray-600 hover:text-primary-500 px-3 py-2 rounded-md text-sm font-medium ${location === "/dashboard" ? "text-primary-500" : ""}`}>
                Dashboard
              </a>
            </Link>
            <Link href="/how-it-works">
              <a className={`text-gray-600 hover:text-primary-500 px-3 py-2 rounded-md text-sm font-medium ${location === "/how-it-works" ? "text-primary-500" : ""}`}>
                How It Works
              </a>
            </Link>
            <Button className="ml-3">
              Sign In
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
