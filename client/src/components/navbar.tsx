import { Link, useLocation } from "wouter";
import { Button } from "./ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { Loader2, Menu } from "lucide-react";
import { useState } from "react";
import BytSaveLogo from "@/assets/BytSaveLogo.png";

const Navbar: React.FC = () => {
  const [location] = useLocation();
  const { user, isLoading, isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const NavLinks = () => (
    <>
      <Link href="/">
        <div
          className={`text-gray-600 hover:text-primary-500 px-3 py-2 rounded-md text-sm font-medium cursor-pointer ${location === "/" ? "text-primary-500" : ""}`}
          onClick={() => setIsOpen(false)}
        >
          Home
        </div>
      </Link>
      <Link href="/dashboard">
        <div
          className={`text-gray-600 hover:text-primary-500 px-3 py-2 rounded-md text-sm font-medium cursor-pointer ${location === "/dashboard" ? "text-primary-500" : ""}`}
          onClick={() => setIsOpen(false)}
        >
          Dashboard
        </div>
      </Link>
      <Link href="/how-it-works">
        <div
          className={`text-gray-600 hover:text-primary-500 px-3 py-2 rounded-md text-sm font-medium cursor-pointer ${location === "/how-it-works" ? "text-primary-500" : ""}`}
          onClick={() => setIsOpen(false)}
        >
          How It Works
        </div>
      </Link>
      <Link href="/faq">
        <div
          className={`text-gray-600 hover:text-primary-500 px-3 py-2 rounded-md text-sm font-medium cursor-pointer ${location === "/faq" ? "text-primary-500" : ""}`}
          onClick={() => setIsOpen(false)}
        >
          FAQ
        </div>
      </Link>
    </>
  );

  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/">
              <div className="flex-shrink-0 flex items-center cursor-pointer">
                <img
                  src={BytSaveLogo}
                  alt="BytSave Logo"
                  className="h-20 md:h-32 w-auto mr-0"
                />
                <span className="text-2xl md:text-4xl font-semibold text-gray-800">
                  Byt<span className="text-primary-500">Save</span>
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            <NavLinks />
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
                      <AvatarImage
                        src={user.profileImageUrl}
                        alt={
                          ((user && (user.firstName || user.email)) ||
                            "User") as string
                        }
                      />
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
                <Button className="ml-3">Sign In</Button>
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            {isLoading ? (
              <Button variant="ghost" disabled className="mr-2">
                <Loader2 className="h-4 w-4 animate-spin" />
              </Button>
            ) : isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="mr-2 focus:outline-none">
                  <Avatar className="h-8 w-8">
                    {user && user.profileImageUrl && (
                      <AvatarImage
                        src={user.profileImageUrl}
                        alt={
                          ((user && (user.firstName || user.email)) ||
                            "User") as string
                        }
                      />
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
                <Button className="mr-2" size="sm">Sign In</Button>
              </Link>
            )}
            
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="p-2">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <div className="flex flex-col space-y-4 mt-8">
                  <NavLinks />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
