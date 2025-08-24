
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

export default function AdminEmailTest() {
  const { toast } = useToast();
  
  // Email form state
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

      const response = await fetch(`/api/admin/email-templates?token=${encodeURIComponent(adminToken)}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to load templates`);
      }

      const data = await response.json();
      return data.templates || [];
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

      const response = await fetch(`/api/admin/preview/${selectedTemplate}?token=${encodeURIComponent(adminToken)}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to preview template');
      }

      const data = await response.json();
      setPreviewHtml(data.previewHtml);
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
    try {
      const adminToken = AdminAuth.getToken();
      if (!adminToken) {
        throw new Error('No admin token available');
      }

      const response = await fetch('/api/admin/send-test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: testEmail,
          templateId: selectedTemplate,
          token: adminToken
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to send test email`);
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
        description: error instanceof Error ? error.message : "Failed to send test email",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminLayout
      title="Email Testing Center"
      description="Test and preview email templates for BytSave notifications"
    >
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Email Template Testing</CardTitle>
            <CardDescription>Preview and send test emails</CardDescription>
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
                    setPreviewHtml('');
                  }}
                  disabled={isLoadingTemplates}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      isLoadingTemplates 
                        ? "Loading templates..." 
                        : templates.length === 0 
                          ? "No templates available"
                          : "Select a template"
                    } />
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
      </div>
    </AdminLayout>
  );
}
