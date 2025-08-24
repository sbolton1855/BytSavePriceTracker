
import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Send, Eye, AlertCircle, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from '@/components/ui/textarea';
import AdminLayout from "@/components/AdminLayout";
import { AdminAuth } from "@/lib/admin-auth";

interface Template {
  id: string;
  name: string;
  description: string;
  subject: string;
  previewData: Record<string, any>;
}

export default function AdminEmailTest() {
  const { toast } = useToast();
  
  // Check authentication status
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Email form state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Preview iframe ref
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Check authentication on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    setIsCheckingAuth(true);
    try {
      const authenticated = await AdminAuth.isAuthenticated();
      setIsAuthenticated(authenticated);
      if (authenticated) {
        loadTemplates();
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAuthenticated(false);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const handleLogout = () => {
    AdminAuth.logout();
    setIsAuthenticated(false);
    toast({ title: "Logged out", description: "You have been logged out successfully" });
  };

  const loadTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const token = AdminAuth.getToken();
      const response = await fetch('/api/admin/email/templates', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load templates');
      }

      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (error) {
      console.error('Failed to load templates:', error);
      toast({
        title: "Error",
        description: "Failed to load email templates",
        variant: "destructive"
      });
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const handlePreviewTemplate = async () => {
    if (!selectedTemplate) {
      toast({
        title: "Error",
        description: "Please select a template first",
        variant: "destructive"
      });
      return;
    }

    try {
      const token = AdminAuth.getToken();
      const response = await fetch('/api/admin/email/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          templateId: selectedTemplate
        })
      });

      if (!response.ok) {
        throw new Error('Failed to preview template');
      }

      const data = await response.json();
      setPreviewHtml(data.html);
    } catch (error) {
      console.error('Preview failed:', error);
      toast({
        title: "Error",
        description: "Failed to preview template",
        variant: "destructive"
      });
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!testEmail || !selectedTemplate) {
      toast({
        title: "Error",
        description: "Please select a template and enter an email address",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const token = AdminAuth.getToken();
      const response = await fetch('/api/admin/email/send-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          templateId: selectedTemplate,
          email: testEmail
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send test email');
      }

      const result = await response.json();
      toast({
        title: "Success",
        description: result.message || "Test email sent successfully"
      });
    } catch (error) {
      console.error('Send failed:', error);
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
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <AdminLayout
        title="Email Testing Center"
        description="Please log in to access email testing tools"
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              Authentication Required
            </CardTitle>
            <CardDescription>
              You need to be logged in as an admin to access this page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.href = '/admin'}>
              Go to Admin Login
            </Button>
          </CardContent>
        </Card>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Email Testing Center"
      description="Test and preview email templates for BytSave notifications"
    >
      <div className="flex justify-end mb-6">
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

              <div>
                <Label htmlFor="testEmail">Test Email Address</Label>
                <Input
                  id="testEmail"
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="admin@example.com"
                  required
                />
              </div>

              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handlePreviewTemplate}
                  disabled={!selectedTemplate}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Preview
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting || !selectedTemplate || !testEmail}
                >
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Send className="mr-2 h-4 w-4" />
                  Send Test Email
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Email Preview</CardTitle>
            <CardDescription>Live preview of the selected template</CardDescription>
          </CardHeader>
          <CardContent>
            {previewHtml ? (
              <div className="border rounded-lg overflow-hidden">
                <iframe
                  ref={iframeRef}
                  srcDoc={previewHtml}
                  className="w-full h-[400px]"
                  sandbox="allow-same-origin"
                />
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-lg h-[400px] flex items-center justify-center text-gray-500">
                Select a template and click "Preview" to see the email
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
