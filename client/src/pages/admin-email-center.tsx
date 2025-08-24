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
import { AdminAuth, adminApi } from "@/lib/admin-auth";

interface EmailLog {
  id: number;
  to: string;
  recipientEmail?: string;
  templateId?: string;
  subject: string;
  status: 'success' | 'fail' | 'sent' | 'failed';
  isTest: boolean;
  previewHtml?: string;
  meta?: any;
  createdAt: string;
}

interface EmailLogsResponse {
  logs: EmailLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages?: number;
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
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [formData, setFormData] = useState<Record<string, Record<string, any>>>({});

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
  const [results, setResults] = useState<Record<string, any>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);

  // QA Smoke Test states
  const [smokeTestEmail, setSmokeTestEmail] = useState('');
  const [smokeTestTemplate, setSmokeTestTemplate] = useState<string | undefined>('price-drop');
  const [smokeTestStatus, setSmokeTestStatus] = useState<{
    preview: boolean;
    send: boolean;
    log: boolean;
    error?: string;
  }>({ preview: false, send: false, log: false });
  const [isSmokeTestRunning, setIsSmokeTestRunning] = useState(false);

  // Auto-refresh for logs
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);

  // Load templates from API
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const token = AdminAuth.getToken();
        if (!token) return;

        console.log('[admin-email-center] Loading templates...');
        const data = await adminApi.getEmailTemplates();
        console.log('[admin-email-center] Templates loaded:', data);
        
        const templatesList = data.templates || data || [];
        setTemplates(templatesList);

        // Set default template if none selected
        if (!selectedTemplateId && templatesList.length > 0) {
          setSelectedTemplateId(templatesList[0].id);
        }
      } catch (error) {
        console.error('Error loading templates:', error);
        toast({ title: "Error", description: "Failed to load email templates", variant: "destructive" });
      }
    };

    if (activeSubTab === 'templates') {
      loadTemplates();
    }
  }, [activeSubTab, toast]);


  // Query for email logs - MUST be declared before useEffects that reference refetchLogs
  const { data: emailLogs, isLoading: logsLoading, refetch: refetchLogs } = useQuery<EmailLogsResponse>({
    queryKey: ['admin-email-logs', currentPage, statusFilter, typeFilter],
    queryFn: async () => {
      const token = AdminAuth.getToken();
      if (!token) {
        toast({ title: "Unauthorized", description: "Invalid admin token.", variant: "destructive" });
        return { logs: [], total: 0, page: 1, pageSize: 20, totalPages: 1 };
      }

      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: '20',
        ...(statusFilter && statusFilter !== 'all' && { status: statusFilter }),
        ...(typeFilter && typeFilter !== 'all' && { isTest: typeFilter === 'test' ? 'true' : 'false' })
      });

      try {
        const response = await fetch(`/api/admin/email-logs?${params}`, {
          headers: {
            'x-admin-token': token
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[email-logs] fetch failed:', response.status, errorText);

          if (response.status === 403) {
            toast({ title: "Unauthorized", description: "Invalid admin token.", variant: "destructive" });
            AdminAuth.clearToken();
          } else {
            console.error('[email-logs] non-200 response:', response.status, errorText);
            // Don't show error toast for non-200, just return empty
          }

          return { logs: [], total: 0, page: 1, pageSize: 20, totalPages: 1 };
        }

        const data = await response.json();

        // Handle fallback response
        if (data.note === 'fallback_empty_due_to_error') {
          console.log('[email-logs] received fallback response due to server error');
        }

        return {
          logs: data.items || [],
          total: data.total || 0,
          page: data.page || 1,
          pageSize: data.pageSize || 20,
          totalPages: Math.ceil((data.total || 0) / (data.pageSize || 20))
        };
      } catch (error) {
        console.error('[email-logs] fetch error:', error);
        // Don't throw - return empty results to prevent UI crash
        return { logs: [], total: 0, page: 1, pageSize: 20, totalPages: 1 };
      }
    },
    enabled: activeSubTab === 'logs' && AdminAuth.getToken() !== null,
  });

  // Initialize smoke test email when settings change
  useEffect(() => {
    if (!smokeTestEmail && settings.fromAddress !== 'alerts@bytsave.com') {
      setSmokeTestEmail(settings.fromAddress);
    }
  }, [settings.fromAddress, smokeTestEmail]);

  // Auto-refresh logs when on logs tab
  useEffect(() => {
    if (activeSubTab !== 'logs' || !autoRefreshEnabled) return;

    const interval = setInterval(() => {
      refetchLogs();
    }, 5000);

    return () => clearInterval(interval);
  }, [activeSubTab, autoRefreshEnabled, refetchLogs]);

  // Enable auto-refresh when entering logs tab
  useEffect(() => {
    if (activeSubTab === 'logs') {
      setAutoRefreshEnabled(true);
    } else {
      setAutoRefreshEnabled(false);
    }
  }, [activeSubTab]);

  // Auto-preview when template is selected in templates tab
  useEffect(() => {
    if (activeSubTab === 'templates' && selectedTemplateId && templates.length > 0) {
      // Initialize form data with template defaults if not already set
      const template = templates.find(t => t.id === selectedTemplateId);
      if (template && template.defaults && !formData[selectedTemplateId]) {
        console.log('[admin-email-center] Initializing form data for template:', selectedTemplateId, template.defaults);
        setFormData(prev => ({
          ...prev,
          [selectedTemplateId]: { ...template.defaults }
        }));
      }
      handlePreview();
    }
  }, [activeSubTab, selectedTemplateId, templates]);

  // Template preview handler
  const handlePreview = async () => {
    if (!selectedTemplateId) return;

    try {
      setPreviewLoading(true);

      // Get current form data for the selected template
      const currentFormData = formData[selectedTemplateId] || {};

      // Use POST method with form data
      const response = await adminApi.previewTemplatePOST(selectedTemplateId, currentFormData);

      setPreviewContent(response.html);
      toast({ title: "Success", description: "Template preview loaded" });
    } catch (error) {
      console.error('Preview error:', error);
      toast({ title: "Error", description: "Failed to preview template", variant: "destructive" });
    } finally {
      setPreviewLoading(false);
    }
  };

  // Send test email handler
  const handleSendTestEmail = async () => {
    const token = AdminAuth.getToken();
    if (!token || !testEmail || !selectedTemplateId) {
      toast({ title: "Error", description: "Please provide recipient email and select a template", variant: "destructive" });
      return;
    }

    setSendLoading(true);
    try {
      // Get current form data for the selected template
      const currentFormData = formData[selectedTemplateId] || {};
      const emailData = {
        to: testEmail,
        templateId: selectedTemplateId,
        data: currentFormData
      };

      const response = await adminApi.sendTestEmailPOST(emailData);

      toast({ title: "Success", description: response.message || "Test email sent successfully!" });
      setResults(prev => ({ ...prev, 'send_test': response }));

      // Refresh logs if on logs tab
      if (activeSubTab === 'logs') {
        refetchLogs();
      }
    } catch (error) {
      console.error('Send test email error:', error);
      toast({ title: "Error", description: error.message || "Failed to send test email", variant: "destructive" });
    } finally {
      setSendLoading(false);
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

  // QA Smoke Test function
  const runQASmokeTest = async () => {
    const token = AdminAuth.getToken();
    if (!token || !smokeTestEmail || !smokeTestTemplate) {
      toast({ title: "Error", description: "Please provide recipient email and select a template", variant: "destructive" });
      return;
    }

    setIsSmokeTestRunning(true);
    setSmokeTestStatus({ preview: false, send: false, log: false });

    try {
      // Step 1: Preview API test
      const currentFormData = formData[smokeTestTemplate] || {};
      await adminApi.previewTemplatePOST(smokeTestTemplate, currentFormData);
      setSmokeTestStatus(prev => ({ ...prev, preview: true }));

      // Step 2: Send test email
      const emailData = {
        to: smokeTestEmail,
        templateId: smokeTestTemplate,
        data: currentFormData
      };
      await adminApi.sendTestEmailPOST(emailData);
      setSmokeTestStatus(prev => ({ ...prev, send: true }));

      // Step 3: Poll for email logs
      const pollStartTime = Date.now();
      const pollInterval = setInterval(async () => {
        try {
          const params = new URLSearchParams({
            page: '1',
            pageSize: '5',
            status: '',
            type: ''
          });

          const logsResponse = await fetch(`/api/admin/email-logs?${params}`, {
            headers: { 'x-admin-token': token }
          });

          if (logsResponse.ok) {
            const logsData = await logsResponse.json();

            // Check if there's a new test email log for this recipient
            const recentTestLog = logsData.logs.find((log: EmailLog) =>
              log.recipientEmail?.toLowerCase() === smokeTestEmail.toLowerCase() &&
              log.templateId === smokeTestTemplate &&
              new Date(log.createdAt).getTime() > (pollStartTime - 10000) // Within last 10 seconds + some buffer
            );

            if (recentTestLog) {
              setSmokeTestStatus(prev => ({ ...prev, log: true }));
              clearInterval(pollInterval);
              toast({ title: "QA Smoke Test Success", description: "All steps completed successfully!" });
              refetchLogs(); // Refresh the logs display
              return;
            }
          }

          // Timeout after 20 seconds
          if (Date.now() - pollStartTime > 20000) {
            clearInterval(pollInterval);
            setSmokeTestStatus(prev => ({ ...prev, error: 'Timeout: Log entry not found within 20 seconds' }));
            toast({ title: "QA Smoke Test Failed", description: "Timeout: Log entry not found within 20 seconds", variant: "destructive" });
          }
        } catch (error) {
          console.error('Polling error:', error);
          clearInterval(pollInterval); // Stop polling on error
          setSmokeTestStatus(prev => ({ ...prev, error: error.message || 'Polling failed' }));
          toast({ title: "QA Smoke Test Failed", description: error.message || "Polling failed", variant: "destructive" });
        }
      }, 2000);

    } catch (error) {
      console.error('QA Smoke Test error:', error);
      setSmokeTestStatus(prev => ({ ...prev, error: error.message || 'Test failed' }));
      toast({ title: "QA Smoke Test Failed", description: error.message || "Test failed", variant: "destructive" });
    } finally {
      setIsSmokeTestRunning(false);
    }
  };

  // Render sub-tab content
  const renderSubTabContent = () => {
    switch (activeSubTab) {
      case 'templates':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Template List */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle>Email Templates</CardTitle>
                  <CardDescription>Select a template to preview and test</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 max-h-96 overflow-y-auto">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${selectedTemplateId === template.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'}`}
                      onClick={() => setSelectedTemplateId(template.id)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{template.name}</h3>
                            {selectedTemplateId === template.id && (
                              <Badge variant="secondary" className="text-xs">Selected</Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{template.description}</p>
                          <p className="text-sm text-gray-500 mt-1">Subject: {template.subject}</p>
                        </div>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent selecting the template when clicking preview
                            handlePreview();
                          }}
                          variant="outline"
                          size="sm"
                          disabled={previewLoading || !selectedTemplateId}
                        >
                          {previewLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          <Eye className="mr-2 h-4 w-4" />
                          Preview
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Template Data Forms */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Template Data & Preview</CardTitle>
                  <CardDescription>Configure template variables below and preview the result.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Template Fields */}
                  {selectedTemplateId && (
                    <div className="space-y-4">
                      <h4 className="font-medium">Template Data</h4>
                      <div className="space-y-3">
                        <div>
                          <Label htmlFor="recipient">Recipient Email</Label>
                          <Input
                            id="recipient"
                            type="email"
                            placeholder="test@example.com"
                            value={testEmail}
                            onChange={(e) => setTestEmail(e.target.value)}
                          />
                        </div>

                        {/* Price Drop Template Fields */}
                        {selectedTemplateId === 'price-drop' && (
                          <>
                            <div>
                              <Label htmlFor="asin">ASIN</Label>
                              <Input
                                id="asin"
                                placeholder="B01DJGLYZQ"
                                value={formData[selectedTemplateId]?.asin || ''}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  [selectedTemplateId]: { ...prev[selectedTemplateId], asin: e.target.value }
                                }))}
                              />
                            </div>
                            <div>
                              <Label htmlFor="productTitle">Product Title</Label>
                              <Input
                                id="productTitle"
                                placeholder="Product Name"
                                value={formData[selectedTemplateId]?.productTitle || ''}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  [selectedTemplateId]: { ...prev[selectedTemplateId], productTitle: e.target.value }
                                }))}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label htmlFor="oldPrice">Old Price</Label>
                                <Input
                                  id="oldPrice"
                                  placeholder="22.99"
                                  value={formData[selectedTemplateId]?.oldPrice || ''}
                                  onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    [selectedTemplateId]: { ...prev[selectedTemplateId], oldPrice: e.target.value }
                                  }))}
                                />
                              </div>
                              <div>
                                <Label htmlFor="newPrice">New Price</Label>
                                <Input
                                  id="newPrice"
                                  placeholder="15.99"
                                  value={formData[selectedTemplateId]?.newPrice || ''}
                                  onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    [selectedTemplateId]: { ...prev[selectedTemplateId], newPrice: e.target.value }
                                  }))}
                                />
                              </div>
                            </div>
                            <div>
                              <Label htmlFor="productUrl">Product URL</Label>
                              <Input
                                id="productUrl"
                                placeholder="https://www.amazon.com/dp/B01DJGLYZQ"
                                value={formData[selectedTemplateId]?.productUrl || ''}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  [selectedTemplateId]: { ...prev[selectedTemplateId], productUrl: e.target.value }
                                }))}
                              />
                            </div>
                          </>
                        )}

                        {/* Password Reset Template Fields */}
                        {selectedTemplateId === 'password-reset' && (
                          <>
                            <div>
                              <Label htmlFor="firstName">First Name</Label>
                              <Input
                                id="firstName"
                                placeholder="John"
                                value={formData[selectedTemplateId]?.firstName || ''}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  [selectedTemplateId]: { ...prev[selectedTemplateId], firstName: e.target.value }
                                }))}
                              />
                            </div>
                            <div>
                              <Label htmlFor="resetLink">Reset Link</Label>
                              <Input
                                id="resetLink"
                                placeholder="https://example.com/reset-password?token=example123"
                                value={formData[selectedTemplateId]?.resetLink || ''}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  [selectedTemplateId]: { ...prev[selectedTemplateId], resetLink: e.target.value }
                                }))}
                              />
                            </div>
                          </>
                        )}

                        {/* Welcome Template Fields */}
                        {selectedTemplateId === 'welcome' && (
                          <div>
                            <Label htmlFor="firstName">First Name</Label>
                            <Input
                              id="firstName"
                              placeholder="Sarah"
                              value={formData[selectedTemplateId]?.firstName || ''}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                [selectedTemplateId]: { ...prev[selectedTemplateId], firstName: e.target.value }
                              }))}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Preview Section */}
                  {previewContent && (
                    <div className="mt-6 border-t pt-6">
                      <h4 className="font-medium mb-3">Template Preview</h4>
                      <iframe
                        srcDoc={previewContent}
                        className="w-full h-96 border rounded"
                        title="Email Template Preview"
                      />
                    </div>
                  )}

                  <div className="flex justify-end gap-4 pt-4 border-t">
                    <Button variant="outline" onClick={() => {
                      if (selectedTemplateId) {
                        const template = templates.find(t => t.id === selectedTemplateId);
                        if (template && template.defaults) {
                          setFormData(prev => ({
                            ...prev,
                            [selectedTemplateId]: { ...template.defaults }
                          }));
                          handlePreview(); // Re-preview with defaults
                        }
                      }
                    }}>
                      Reset
                    </Button>
                    <Button onClick={handleSendTestEmail} disabled={sendLoading || !testEmail || !selectedTemplateId}>
                      {sendLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <Send className="mr-2 h-4 w-4" />
                      Send Test Email
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
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
                  <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
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
                disabled={sendLoading || !testEmail || !selectedTemplateId}
              >
                {sendLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
                    <Select value={statusFilter || 'all'} onValueChange={(value) => setStatusFilter(value === 'all' ? undefined : value)}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="success">Success</SelectItem>
                        <SelectItem value="fail">Fail</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="typeFilter">Type:</Label>
                    <Select value={typeFilter || 'all'} onValueChange={(value) => setTypeFilter(value === 'all' ? undefined : value)}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="price-drop">Price Drop</SelectItem>
                        <SelectItem value="reset">Password Reset</SelectItem>
                        <SelectItem value="test">Test</SelectItem>
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
                          <TableCell>{log.to || log.recipientEmail}</TableCell>
                          <TableCell className="max-w-xs truncate">{log.subject}</TableCell>
                          <TableCell>{log.isTest ? 'test' : 'production'}</TableCell>
                          <TableCell>{renderStatusBadge(log.status as 'success' | 'fail')}</TableCell>
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
                                  <p><strong>To:</strong> {log.to || log.recipientEmail}</p>
                                  <p><strong>Subject:</strong> {log.subject}</p>
                                  <p><strong>Status:</strong> {renderStatusBadge(log.status as 'success' | 'fail')}</p>
                                  <p><strong>Type:</strong> {log.isTest ? 'Test' : 'Production'}</p>
                                  {log.templateId && <p><strong>Template:</strong> {log.templateId}</p>}
                                </div>
                                {log.previewHtml ? (
                                  <iframe
                                    srcDoc={log.previewHtml}
                                    className="w-full h-[500px] border rounded mt-4"
                                    title={`Email Preview - ${log.subject}`}
                                  />
                                ) : (
                                  <div className="w-full h-[200px] border rounded mt-4 flex items-center justify-center text-gray-500">
                                    No preview available
                                  </div>
                                )}
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
          <div className="space-y-6">
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

            <Card>
              <CardHeader>
                <CardTitle>QA Smoke Test</CardTitle>
                <CardDescription>End-to-end validation: Preview → Send → Log verification</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="smokeTestEmail">Test Recipient Email</Label>
                    <Input
                      id="smokeTestEmail"
                      type="email"
                      value={smokeTestEmail}
                      onChange={(e) => setSmokeTestEmail(e.target.value)}
                      placeholder={settings.fromAddress || "test@example.com"}
                    />
                  </div>
                  <div>
                    <Label htmlFor="smokeTestTemplate">Template</Label>
                    <Select value={smokeTestTemplate} onValueChange={setSmokeTestTemplate}>
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
                </div>

                {/* Test Status Display */}
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h4 className="font-medium mb-3">Test Status</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {smokeTestStatus.preview ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                      )}
                      <span className={smokeTestStatus.preview ? "text-green-600" : "text-gray-500"}>
                        Preview API Test
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {smokeTestStatus.send ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                      )}
                      <span className={smokeTestStatus.send ? "text-green-600" : "text-gray-500"}>
                        Send Test Email
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {smokeTestStatus.log ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                      )}
                      <span className={smokeTestStatus.log ? "text-green-600" : "text-gray-500"}>
                        Log Entry Verification
                      </span>
                    </div>
                  </div>
                  {smokeTestStatus.error && (
                    <div className="mt-3 p-2 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
                      <AlertCircle className="h-4 w-4 inline mr-1" />
                      {smokeTestStatus.error}
                    </div>
                  )}
                </div>

                <Button
                  onClick={runQASmokeTest}
                  disabled={isSmokeTestRunning || !smokeTestEmail || !smokeTestTemplate}
                  className="w-full"
                >
                  {isSmokeTestRunning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Run QA Smoke Test
                </Button>
              </CardContent>
            </Card>
          </div>
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