import React, { useState, useEffect, ReactNode } from 'react';
import { AdminAuth } from '@/lib/admin-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Shield, LogOut, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';

interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export default function AdminLayout({ children, title = "Admin Panel", description = "Administrative controls and tools" }: AdminLayoutProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [adminToken, setAdminToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = AdminAuth.getToken(); // Assuming AdminAuth.getToken() retrieves the token from storage
      if (token) {
        const isValid = await AdminAuth.isAuthenticated(); // Assuming AdminAuth.isAuthenticated() validates the token server-side or via a stored flag
        setIsAuthenticated(isValid);
      } else {
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken.trim()) {
      toast({
        title: "Token Required",
        description: "Please enter your admin token",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const success = await AdminAuth.login(adminToken.trim()); // Assuming AdminAuth.login() attempts to authenticate and store the token

      if (success) {
        setIsAuthenticated(true);
        setAdminToken(''); // Clear the input field
        toast({
          title: "Authentication Successful",
          description: "Welcome to the admin panel",
        });
      } else {
        toast({
          title: "Authentication Failed",
          description: "Invalid admin token. Please try again.",
          variant: "destructive",
        });
        setAdminToken(''); // Clear invalid token
      }
    } catch (error) {
      console.error("Login error:", error);
      toast({
        title: "Authentication Error",
        description: "An unexpected error occurred during authentication.",
        variant: "destructive",
      });
      setAdminToken(''); // Clear token on error
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    AdminAuth.logout(); // Assuming AdminAuth.logout() clears the token and authentication state
    setIsAuthenticated(false);
    setAdminToken('');
    toast({
      title: "Logged Out",
      description: "You have been logged out of the admin panel",
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleLogin(e as any); // Cast to any for form event simulation if needed, or ensure handleLogin accepts KeyboardEvent
    }
  };

  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <Shield className="h-5 w-5" />
                Admin Access Required
              </CardTitle>
              <CardDescription>
                Enter your admin token to access the administrative panel
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleLogin}>
                <div className="space-y-2">
                  <Label htmlFor="admin-token">Admin Token</Label>
                  <Input
                    id="admin-token"
                    type="password"
                    placeholder="Enter ADMIN_SECRET token"
                    value={adminToken}
                    onChange={(e) => setAdminToken(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={isLoading}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={!adminToken.trim() || isLoading}
                  className="w-full mt-4"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    <>
                      <Shield className="mr-2 h-4 w-4" />
                      Access Admin Panel
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
              {description && (
                <p className="text-sm text-gray-600">{description}</p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Admin Content */}
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}