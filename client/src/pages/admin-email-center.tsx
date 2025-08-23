
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Send, Eye, AlertCircle } from "lucide-react";

export default function AdminEmailCenter() {
  const { toast } = useToast();
  
  // Admin token state with localStorage persistence
  const [adminToken, setAdminToken] = useState(() => 
    localStorage.getItem('admin-email-token') || ''
  );
  
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
  
  // Results state
  const [results, setResults] = useState({
    priceDropPreview: '',
    priceDropSend: null,
    passwordResetPreview: '',
    passwordResetSend: null,
    genericTest: null
  });

  // Save token to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('admin-email-token', adminToken);
  }, [adminToken]);

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
      toast({ title: "Error", description: "Admin token required", variant: "destructive" });
      return;
    }
    
    if (!priceDropForm.asin || !priceDropForm.oldPrice || !priceDropForm.newPrice) {
      toast({ title: "Error", description: "ASIN, old price, and new price are required", variant: "destructive" });
      return;
    }

    setLoadingState('priceDropPreview', true);
    try {
      const params = new URLSearchParams({
        asin: priceDropForm.asin,
        productTitle: priceDropForm.productTitle,
        oldPrice: priceDropForm.oldPrice,
        newPrice: priceDropForm.newPrice,
        token: adminToken
      });

      const response = await fetch(`/api/dev/preview-email?${params}`);
      const html = await response.text();
      
      if (response.ok) {
        setResult('priceDropPreview', html);
        toast({ title: "Success", description: "Price drop preview generated" });
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate preview", variant: "destructive" });
      console.error(error);
    } finally {
      setLoadingState('priceDropPreview', false);
    }
  };

  const handlePriceDropSend = async () => {
    if (!adminToken) {
      toast({ title: "Error", description: "Admin token required", variant: "destructive" });
      return;
    }
    
    if (!priceDropForm.asin || !priceDropForm.oldPrice || !priceDropForm.newPrice) {
      toast({ title: "Error", description: "ASIN, old price, and new price are required", variant: "destructive" });
      return;
    }

    setLoadingState('priceDropSend', true);
    try {
      const params = new URLSearchParams({
        asin: priceDropForm.asin,
        productTitle: priceDropForm.productTitle,
        oldPrice: priceDropForm.oldPrice,
        newPrice: priceDropForm.newPrice,
        token: adminToken,
        send: 'true',
        ...(priceDropForm.email && { email: priceDropForm.email })
      });

      const response = await fetch(`/api/dev/preview-email?${params}`);
      const result = await response.json();
      
      if (response.ok) {
        setResult('priceDropSend', result);
        toast({ title: "Success", description: result.message || "Email sent successfully" });
      } else {
        throw new Error(result.error || `HTTP ${response.status}`);
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to send email", variant: "destructive" });
      console.error(error);
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
      const result = await response.json();
      
      if (response.ok) {
        setResult('passwordResetPreview', result.previewHtml || '');
        toast({ title: "Success", description: "Password reset preview generated" });
      } else {
        throw new Error(result.error || `HTTP ${response.status}`);
      }
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
      const result = await response.json();
      
      if (response.ok) {
        setResult('passwordResetSend', result);
        toast({ title: "Success", description: result.message || "Email sent successfully" });
      } else {
        throw new Error(result.error || `HTTP ${response.status}`);
      }
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
      const response = await fetch('/api/admin/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: genericEmailForm.email,
          adminToken: adminToken
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        setResult('genericTest', result);
        toast({ title: "Success", description: result.message || "Test email sent successfully" });
      } else {
        throw new Error(result.error || `HTTP ${response.status}`);
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to send test email", variant: "destructive" });
      console.error(error);
    } finally {
      setLoadingState('genericTest', false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center">
          <Mail className="mr-3 h-8 w-8" />
          Admin Email Center
        </h1>
        <p className="text-gray-600">Test and manage email functionality</p>
      </div>

      {/* Admin Token Input */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <AlertCircle className="mr-2 h-5 w-5" />
            Authentication
          </CardTitle>
          <CardDescription>Enter your admin secret token to access email testing</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="adminToken">Admin Secret Token</Label>
              <Input
                id="adminToken"
                type="password"
                value={adminToken}
                onChange={(e) => setAdminToken(e.target.value)}
                placeholder="Enter ADMIN_SECRET token"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email Testing Tabs */}
      <Tabs defaultValue="price-drop" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="price-drop">Price Drop Alerts</TabsTrigger>
          <TabsTrigger value="password-reset">Password Reset</TabsTrigger>
          <TabsTrigger value="generic-test">Generic Test</TabsTrigger>
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
                  disabled={isLoading.priceDropPreview}
                >
                  {isLoading.priceDropPreview && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Eye className="mr-2 h-4 w-4" />
                  Preview
                </Button>
                <Button 
                  onClick={handlePriceDropSend}
                  disabled={isLoading.priceDropSend}
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
                  disabled={isLoading.passwordResetPreview}
                >
                  {isLoading.passwordResetPreview && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Eye className="mr-2 h-4 w-4" />
                  Preview
                </Button>
                <Button 
                  onClick={handlePasswordResetSend}
                  disabled={isLoading.passwordResetSend}
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
                disabled={isLoading.genericTest}
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
      </Tabs>
    </div>
  );
}
