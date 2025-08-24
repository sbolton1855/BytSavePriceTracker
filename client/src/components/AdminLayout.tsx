
import React, { useState, useEffect } from 'react';
import { AdminAuth } from '@/lib/admin-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Shield, LogOut, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export default function AdminLayout({ children, title = "Admin Panel", description = "Administrative controls and tools" }: AdminLayoutProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [adminToken, setAdminToken] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const { toast } = useToast();

  // Check authentication on mount
  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    setIsLoading(true);
    const authenticated = await AdminAuth.isAuthenticated();
    setIsAuthenticated(authenticated);
    setIsLoading(false);
  };

  const handleLogin = async () => {
    if (!adminToken.trim()) {
      toast({
        title: "Token Required",
        description: "Please enter your admin token",
        variant: "destructive",
      });
      return;
    }

    setIsValidating(true);
    const success = await AdminAuth.login(adminToken.trim());
    
    if (success) {
      setIsAuthenticated(true);
      setAdminToken('');
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
    }
    setIsValidating(false);
  };

  const handleLogout = () => {
    AdminAuth.logout();
    setIsAuthenticated(false);
    setAdminToken('');
    toast({
      title: "Logged Out",
      description: "You have been logged out of the admin panel",
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isValidating) {
      handleLogin();
    }
  };

  if (isLoading) {
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
              <Input
                type="password"
                placeholder="Enter ADMIN_SECRET token"
                value={adminToken}
                onChange={(e) => setAdminToken(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isValidating}
              />
              <Button 
                onClick={handleLogin} 
                disabled={!adminToken.trim() || isValidating}
                className="w-full"
              >
                {isValidating ? (
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
