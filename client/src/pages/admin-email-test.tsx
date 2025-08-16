
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, LogOut } from "lucide-react";

interface Template {
  id: string;
  name: string;
  description: string;
}

interface AdminSession {
  email: string;
  roles: string[];
}

export default function AdminEmailTest() {
  const { toast } = useToast();
  
  // Login state
  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  });
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [adminSession, setAdminSession] = useState<AdminSession | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Email form state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // CSRF token
  const [csrfToken, setCsrfToken] = useState('');

  // Check if already authenticated on load
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/admin/api/me', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const session = await response.json();
        setAdminSession(session);
        setIsLoggedIn(true);
        loadTemplates();
        // Get CSRF token
        const csrfResponse = await fetch('/admin/api/csrf-token', {
          credentials: 'include'
        });
        if (csrfResponse.ok) {
          const { csrfToken } = await csrfResponse.json();
          setCsrfToken(csrfToken);
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);

    try {
      const response = await fetch('/admin/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(loginData)
      });

      const result = await response.json();

      if (response.ok) {
        setAdminSession(result.admin);
        setIsLoggedIn(true);
        setCsrfToken(result.csrfToken);
        loadTemplates();
        toast({
          title: "Login successful",
          description: `Welcome back, ${result.admin.email}!`
        });
      } else {
        toast({
          title: "Login failed",
          description: result.error || 'Invalid credentials',
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Login error",
        description: 'Failed to connect to server',
        variant: "destructive"
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/admin/api/logout', {
        method: 'POST',
        credentials: 'include'
      });
      
      setIsLoggedIn(false);
      setAdminSession(null);
      setTemplates([]);
      setPreviewHtml('');
      setCsrfToken('');
      
      toast({
        title: "Logged out",
        description: "You have been logged out successfully"
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const loadTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const response = await fetch('/admin/api/email/templates', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates);
      } else {
        toast({
          title: "Error",
          description: "Failed to load email templates",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to connect to server",
        variant: "destructive"
      });
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const handlePreviewTemplate = async () => {
    if (!selectedTemplate) return;

    try {
      const response = await fetch(`/admin/api/email/preview/${selectedTemplate}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setPreviewHtml(data.previewHtml);
      } else {
        toast({
          title: "Error",
          description: "Failed to load template preview",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load preview",
        variant: "destructive"
      });
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate || !csrfToken) return;

    setIsSubmitting(true);

    try {
      const response = await fetch('/admin/api/email/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify({
          templateId: selectedTemplate,
          to: testEmail || undefined
        })
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: "Test email sent!",
          description: result.message
        });
      } else {
        toast({
          title: "Failed to send email",
          description: result.error || 'Unknown error',
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send test email",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
        <p>Checking authentication...</p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Admin Login</CardTitle>
              <CardDescription>Login to access email testing tools</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={loginData.email}
                    onChange={(e) => setLoginData(prev => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={loginData.password}
                    onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoggingIn}>
                  {isLoggingIn && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Login
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Admin Email Test</h1>
          <p className="text-gray-600">Logged in as: {adminSession?.email}</p>
        </div>
        <Button variant="outline" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Email Template Testing</CardTitle>
            <CardDescription>Preview and send test emails</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSendTestEmail} className="space-y-4">
              <div>
                <Label htmlFor="template">Email Template</Label>
                <Select 
                  value={selectedTemplate} 
                  onValueChange={(value) => {
                    setSelectedTemplate(value);
                    setPreviewHtml('');
                  }}
                  disabled={isLoadingTemplates}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedTemplate && (
                <div>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handlePreviewTemplate}
                    className="w-full mb-4"
                  >
                    Preview Template
                  </Button>
                </div>
              )}

              <div>
                <Label htmlFor="testEmail">Test Email (optional)</Label>
                <Input
                  id="testEmail"
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder={`Leave empty to use ${adminSession?.email}`}
                />
              </div>

              <Button 
                type="submit" 
                className="w-full"
                disabled={!selectedTemplate || isSubmitting}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Test Email
              </Button>
            </form>
          </CardContent>
        </Card>
        
        {previewHtml && (
          <Card>
            <CardHeader>
              <CardTitle>Email Preview</CardTitle>
              <CardDescription>How the email will look</CardDescription>
            </CardHeader>
            <CardContent>
              <div 
                className="border rounded p-4 bg-white max-h-96 overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
