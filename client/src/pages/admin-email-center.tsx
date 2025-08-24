
import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, Eye, AlertCircle, ChevronLeft, ChevronRight, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from '@/components/ui/textarea';
import AdminLayout from "@/components/AdminLayout";
import AdminSubTabNav from "@/components/AdminSubTabNav";
import { AdminAuth } from "@/lib/admin-auth";

interface EmailLog {
  id: number;
  recipientEmail: string;
  subject: string;
  sentAt: string;
  previewHtml: string;
  createdAt: string;
  status: 'success' | 'fail';
  type: 'price-drop' | 'reset' | 'test' | 'other';
}

interface EmailLogsResponse {
  logs: EmailLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  description?: string;
}

export default function AdminEmailCenter() {
  const { toast } = useToast();

  // Get sub-tab from URL params
  const getSubTabFromUrl = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('sub') || 'templates';
  };

  const [activeSubTab, setActiveSubTab] = useState(getSubTabFromUrl());

  // Update URL when sub-tab changes
  const handleSubTabChange = (subTab: string) => {
    setActiveSubTab(subTab);
    const newUrl = `/admin/email-center?sub=${subTab}`;
    window.history.pushState({}, '', newUrl);
  };

  // Listen for browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      setActiveSubTab(getSubTabFromUrl());
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Form states for different email types
  const [selectedTemplate, setSelectedTemplate] = useState('price-drop');
  const [testEmail, setTestEmail] = useState('');
  const [priceDropForm, setPriceDropForm] = useState({
    asin: 'B01DJGLYZQ',
    productTitle: 'TRUEplus - Insulin Syringes 31g 0.3cc 5/16" (Pack of 100)',
    oldPrice: '22.99',
    newPrice: '15.99'
  });

  const [passwordResetForm, setPasswordResetForm] = useState({
    email: ''
  });

  // Settings state
  const [settings, setSettings] = useState({
    fromAddress: 'alerts@bytsave.com',
    qaSubjectTag: '[QA-TEST]'
  });

  // UI states
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
  const [previewData, setPreviewData] = useState<string>('');
  const [results, setResults] = useState<Record<string, any>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');

  // Mock templates data
  const templates: EmailTemplate[] = [
    { id: 'price-drop', name: 'Price Drop Alert', subject: 'Price Drop Alert: {{productTitle}}', description: 'Notify users when product prices drop' },
    { id: 'password-reset', name: 'Password Reset', subject: 'Reset Your Password', description: 'Password reset email template' },
    { id: 'welcome', name: 'Welcome Email', subject: 'Welcome to BytSave!', description: 'Welcome new users' }
  ];

  // Query for email logs
  const { data: emailLogs, isLoading: logsLoading, refetch: refetchLogs } = useQuery<EmailLogsResponse>({
    queryKey: ['admin-email-logs', currentPage, statusFilter, typeFilter],
    queryFn: async () => {
      const token = AdminAuth.getToken();
      if (!token) {
        toast({ title: "Unauthorized", description: "Invalid admin token.", variant: "destructive" });
        return { logs: [], total: 0, page: 1, pageSize: 20, totalPages: 1 };
      }

      const params = new URLSearchParams({
        token: token,
        page: currentPage.toString(),
        pageSize: '20',
        ...(statusFilter && { status: statusFilter }),
        ...(typeFilter && { type: typeFilter })
      });

      const response = await fetch(`/api/admin/logs?${params}`);
      if (!response.ok) {
        if (response.status === 403) {
          toast({ title: "Unauthorized", description: "Invalid admin token.", variant: "destructive" });
          AdminAuth.clearToken();
        } else {
          toast({ title: "Error", description: "Failed to fetch email logs.", variant: "destructive" });
        }
        throw new Error('Failed to fetch email logs');
      }
      return response.json();
    },
    enabled: activeSubTab === 'logs' && AdminAuth.getToken() !== null,
  });

  // Template preview handler
  const handleTemplatePreview = async (templateId: string) => {
    const token = AdminAuth.getToken();
    if (!token) {
      toast({ title: "Authentication Required", description: "Please authenticate first", variant: "destructive" });
      return;
    }

    setIsLoading(prev => ({ ...prev, [`${templateId}_preview`]: true }));
    try {
      let response;
      
      if (templateId === 'price-drop') {
        response = await fetch(`/api/dev/preview-email?token=${token}&asin=${priceDropForm.asin}&productTitle=${encodeURIComponent(priceDropForm.productTitle)}&oldPrice=${priceDropForm.oldPrice}&newPrice=${priceDropForm.newPrice}`);
      } else if (templateId === 'password-reset') {
        const params = new URLSearchParams({
          email: passwordResetForm.email || 'test@example.com',
          token: token
        });
        response = await fetch(`/api/admin/test-reset?${params}`);
      } else {
        // Generic template preview
        response = await fetch(`/api/admin/email/preview/${templateId}`, {
          headers: {
            'x-admin-token': token
          }
        });
      }

      if (!response.ok) {
        if (response.status === 403) {
          toast({ title: "Unauthorized", description: "Invalid admin token.", variant: "destructive" });
          AdminAuth.clearToken();
          return;
        }
        throw new Error('Failed to preview template');
      }

      let htmlContent;
      if (templateId === 'password-reset') {
        const result = await response.json();
        htmlContent = result.previewHtml || '';
      } else if (templateId === 'price-drop') {
        htmlContent = await response.text();
      } else {
        const result = await response.json();
        htmlContent = result.html || '';
      }

      setPreviewData(htmlContent);
      toast({ title: "Success", description: "Template preview generated" });
    } catch (error) {
      console.error('Template preview error:', error);
      toast({ title: "Error", description: "Failed to preview template", variant: "destructive" });
    } finally {
      setIsLoading(prev => ({ ...prev, [`${templateId}_preview`]: false }));
    }
  };

  // Send test email handler
  const handleSendTestEmail = async () => {
    const token = AdminAuth.getToken();
    if (!token || !testEmail) {
      toast({ title: "Error", description: "Please provide email address and authenticate", variant: "destructive" });
      return;
    }

    setIsLoading(prev => ({ ...prev, 'send_test': true }));
    try {
      let response;

      if (selectedTemplate === 'price-drop') {
        response = await fetch(`/api/dev/preview-email?asin=${priceDropForm.asin}&productTitle=${encodeURIComponent(priceDropForm.productTitle)}&oldPrice=${priceDropForm.oldPrice}&newPrice=${priceDropForm.newPrice}&email=${encodeURIComponent(testEmail)}&send=true&token=${token}`);
      } else if (selectedTemplate === 'password-reset') {
        const params = new URLSearchParams({
          email: testEmail,
          token: token,
          send: 'true'
        });
        response = await fetch(`/api/admin/test-reset?${params}`);
      } else {
        response = await fetch('/api/admin/send-test-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-token': token
          },
          body: JSON.stringify({
            email: testEmail,
            templateId: selectedTemplate
          })
        });
      }

      if (!response.ok) {
        if (response.status === 403) {
          toast({ title: "Unauthorized", description: "Invalid admin token.", variant: "destructive" });
          AdminAuth.clearToken();
          return;
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send test email');
      }

      const data = await response.json();
      toast({ title: "Success", description: data.message || "Test email sent successfully!" });
      setResults(prev => ({ ...prev, 'send_test': data }));
      
      // Refresh logs if on logs tab
      if (activeSubTab === 'logs') {
        refetchLogs();
      }
    } catch (error) {
      console.error('Send test email error:', error);
      toast({ title: "Error", description: error.message || "Failed to send test email", variant: "destructive" });
    } finally {
      setIsLoading(prev => ({ ...prev, 'send_test': false }));
    }
  };

  // Function to render status badge
  const renderStatusBadge = (status: EmailLog['status']) => {
    return status === 'success' ? (
      <Badge variant="secondary" className="flex items-center gap-1 bg-green-100 text-green-800">
        <CheckCircle className="h-3 w-3" /> Success
      </Badge>
    ) : (
      <Badge variant="destructive" className="flex items-center gap-1">
        <XCircle className="h-3 w-3" /> Fail
      </Badge>
    );
  };

  // Function to handle pagination
  const handlePageChange = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    } else if (direction === 'next' && emailLogs && currentPage < emailLogs.totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  // Render sub-tab content
  const renderSubTabContent = () => {
    switch (activeSubTab) {
      case 'templates':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Template List */}
              <Card>
                <CardHeader>
                  <CardTitle>Email Templates</CardTitle>
                  <CardDescription>Select a template to preview</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {templates.map((template) => (
                    <div key={template.id} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-medium">{template.name}</h3>
                          <p className="text-sm text-gray-600">{template.description}</p>
                          <p className="text-sm text-gray-500 mt-1">Subject: {template.subject}</p>
                        </div>
                        <Button
                          onClick={() => handleTemplatePreview(template.id)}
                          variant="outline"
                          size="sm"
                          disabled={isLoading[`${template.id}_preview`]}
                        >
                          {isLoading[`${template.id}_preview`] && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          <Eye className="mr-2 h-4 w-4" />
                          Preview
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Template Data Forms */}
              <Card>
                <CardHeader>
                  <CardTitle>Template Data</CardTitle>
                  <CardDescription>Configure template variables for preview</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Price Drop Form */}
                  <div className="space-y-3">
                    <h4 className="font-medium">Price Drop Template Data</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="asin">ASIN</Label>
                        <Input
                          id="asin"
                          value={priceDropForm.asin}
                          onChange={(e) => setPriceDropForm(prev => ({ ...prev, asin: e.target.value }))}
                          placeholder="B08N5WRWNW"
                        />
                      </div>
                      <div>
                        <Label htmlFor="oldPrice">Old Price</Label>
                        <Input
                          id="oldPrice"
                          type="number"
                          step="0.01"
                          value={priceDropForm.oldPrice}
                          onChange={(e) => setPriceDropForm(prev => ({ ...prev, oldPrice: e.target.value }))}
                          placeholder="29.99"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="productTitle">Product Title</Label>
                      <Input
                        id="productTitle"
                        value={priceDropForm.productTitle}
                        onChange={(e) => setPriceDropForm(prev => ({ ...prev, productTitle: e.target.value }))}
                        placeholder="Test Product Name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="newPrice">New Price</Label>
                      <Input
                        id="newPrice"
                        type="number"
                        step="0.01"
                        value={priceDropForm.newPrice}
                        onChange={(e) => setPriceDropForm(prev => ({ ...prev, newPrice: e.target.value }))}
                        placeholder="19.99"
                      />
                    </div>
                  </div>

                  {/* Password Reset Form */}
                  <div className="space-y-3 border-t pt-4">
                    <h4 className="font-medium">Password Reset Template Data</h4>
                    <div>
                      <Label htmlFor="resetEmail">Test Email</Label>
                      <Input
                        id="resetEmail"
                        type="email"
                        value={passwordResetForm.email}
                        onChange={(e) => setPasswordResetForm(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="test@example.com"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Preview */}
            {previewData && (
              <Card>
                <CardHeader>
                  <CardTitle>Template Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <iframe
                    srcDoc={previewData}
                    className="w-full h-96 border rounded"
                    title="Email Template Preview"
                  />
                </CardContent>
              </Card>
            )}
          </div>
        );

      case 'send':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Send Test Email</CardTitle>
              <CardDescription>Send test emails using available templates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="template">Email Template</Label>
                  <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select template" />
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
                  <Label htmlFor="testEmailAddress">Recipient Email</Label>
                  <Input
                    id="testEmailAddress"
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="test@example.com"
                  />
                </div>
              </div>

              <Button
                onClick={handleSendTestEmail}
                disabled={isLoading.send_test || !testEmail || !selectedTemplate}
              >
                {isLoading.send_test && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Send className="mr-2 h-4 w-4" />
                Send Test Email
              </Button>

              {/* Send Results */}
              {results.send_test && (
                <div className="mt-6">
                  <Label>Send Result</Label>
                  <Textarea
                    value={JSON.stringify(results.send_test, null, 2)}
                    readOnly
                    className="mt-2 h-24"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 'logs':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Email Logs</CardTitle>
              <CardDescription>View history of sent emails</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filters and Refresh */}
              <div className="flex justify-between items-center mb-4">
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="statusFilter">Status:</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All</SelectItem>
                        <SelectItem value="success">Success</SelectItem>
                        <SelectItem value="fail">Fail</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="typeFilter">Type:</Label>
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All</SelectItem>
                        <SelectItem value="price-drop">Price Drop</SelectItem>
                        <SelectItem value="reset">Password Reset</SelectItem>
                        <SelectItem value="test">Generic Test</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={() => {
                  setCurrentPage(1);
                  refetchLogs();
                }} disabled={logsLoading}>
                  {logsLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Refresh
                </Button>
              </div>

              {/* Email Logs Table */}
              {logsLoading ? (
                <div className="flex justify-center items-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : emailLogs && emailLogs.logs.length > 0 ? (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sent At</TableHead>
                        <TableHead>To</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {emailLogs.logs.map(log => (
                        <TableRow key={log.id}>
                          <TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell>
                          <TableCell>{log.recipientEmail}</TableCell>
                          <TableCell className="max-w-xs truncate">{log.subject}</TableCell>
                          <TableCell>{log.type}</TableCell>
                          <TableCell>{renderStatusBadge(log.status)}</TableCell>
                          <TableCell>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Eye className="h-4 w-4 mr-2" />
                                  View
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-[700px]">
                                <DialogHeader>
                                  <DialogTitle>Email Details</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-2 text-sm">
                                  <p><strong>Sent:</strong> {new Date(log.createdAt).toLocaleString()}</p>
                                  <p><strong>To:</strong> {log.recipientEmail}</p>
                                  <p><strong>Subject:</strong> {log.subject}</p>
                                  <p><strong>Status:</strong> {renderStatusBadge(log.status)}</p>
                                  <p><strong>Type:</strong> {log.type}</p>
                                </div>
                                <iframe
                                  srcDoc={log.previewHtml}
                                  className="w-full h-[500px] border rounded mt-4"
                                  title={`Email Preview - ${log.subject}`}
                                />
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  <div className="flex justify-between items-center mt-4">
                    <Button
                      variant="outline"
                      onClick={() => handlePageChange('prev')}
                      disabled={currentPage === 1 || logsLoading}
                    >
                      <ChevronLeft className="h-4 w-4 mr-2" /> Previous
                    </Button>
                    <span>Page {currentPage} of {emailLogs.totalPages}</span>
                    <Button
                      variant="outline"
                      onClick={() => handlePageChange('next')}
                      disabled={currentPage === emailLogs.totalPages || logsLoading}
                    >
                      Next <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex justify-center items-center h-64">
                  <p>No email logs found.</p>
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 'settings':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Email Settings</CardTitle>
              <CardDescription>Configure email system settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="fromAddress">From Address</Label>
                <Input
                  id="fromAddress"
                  value={settings.fromAddress}
                  onChange={(e) => setSettings(prev => ({ ...prev, fromAddress: e.target.value }))}
                  placeholder="alerts@bytsave.com"
                />
                <p className="text-sm text-gray-500 mt-1">Default sender email address</p>
              </div>
              <div>
                <Label htmlFor="qaSubjectTag">QA Subject Tag</Label>
                <Input
                  id="qaSubjectTag"
                  value={settings.qaSubjectTag}
                  onChange={(e) => setSettings(prev => ({ ...prev, qaSubjectTag: e.target.value }))}
                  placeholder="[QA-TEST]"
                />
                <p className="text-sm text-gray-500 mt-1">Tag added to test email subjects</p>
              </div>
              <Button
                onClick={() => toast({ title: "Settings", description: "Settings saved (memory only)" })}
              >
                Save Settings
              </Button>
              <p className="text-sm text-yellow-600">
                Note: Settings are persisted in memory only and will reset on server restart.
              </p>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <AdminLayout
      title="Email Center"
      description="Comprehensive email template testing and management"
    >
      <div className="space-y-6">
        {/* Sub-tab Navigation */}
        <AdminSubTabNav activeSubTab={activeSubTab} onSubTabChange={handleSubTabChange} />

        {/* Sub-tab Content */}
        {renderSubTabContent()}
      </div>
    </AdminLayout>
  );
}
