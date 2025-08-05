
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function AdminEmailTest() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    asin: '',
    title: '',
    oldPrice: '',
    newPrice: '',
    email: '',
    sendEmail: false,
    adminToken: ''
  });
  const [previewHtml, setPreviewHtml] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const params = new URLSearchParams({
        asin: formData.asin,
        title: formData.title,
        oldPrice: formData.oldPrice,
        newPrice: formData.newPrice,
        email: formData.email,
        send: formData.sendEmail.toString(),
        token: formData.adminToken
      });

      const response = await fetch(`/api/dev/preview-email?${params}`);
      
      if (response.headers.get('content-type')?.includes('text/html')) {
        // It's HTML preview
        const htmlContent = await response.text();
        setPreviewHtml(htmlContent);
        return;
      }
      
      const result = await response.json();

      if (response.ok) {
        if (formData.sendEmail) {
          toast({
            title: "Email sent successfully!",
            description: `Test email sent to ${formData.email}`
          });
        } else {
          setPreviewHtml(result.html || result.preview || 'No preview available');
        }
      } else {
        throw new Error(result.error || 'Failed to process email');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-bold mb-4">Admin Access Required</h1>
        <p className="text-lg mb-8">Please log in to access the admin email testing.</p>
        <Button onClick={() => window.location.href = "/auth"}>Go to Login</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Admin Email Test</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Email Test Form</CardTitle>
            <CardDescription>Test price drop email alerts</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="adminToken">Admin Token</Label>
                <Input
                  id="adminToken"
                  type="password"
                  value={formData.adminToken}
                  onChange={(e) => handleInputChange('adminToken', e.target.value)}
                  placeholder="Enter admin token"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="asin">ASIN</Label>
                <Input
                  id="asin"
                  value={formData.asin}
                  onChange={(e) => handleInputChange('asin', e.target.value)}
                  placeholder="B01234567890"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="title">Product Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="Amazing Product Name"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="oldPrice">Old Price</Label>
                  <Input
                    id="oldPrice"
                    type="number"
                    step="0.01"
                    value={formData.oldPrice}
                    onChange={(e) => handleInputChange('oldPrice', e.target.value)}
                    placeholder="29.99"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="newPrice">New Price</Label>
                  <Input
                    id="newPrice"
                    type="number"
                    step="0.01"
                    value={formData.newPrice}
                    onChange={(e) => handleInputChange('newPrice', e.target.value)}
                    placeholder="19.99"
                    required
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="email">Test Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="test@example.com"
                  required
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sendEmail"
                  checked={formData.sendEmail}
                  onCheckedChange={(checked) => handleInputChange('sendEmail', checked as boolean)}
                />
                <Label htmlFor="sendEmail">Actually send email (otherwise just preview)</Label>
              </div>
              
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {formData.sendEmail ? 'Send Test Email' : 'Preview Email'}
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
                className="border rounded p-4 bg-white"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
