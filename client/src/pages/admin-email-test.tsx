
/**
 * Email System: Admin Email Testing UI
 * - Entry point: Admin navigates to /admin/email-test
 * - Output: Sends API requests to server/routes/adminEmail.ts
 * - Dependencies: Admin auth token, React Query for template loading
 * - Future: Add email scheduling, bulk sending, template editing, delivery status
 */

import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Send, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/AdminLayout";
import { AdminAuth } from "@/lib/admin-auth";

interface Template {
  id: string;
  name: string;
  description: string;
}

interface EmailPreview {
  subject: string;
  html: string;
}

interface TestResult {
  success: boolean;
  messageId?: string;
  linkVerified: boolean;
  linkUrl?: string;
  timestamp: string;
  error?: string;
}

/**
 * API Helper Functions
 * These call the admin email routes with proper authentication headers
 */

// Loads available email templates for dropdown
const getEmailTemplates = async (token: string): Promise<Template[]> => {
  const response = await fetch('/api/admin/email-templates', {
    headers: { 'x-admin-token': token }
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}: Failed to load templates`);
  }
  
  return response.json();
};

// Gets rendered template HTML for preview iframe
const getEmailPreview = async (id: string, token: string): Promise<EmailPreview> => {
  const response = await fetch(`/api/admin/email/preview/${id}`, {
    headers: { 'x-admin-token': token }
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to preview template');
  }
  
  return response.json();
};

// Sends actual test email via SendGrid
const sendTestEmail = async (data: { email: string; templateId: string; data?: any }, token: string) => {
  const response = await fetch('/api/admin/send-test-email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': token
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}: Failed to send test email`);
  }
  
  return response.json();
};

const verifyEmailLinks = async (html: string, token: string): Promise<{ verified: boolean; links: string[] }> => {
  const response = await fetch('/api/admin/verify-email-links', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': token
    },
    body: JSON.stringify({ html })
  });
  
  if (!response.ok) {
    throw new Error('Failed to verify email links');
  }
  
  return response.json();
};

export default function AdminEmailTest() {
  const { toast } = useToast();
  
  // Email form state
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [previewData, setPreviewData] = useState<EmailPreview | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);

  // Preview iframe ref
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Load templates using React Query
  const { data: templates = [], isLoading: isLoadingTemplates, error: templatesError } = useQuery<Template[]>({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const adminToken = AdminAuth.getToken();
      if (!adminToken) {
        throw new Error('No admin token available');
      }
      return getEmailTemplates(adminToken);
    },
    enabled: !!AdminAuth.getToken(),
    retry: 2,
    retryDelay: 1000,
  });

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
      const adminToken = AdminAuth.getToken();
      if (!adminToken) {
        throw new Error('No admin token available');
      }

      const preview = await getEmailPreview(selectedTemplate, adminToken);
      setPreviewData(preview);
    } catch (error) {
      console.error('Preview failed:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to preview template",
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
    setIsVerifying(true);
    
    try {
      const adminToken = AdminAuth.getToken();
      if (!adminToken) {
        throw new Error('No admin token available');
      }

      // First send the email
      const result = await sendTestEmail({
        email: testEmail,
        templateId: selectedTemplate
      }, adminToken);

      // Then verify links if we have preview data
      let linkVerified = false;
      let verifiedLinks: string[] = [];
      
      if (previewData?.html) {
        try {
          const verification = await verifyEmailLinks(previewData.html, adminToken);
          linkVerified = verification.verified;
          verifiedLinks = verification.links;
        } catch (verifyError) {
          console.warn('Link verification failed:', verifyError);
        }
      }

      // Create test result
      const testResult: TestResult = {
        success: true,
        messageId: result.messageId,
        linkVerified,
        linkUrl: verifiedLinks.length > 0 ? verifiedLinks[0] : undefined,
        timestamp: new Date().toISOString(),
      };

      setTestResults(prev => [testResult, ...prev]);
      
      toast({
        title: "Success",
        description: `Test email sent to ${testEmail}${linkVerified ? ' - Links verified ✓' : ''}`,
      });

    } catch (error) {
      console.error('Send failed:', error);
      
      const testResult: TestResult = {
        success: false,
        linkVerified: false,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Failed to send test email"
      };

      setTestResults(prev => [testResult, ...prev]);
      
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send test email",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
      setIsVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Email Testing Center</h1>
        <p className="text-muted-foreground">Test and preview email templates for BytSave notifications</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Email Template Testing</CardTitle>
            <CardDescription>Preview and send test emails with link verification</CardDescription>
          </CardHeader>
          <CardContent>
            {templatesError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-700 text-sm">
                  Error loading templates: {templatesError instanceof Error ? templatesError.message : 'Unknown error'}
                </p>
              </div>
            )}
            
            <form onSubmit={handleSendTestEmail} className="space-y-4">
              <div>
                <Label htmlFor="template">Email Template</Label>
                <Select 
                  value={selectedTemplate} 
                  onValueChange={(value) => {
                    setSelectedTemplate(value);
                    setPreviewData(null);
                  }}
                  disabled={isLoadingTemplates}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      isLoadingTemplates 
                        ? "Loading templates..." 
                        : templates.length === 0 
                          ? "No templates available"
                          : "Select a template (magic link, reset, promo)"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        <div>
                          <div className="font-medium">{template.name}</div>
                          <div className="text-sm text-gray-500">{template.description}</div>
                        </div>
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
                  disabled={!selectedTemplate || isLoadingTemplates}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Preview
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting || !selectedTemplate || !testEmail || isLoadingTemplates}
                >
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Send className="mr-2 h-4 w-4" />
                  {isVerifying ? 'Verifying Links...' : 'Send & Verify Email'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Email Preview</CardTitle>
            <CardDescription>
              {previewData ? `Subject: ${previewData.subject}` : 'Live preview of the selected template'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {previewData ? (
              <div className="border rounded-lg overflow-hidden">
                <iframe
                  ref={iframeRef}
                  srcDoc={previewData.html}
                  className="w-full h-[400px]"
                  sandbox="allow-same-origin"
                />
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-lg h-[400px] flex items-center justify-center text-gray-500">
                {isLoadingTemplates ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading templates...
                  </div>
                ) : (
                  "Select a template and click \"Preview\" to see the email"
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Test Results Panel */}
        {testResults.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Test Results & Admin Logs</CardTitle>
              <CardDescription>Recent email test results with link verification</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {testResults.map((result, index) => (
                  <div 
                    key={index}
                    className={`border rounded-lg p-4 ${
                      result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${
                          result.success ? 'bg-green-500' : 'bg-red-500'
                        }`} />
                        <span className="font-medium">
                          {result.success ? 'Email Sent Successfully' : 'Email Send Failed'}
                        </span>
                        {result.linkVerified && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            Links Verified ✓
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-gray-500">
                        {new Date(result.timestamp).toLocaleString()}
                      </span>
                    </div>
                    
                    {result.messageId && (
                      <p className="text-sm text-gray-600 mb-1">
                        <strong>Message ID:</strong> {result.messageId}
                      </p>
                    )}
                    
                    {result.linkUrl && (
                      <p className="text-sm text-gray-600 mb-1">
                        <strong>Verified Link:</strong> 
                        <span className={`ml-1 ${
                          result.linkUrl.includes('bytsave.com') ? 'text-green-600' : 'text-orange-600'
                        }`}>
                          {result.linkUrl}
                        </span>
                      </p>
                    )}
                    
                    {result.error && (
                      <p className="text-sm text-red-600">
                        <strong>Error:</strong> {result.error}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
