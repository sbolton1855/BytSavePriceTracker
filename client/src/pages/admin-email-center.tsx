import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Mail, Send, Eye, AlertCircle, ChevronLeft, ChevronRight, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from '@/components/ui/textarea';

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

export default function AdminEmailCenter() {
  const [adminToken, setAdminToken] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [results, setResults] = useState<Record<string, any>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { toast } = useToast();

  // Check authentication when admin token changes
  useEffect(() => {
    // This effect now solely manages the authenticated state based on the token's presence.
    // The actual validation of the token happens implicitly in the query's enabled state.
    if (adminToken && adminToken.length > 0) {
      localStorage.setItem('adminToken', adminToken); // Persist token
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
      localStorage.removeItem('adminToken'); // Clear token if empty
    }
  }, [adminToken]);

  // Query for email logs
  const { data: emailLogs, isLoading: logsLoading, refetch: refetchLogs } = useQuery<EmailLogsResponse>({
    queryKey: ['admin-email-logs', adminToken, currentPage, statusFilter, typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        token: adminToken,
        page: currentPage.toString(),
        pageSize: '20',
        ...(statusFilter && { status: statusFilter }),
        ...(typeFilter && { type: typeFilter })
      });

      const response = await fetch(`/api/admin/logs?${params}`);
      if (!response.ok) {
        if (response.status === 403) {
          toast({ title: "Unauthorized", description: "Invalid admin token.", variant: "destructive" });
          setIsAuthenticated(false); // Mark as not authenticated on 403
          setAdminToken(''); // Clear invalid token
          localStorage.removeItem('adminToken');
        } else {
          toast({ title: "Error", description: "Failed to fetch email logs.", variant: "destructive" });
        }
        throw new Error('Failed to fetch email logs');
      }
      return response.json();
    },
    enabled: !!adminToken && isAuthenticated, // Only run if token exists and is considered authenticated
  });


  // Price Drop Alert form state
  const [priceDropForm, setPriceDropForm] = useState({
    asin: '',
    productTitle: 'Test Product',
    oldPrice: '',
    newPrice: '',
    email: ''
  });

  // Password Reset form state
  const [passwordResetForm, setPasswordResetForm] = useState({
    email: ''
  });

  // Generic Test Email form state
  const [genericEmailForm, setGenericEmailForm] = useState({
    email: ''
  });

  // Loading states
  const [isLoading, setIsLoading] = useState({
    priceDropPreview: false,
    priceDropSend: false,
    passwordResetPreview: false,
    passwordResetSend: false,
    genericTest: false
  });

  // Helper function to update loading state
  const setLoadingState = (key: string, value: boolean) => {
    setIsLoading(prev => ({ ...prev, [key]: value }));
  };

  // Helper function to update results
  const setResult = (key: string, value: any) => {
    setResults(prev => ({ ...prev, [key]: value }));
  };

  // Price Drop Alert handlers
  const handlePriceDropPreview = async () => {
    if (!adminToken) {
      toast({ title: "Error", description: "Admin token is required", variant: "destructive" });
      return;
    }

    setLoadingState('priceDropPreview', true);
    try {
      const response = await fetch(`/api/dev/preview-email?asin=${priceDropForm.asin}&productTitle=${encodeURIComponent(priceDropForm.productTitle)}&oldPrice=${priceDropForm.oldPrice}&newPrice=${priceDropForm.newPrice}&token=${adminToken}`);

      if (!response.ok) {
        if (response.status === 403) {
          toast({ title: "Unauthorized", description: "Invalid admin token.", variant: "destructive" });
          setIsAuthenticated(false);
          setAdminToken('');
          localStorage.removeItem('adminToken');
          return; // Stop execution if unauthorized
        }
        throw new Error('Failed to preview price drop email');
      }

      const htmlContent = await response.text();
      setResult('priceDropPreview', htmlContent);
      toast({ title: "Success", description: "Price drop email preview generated" });
    } catch (error) {
      console.error('Price drop preview error:', error);
      toast({ title: "Error", description: "Failed to preview price drop email", variant: "destructive" });
    } finally {
      setLoadingState('priceDropPreview', false);
    }
  };

  const handlePriceDropSend = async () => {
    if (!adminToken) {
      toast({ title: "Error", description: "Admin token is required", variant: "destructive" });
      return;
    }

    if (!priceDropForm.asin || !priceDropForm.oldPrice || !priceDropForm.newPrice) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    setLoadingState('priceDropSend', true);
    try {
      const testEmail = priceDropForm.email || 'test@example.com';
      const response = await fetch(`/api/dev/preview-email?asin=${priceDropForm.asin}&productTitle=${encodeURIComponent(priceDropForm.productTitle)}&oldPrice=${priceDropForm.oldPrice}&newPrice=${priceDropForm.newPrice}&email=${encodeURIComponent(testEmail)}&send=true&token=${adminToken}`);

      if (!response.ok) {
        if (response.status === 403) {
          toast({ title: "Unauthorized", description: "Invalid admin token.", variant: "destructive" });
          setIsAuthenticated(false);
          setAdminToken('');
          localStorage.removeItem('adminToken');
          return;
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send price drop email');
      }

      const data = await response.json();
      toast({ title: "Success", description: data.message || "Price drop email sent successfully!" });
      setResult('priceDropSend', data);
    } catch (error) {
      console.error('Price drop send error:', error);
      toast({ title: "Error", description: error.message || "Failed to send price drop email", variant: "destructive" });
    } finally {
      setLoadingState('priceDropSend', false);
    }
  };

  // Password Reset handlers
  const handlePasswordResetPreview = async () => {
    if (!adminToken || !passwordResetForm.email) {
      toast({ title: "Error", description: "Admin token and email are required", variant: "destructive" });
      return;
    }

    setLoadingState('passwordResetPreview', true);
    try {
      const params = new URLSearchParams({
        email: passwordResetForm.email,
        token: adminToken
      });

      const response = await fetch(`/api/admin/test-reset?${params}`);
      
      if (!response.ok) {
        if (response.status === 403) {
          toast({ title: "Unauthorized", description: "Invalid admin token.", variant: "destructive" });
          setIsAuthenticated(false);
          setAdminToken('');
          localStorage.removeItem('adminToken');
          return;
        }
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const result = await response.json();
      setResult('passwordResetPreview', result.previewHtml || '');
      toast({ title: "Success", description: "Password reset preview generated" });

    } catch (error) {
      toast({ title: "Error", description: "Failed to generate preview", variant: "destructive" });
      console.error(error);
    } finally {
      setLoadingState('passwordResetPreview', false);
    }
  };

  const handlePasswordResetSend = async () => {
    if (!adminToken || !passwordResetForm.email) {
      toast({ title: "Error", description: "Admin token and email are required", variant: "destructive" });
      return;
    }

    setLoadingState('passwordResetSend', true);
    try {
      const params = new URLSearchParams({
        email: passwordResetForm.email,
        token: adminToken,
        send: 'true'
      });

      const response = await fetch(`/api/admin/test-reset?${params}`);
      
      if (!response.ok) {
        if (response.status === 403) {
          toast({ title: "Unauthorized", description: "Invalid admin token.", variant: "destructive" });
          setIsAuthenticated(false);
          setAdminToken('');
          localStorage.removeItem('adminToken');
          return;
        }
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const result = await response.json();
      setResult('passwordResetSend', result);
      toast({ title: "Success", description: result.message || "Email sent successfully" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to send email", variant: "destructive" });
      console.error(error);
    } finally {
      setLoadingState('passwordResetSend', false);
    }
  };

  // Generic Test Email handler
  const handleGenericTestSend = async () => {
    if (!adminToken || !genericEmailForm.email) {
      toast({ title: "Error", description: "Admin token and email are required", variant: "destructive" });
      return;
    }

    setLoadingState('genericTest', true);
    try {
      const response = await fetch('/api/admin/email/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}` // Added Bearer token
        },
        body: JSON.stringify({
          to: genericEmailForm.email,
          templateId: 'welcome' // Assuming 'welcome' is a valid template ID
        })
      });

      if (!response.ok) {
        if (response.status === 403) {
          toast({ title: "Unauthorized", description: "Invalid admin token.", variant: "destructive" });
          setIsAuthenticated(false);
          setAdminToken('');
          localStorage.removeItem('adminToken');
          return;
        }
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      setResult('genericTest', result);
      toast({ title: "Success", description: result.message || "Test email sent successfully" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to send test email", variant: "destructive" });
      console.error(error);
    } finally {
      setLoadingState('genericTest', false);
    }
  };

  // Function to render status badge
  const renderStatusBadge = (status: EmailLog['status']) => {
    return status === 'success' ? (
      <Badge variant="success" className="flex items-center gap-1">
        <CheckCircle className="h-4 w-4" /> Success
      </Badge>
    ) : (
      <Badge variant="destructive" className="flex items-center gap-1">
        <XCircle className="h-4 w-4" /> Fail
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

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Mail className="mr-3 h-8 w-8" />
                Admin Email Center
              </CardTitle>
              <CardDescription>Enter your admin secret token to access email testing</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="adminToken">Admin Secret Token</Label>
                  <Input
                    id="adminToken"
                    type="password"
                    value={adminToken}
                    onChange={(e) => setAdminToken(e.target.value)}
                    placeholder="Enter ADMIN_SECRET token"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && adminToken) {
                        setIsAuthenticated(true); // Attempt to authenticate on Enter press
                      }
                    }}
                  />
                </div>
                <Button 
                  onClick={() => {
                    if (adminToken) {
                      setIsAuthenticated(true); // Set authenticated state
                    } else {
                      toast({ title: "Error", description: "Please enter admin token", variant: "destructive" });
                    }
                  }}
                  className="w-full"
                >
                  Access Email Center
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center">
              <Mail className="mr-3 h-8 w-8" />
              Admin Email Center
            </h1>
            <p className="text-gray-600">Test and manage email functionality</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => {
              setAdminToken(''); // Clear token from state
              setIsAuthenticated(false); // Set as not authenticated
              localStorage.removeItem('adminToken'); // Remove from local storage
            }}
          >
            Logout
          </Button>
        </div>
      </div>

      {/* Email Testing Tabs */}
      <Tabs defaultValue="price-drop" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4"> {/* Increased columns to 4 */}
          <TabsTrigger value="price-drop">Price Drop Alerts</TabsTrigger>
          <TabsTrigger value="password-reset">Password Reset</TabsTrigger>
          <TabsTrigger value="generic-test">Generic Test</TabsTrigger>
          <TabsTrigger value="email-logs">Email Logs</TabsTrigger> {/* New Tab */}
        </TabsList>

        {/* Price Drop Alerts Tab */}
        <TabsContent value="price-drop">
          <Card>
            <CardHeader>
              <CardTitle>Price Drop Alert Testing</CardTitle>
              <CardDescription>Test price drop email templates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="asin">ASIN *</Label>
                  <Input
                    id="asin"
                    value={priceDropForm.asin}
                    onChange={(e) => setPriceDropForm(prev => ({ ...prev, asin: e.target.value }))}
                    placeholder="B08N5WRWNW"
                  />
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
                  <Label htmlFor="oldPrice">Old Price *</Label>
                  <Input
                    id="oldPrice"
                    type="number"
                    step="0.01"
                    value={priceDropForm.oldPrice}
                    onChange={(e) => setPriceDropForm(prev => ({ ...prev, oldPrice: e.target.value }))}
                    placeholder="29.99"
                  />
                </div>
                <div>
                  <Label htmlFor="newPrice">New Price *</Label>
                  <Input
                    id="newPrice"
                    type="number"
                    step="0.01"
                    value={priceDropForm.newPrice}
                    onChange={(e) => setPriceDropForm(prev => ({ ...prev, newPrice: e.target.value }))}
                    placeholder="19.99"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="priceDropEmail">Target Email (optional)</Label>
                  <Input
                    id="priceDropEmail"
                    type="email"
                    value={priceDropForm.email}
                    onChange={(e) => setPriceDropForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="test@example.com (leave empty for default)"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={handlePriceDropPreview} 
                  variant="outline"
                  disabled={isLoading.priceDropPreview || !adminToken} // Disable if no token
                >
                  {isLoading.priceDropPreview && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Eye className="mr-2 h-4 w-4" />
                  Preview
                </Button>
                <Button 
                  onClick={handlePriceDropSend}
                  disabled={isLoading.priceDropSend || !adminToken} // Disable if no token
                >
                  {isLoading.priceDropSend && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Send className="mr-2 h-4 w-4" />
                  Send Email
                </Button>
              </div>

              {/* Price Drop Results */}
              {results.priceDropPreview && (
                <div className="mt-6">
                  <Label>Email Preview</Label>
                  <iframe
                    srcDoc={results.priceDropPreview}
                    className="w-full h-96 border rounded"
                    title="Price Drop Email Preview"
                  />
                </div>
              )}

              {results.priceDropSend && (
                <div className="mt-6">
                  <Label>Send Result</Label>
                  <Textarea
                    value={JSON.stringify(results.priceDropSend, null, 2)}
                    readOnly
                    className="mt-2 h-24"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Password Reset Tab */}
        <TabsContent value="password-reset">
          <Card>
            <CardHeader>
              <CardTitle>Password Reset Testing</CardTitle>
              <CardDescription>Test password reset email templates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="passwordResetEmail">Target Email *</Label>
                <Input
                  id="passwordResetEmail"
                  type="email"
                  value={passwordResetForm.email}
                  onChange={(e) => setPasswordResetForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="test@example.com"
                />
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={handlePasswordResetPreview} 
                  variant="outline"
                  disabled={isLoading.passwordResetPreview || !adminToken} // Disable if no token
                >
                  {isLoading.passwordResetPreview && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Eye className="mr-2 h-4 w-4" />
                  Preview
                </Button>
                <Button 
                  onClick={handlePasswordResetSend}
                  disabled={isLoading.passwordResetSend || !adminToken} // Disable if no token
                >
                  {isLoading.passwordResetSend && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Send className="mr-2 h-4 w-4" />
                  Send Email
                </Button>
              </div>

              {/* Password Reset Results */}
              {results.passwordResetPreview && (
                <div className="mt-6">
                  <Label>Email Preview</Label>
                  <iframe
                    srcDoc={results.passwordResetPreview}
                    className="w-full h-96 border rounded"
                    title="Password Reset Email Preview"
                  />
                </div>
              )}

              {results.passwordResetSend && (
                <div className="mt-6">
                  <Label>Send Result</Label>
                  <Textarea
                    value={JSON.stringify(results.passwordResetSend, null, 2)}
                    readOnly
                    className="mt-2 h-24"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Generic Test Tab */}
        <TabsContent value="generic-test">
          <Card>
            <CardHeader>
              <CardTitle>Generic Test Email</CardTitle>
              <CardDescription>Send a basic test email to verify email system</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="genericEmail">Target Email *</Label>
                <Input
                  id="genericEmail"
                  type="email"
                  value={genericEmailForm.email}
                  onChange={(e) => setGenericEmailForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="test@example.com"
                />
              </div>

              <Button 
                onClick={handleGenericTestSend}
                disabled={isLoading.genericTest || !adminToken} // Disable if no token
              >
                {isLoading.genericTest && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Send className="mr-2 h-4 w-4" />
                Send Test Email
              </Button>

              {/* Generic Test Results */}
              {results.genericTest && (
                <div className="mt-6">
                  <Label>Send Result</Label>
                  <Textarea
                    value={JSON.stringify(results.genericTest, null, 2)}
                    readOnly
                    className="mt-2 h-24"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Logs Tab */}
        <TabsContent value="email-logs">
          <Card>
            <CardHeader>
              <CardTitle>Email Logs</CardTitle>
              <CardDescription>View a history of sent emails</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filters */}
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
                  setCurrentPage(1); // Reset to first page on filter change
                  refetchLogs();
                }} disabled={!adminToken}> {/* Disabled if no token */}
                  Apply Filters
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
                          <TableCell>{log.subject}</TableCell>
                          <TableCell>{log.type}</TableCell>
                          <TableCell>{renderStatusBadge(log.status)}</TableCell>
                          <TableCell>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm" onClick={() => setResult('emailBody', log.previewHtml)}>
                                  <Eye className="h-4 w-4" /> View Details
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-[700px]">
                                <DialogHeader>
                                  <DialogTitle>Email Details</DialogTitle>
                                  <DialogDescription>
                                    <strong>Sent:</strong> {new Date(log.createdAt).toLocaleString()} <br />
                                    <strong>To:</strong> {log.recipientEmail} <br />
                                    <strong>Subject:</strong> {log.subject} <br />
                                    <strong>Status:</strong> {renderStatusBadge(log.status)} <br />
                                    <strong>Type:</strong> {log.type}
                                  </DialogDescription>
                                </DialogHeader>
                                <iframe
                                  srcDoc={log.previewHtml}
                                  className="w-full h-[500px] border rounded"
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
                      <ChevronLeft className="h-4 w-4" /> Previous
                    </Button>
                    <span>Page {currentPage} of {emailLogs.totalPages}</span>
                    <Button
                      variant="outline"
                      onClick={() => handlePageChange('next')}
                      disabled={currentPage === emailLogs.totalPages || logsLoading}
                    >
                      Next <ChevronRight className="h-4 w-4" />
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
        </TabsContent>
      </Tabs>
    </div>
  );
}