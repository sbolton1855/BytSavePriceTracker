import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Loader2 } from "lucide-react";

const Navbar: React.FC = () => {
  const [location] = useLocation();
  const { user, isLoading, isAuthenticated } = useAuth();

  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/">
              <div className="flex-shrink-0 flex items-center cursor-pointer">
                <img src="/attached_assets/ChatGPT Image Jun 3, 2025, 07_43_07 PM.png" alt="BytSave Logo" className="h-8 w-auto mr-2" />
                <span className="text-2xl font-semibold text-gray-800">Byt<span className="text-primary-500">Save</span></span>
              </div>
            </Link>
          </div>
          <div className="flex items-center">
            <Link href="/">
              <div className={`text-gray-600 hover:text-primary-500 px-3 py-2 rounded-md text-sm font-medium cursor-pointer ${location === "/" ? "text-primary-500" : ""}`}>
                Home
              </div>
            </Link>
            <Link href="/dashboard">
              <div className={`text-gray-600 hover:text-primary-500 px-3 py-2 rounded-md text-sm font-medium cursor-pointer ${location === "/dashboard" ? "text-primary-500" : ""}`}>
                Dashboard
              </div>
            </Link>
            <Link href="/how-it-works">
              <div className={`text-gray-600 hover:text-primary-500 px-3 py-2 rounded-md text-sm font-medium cursor-pointer ${location === "/how-it-works" ? "text-primary-500" : ""}`}>
                How It Works
              </div>
            </Link>
            <Link href="/faq">
              <div className={`text-gray-600 hover:text-primary-500 px-3 py-2 rounded-md text-sm font-medium cursor-pointer ${location === "/faq" ? "text-primary-500" : ""}`}>
                FAQ
              </div>
            </Link>
            {/* <Link href="/admin/api-monitor">
              <div className={`text-gray-600 hover:text-primary-500 px-3 py-2 rounded-md text-sm font-medium cursor-pointer ${location === "/admin/api-monitor" ? "text-primary-500" : ""}`}>
                Analytics
              </div>
            </Link> */}
            {/* Diagnostics Button */}
            {/* <a
              href="/api/paapi-diagnostics"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-primary-500 px-3 py-2 rounded-md text-sm font-medium cursor-pointer"
              style={{ display: 'inline-block' }}
            >
              Diagnostics
            </a> */}
            {isLoading ? (
              <Button className="ml-3" variant="ghost" disabled>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </Button>
            ) : isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="ml-3 focus:outline-none">
                  <Avatar className="h-8 w-8">
                    {user && user.profileImageUrl && (
                      <AvatarImage src={user.profileImageUrl} alt={(user && (user.firstName || user.email) || "User") as string} />
                    )}
                    <AvatarFallback>
                      {user && user.email ? user.email[0].toUpperCase() : "U"}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard">Dashboard</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a href="/api/logout">Logout</a>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href="/auth">
                <Button className="ml-3">
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
