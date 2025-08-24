
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
import { Loader2, Send, Eye, AlertCircle, ChevronLeft, ChevronRight, CheckCircle, XCircle, RefreshCw, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from '@/components/ui/textarea';
import AdminLayout from "@/components/AdminLayout";
import AdminSubTabNav from "@/components/AdminSubTabNav";
import { AdminAuth, adminApi } from "@/lib/admin-auth";

interface EmailLog {
  id: number;
  logId?: string;
  to: string;
  templateId?: string;
  subject: string;
  status: 'sent' | 'failed' | 'processed' | 'stubbed';
  isTest: boolean;
  previewHtml?: string;
  meta?: any;
  provider?: string;
  sgMessageId?: string;
  createdAt: string;
}

interface EmailLogsResponse {
  items: EmailLog[];
  total: number;
  page: number;
  pageSize: number;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  description?: string;
  defaults?: Record<string, any>;
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
  
  // UI states
  const [results, setResults] = useState<Record<string, any>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Load templates from API
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const token = AdminAuth.getToken();
        if (!token) return;

        console.log('[admin-email-center] Loading templates...');
        const data = await adminApi.getEmailTemplates();
        console.log('[admin-email-center] Templates loaded:', data);

        const templatesList = data.templates || [];
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

  // Query for email logs
  const { data: emailLogs, isLoading: logsLoading, refetch: refetchLogs } = useQuery<EmailLogsResponse>({
    queryKey: ['admin-email-logs', currentPage, statusFilter, typeFilter],
    queryFn: async () => {
      const token = AdminAuth.getToken();
      if (!token) {
        toast({ title: "Unauthorized", description: "Invalid admin token.", variant: "destructive" });
        return { items: [], total: 0, page: 1, pageSize: 25 };
      }

      try {
        return await adminApi.getEmailLogs({
          page: currentPage,
          pageSize: 25,
          status: statusFilter,
          isTest: typeFilter
        });
      } catch (error) {
        console.error('[email-logs] fetch error:', error);
        return { items: [], total: 0, page: 1, pageSize: 25 };
      }
    },
    enabled: activeSubTab === 'logs',
    refetchInterval: 5000, // Auto-refresh every 5 seconds
    staleTime: 0 // Always consider stale to ensure fresh data
  });

  // Debug query for health check
  const { data: emailHealth } = useQuery({
    queryKey: ['email-health'],
    queryFn: async () => {
      try {
        return await adminApi.getEmailHealth();
      } catch (error) {
        console.error('[email-health] Error:', error);
        return null;
      }
    },
    enabled: activeSubTab === 'logs',
    refetchInterval: 15000 // Check every 15 seconds
  });

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
        setTimeout(() => refetchLogs(), 2000); // Wait 2s for logging
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
    const statusConfig = {
      sent: { variant: 'default' as const, icon: CheckCircle, color: 'text-green-600 bg-green-50' },
      failed: { variant: 'destructive' as const, icon: XCircle, color: 'text-red-600' },
      processed: { variant: 'secondary' as const, icon: Clock, color: 'text-yellow-600' },
      stubbed: { variant: 'outline' as const, icon: AlertCircle, color: 'text-gray-600' }
    };

    const config = statusConfig[status] || statusConfig.stubbed;
    const IconComponent = config.icon;

    return (
      <Badge variant={config.variant} className={`flex items-center gap-1 ${config.color}`}>
        <IconComponent className="h-3 w-3" /> 
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  // Function to handle pagination
  const handlePageChange = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    } else if (direction === 'next' && emailLogs && currentPage * emailLogs.pageSize < emailLogs.total) {
      setCurrentPage(prev => prev + 1);
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
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedTemplateId === template.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                      }`}
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
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Template Data Forms */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Template Data & Preview</CardTitle>
                  <CardDescription>Configure template variables and preview the result.</CardDescription>
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

                        {/* Dynamic form fields based on template defaults */}
                        {selectedTemplateId && templates.find(t => t.id === selectedTemplateId)?.defaults && 
                          Object.entries(templates.find(t => t.id === selectedTemplateId)?.defaults || {}).map(([key, defaultValue]) => (
                            <div key={key}>
                              <Label htmlFor={key}>{key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}</Label>
                              <Input
                                id={key}
                                placeholder={String(defaultValue)}
                                value={formData[selectedTemplateId]?.[key] || ''}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  [selectedTemplateId]: { ...prev[selectedTemplateId], [key]: e.target.value }
                                }))}
                              />
                            </div>
                          ))
                        }
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
                    <Button variant="outline" onClick={handlePreview} disabled={previewLoading}>
                      {previewLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <Eye className="mr-2 h-4 w-4" />
                      Preview
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

      case 'logs':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Email Logs</CardTitle>
              <CardDescription>View history of sent emails (auto-refreshes every 5 seconds)</CardDescription>
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
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                        <SelectItem value="processed">Processed</SelectItem>
                        <SelectItem value="stubbed">Stubbed</SelectItem>
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
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="test">Test</SelectItem>
                        <SelectItem value="prod">Production</SelectItem>
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
              ) : emailLogs && emailLogs.items.length > 0 ? (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sent At</TableHead>
                        <TableHead>To</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Template</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {emailLogs.items.map(log => (
                        <TableRow key={log.id}>
                          <TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell>
                          <TableCell>{log.to}</TableCell>
                          <TableCell className="max-w-xs truncate">{log.subject}</TableCell>
                          <TableCell>{log.templateId || '-'}</TableCell>
                          <TableCell>{log.isTest ? 'Test' : 'Prod'}</TableCell>
                          <TableCell>{renderStatusBadge(log.status)}</TableCell>
                          <TableCell>{log.provider || 'unknown'}</TableCell>
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
                                  <DialogTitle>Email Log Details</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-2 text-sm">
                                  <p><strong>Sent:</strong> {new Date(log.createdAt).toLocaleString()}</p>
                                  <p><strong>To:</strong> {log.to}</p>
                                  <p><strong>Subject:</strong> {log.subject}</p>
                                  <p><strong>Status:</strong> {renderStatusBadge(log.status)}</p>
                                  <p><strong>Type:</strong> {log.isTest ? 'Test' : 'Production'}</p>
                                  <p><strong>Provider:</strong> {log.provider || 'Unknown'}</p>
                                  {log.templateId && <p><strong>Template:</strong> {log.templateId}</p>}
                                  {log.sgMessageId && <p><strong>SendGrid ID:</strong> {log.sgMessageId}</p>}
                                  {log.logId && <p><strong>Log ID:</strong> {log.logId}</p>}
                                </div>
                                {log.previewHtml ? (
                                  <iframe
                                    srcDoc={log.previewHtml}
                                    className="w-full h-[400px] border rounded mt-4"
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
                    <span>Page {currentPage} of {Math.ceil(emailLogs.total / emailLogs.pageSize)}</span>
                    <Button
                      variant="outline"
                      onClick={() => handlePageChange('next')}
                      disabled={currentPage * emailLogs.pageSize >= emailLogs.total || logsLoading}
                    >
                      Next <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>

                  {/* Debug Info */}
                  {emailHealth && (
                    <div className="mt-6 p-4 border rounded bg-gray-50">
                      <h4 className="font-semibold mb-3">System Health</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Templates:</p>
                          <p className="font-bold">{emailHealth.templates?.length || 0}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">DB Logs:</p>
                          <p className="font-bold">{emailHealth.counts?.db || 0}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Memory Logs:</p>
                          <p className="font-bold">{emailHealth.counts?.mem || 0}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Database:</p>
                          <p className={`font-bold ${emailHealth.hasDatabase ? 'text-green-600' : 'text-red-600'}`}>
                            {emailHealth.hasDatabase ? 'Connected' : 'Fallback'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex justify-center items-center h-64">
                  <div className="text-center">
                    <p className="text-gray-500 mb-2">No email logs found.</p>
                    <p className="text-sm text-gray-400">Logs will appear here after sending emails.</p>
                  </div>
                </div>
              )}
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
      description="Template testing and email log management"
    >
      <div className="space-y-6">
        {/* Sub-tab Navigation */}
        <AdminSubTabNav 
          activeSubTab={activeSubTab} 
          onSubTabChange={handleSubTabChange}
          tabs={[
            { id: 'templates', label: 'Templates' },
            { id: 'logs', label: 'Logs' }
          ]}
        />

        {/* Sub-tab Content */}
        {renderSubTabContent()}
      </div>
    </AdminLayout>
  );
}
