
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loader2, Zap, AlertTriangle, CheckCircle, Search, Mail, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AdminAuth } from "@/lib/admin-auth";

interface Product {
  id: number;
  asin: string;
  title: string;
  currentPrice: number;
}

interface ForceAlertResult {
  success: boolean;
  productId?: number;
  productTitle?: string;
  asin?: string;
  recipient?: string;
  alertsSent?: number;
  error?: string;
  timestamp: string;
}

export default function ForceAlertsPanel() {
  const { toast } = useToast();
  
  // State for products
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  
  // Form state
  const [selectedMode, setSelectedMode] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [manualAsin, setManualAsin] = useState('');
  const [recipientEmail, setRecipientEmail] = useState(process.env.ADMIN_EMAIL || 'admin@example.com');
  const [isTriggering, setIsTriggering] = useState(false);
  const [alertResults, setAlertResults] = useState<ForceAlertResult[]>([]);

  const isDevelopment = process.env.NODE_ENV === 'development';

  // Load products on component mount
  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoadingProducts(true);
    try {
      const adminToken = AdminAuth.getToken();
      if (!adminToken) {
        throw new Error('No admin token available');
      }

      const response = await fetch('/api/admin/products', {
        headers: {
          'x-admin-token': adminToken
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }

      const data = await response.json();
      setProducts(data.products || []);
    } catch (error) {
      console.error('Error loading products:', error);
      toast({
        title: "Error",
        description: "Failed to load products for selection",
        variant: "destructive"
      });
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleTriggerAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedMode) {
      toast({
        title: "Error",
        description: "Please select an alert mode",
        variant: "destructive"
      });
      return;
    }

    if (selectedMode === 'custom' && !selectedProduct && !manualAsin) {
      toast({
        title: "Error",
        description: "Please select a product or enter an ASIN for custom testing",
        variant: "destructive"
      });
      return;
    }

    if (!recipientEmail) {
      toast({
        title: "Error",
        description: "Please enter a recipient email",
        variant: "destructive"
      });
      return;
    }

    setIsTriggering(true);
    
    try {
      const adminToken = AdminAuth.getToken();
      if (!adminToken) {
        throw new Error('No admin token available');
      }

      let endpoint = '';
      let requestBody = {};

      // In development, always override recipient to admin email for safety
      const finalRecipient = isDevelopment ? (process.env.ADMIN_EMAIL || 'admin@example.com') : recipientEmail;

      if (selectedMode === 'random') {
        endpoint = '/api/admin/force-alerts/random';
        requestBody = { 
          mode: 'random',
          testRecipient: finalRecipient 
        };
      } else if (selectedMode === 'custom') {
        endpoint = '/api/admin/force-alerts/product';
        const productIdentifier = selectedProduct ? selectedProduct.id : manualAsin;
        requestBody = { 
          productId: selectedProduct ? selectedProduct.id : undefined,
          asin: selectedProduct ? selectedProduct.asin : manualAsin,
          mode: 'custom',
          testRecipient: finalRecipient 
        };
      } else if (selectedMode === 'all') {
        endpoint = '/api/admin/force-alerts/all';
        requestBody = { 
          mode: 'all',
          testRecipient: isDevelopment ? finalRecipient : undefined 
        };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to trigger alerts`);
      }

      const result = await response.json();

      const alertResult: ForceAlertResult = {
        success: true,
        productId: result.productId,
        productTitle: result.productTitle || selectedProduct?.title,
        asin: result.asin || selectedProduct?.asin || manualAsin,
        recipient: finalRecipient,
        alertsSent: result.alertsSent || 1,
        timestamp: new Date().toISOString()
      };

      setAlertResults(prev => [alertResult, ...prev]);
      
      toast({
        title: "Success",
        description: `Force alert triggered successfully. Sent to ${finalRecipient}`,
      });

    } catch (error) {
      console.error('Force alert failed:', error);
      
      const alertResult: ForceAlertResult = {
        success: false,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Failed to trigger alert",
        recipient: recipientEmail
      };

      setAlertResults(prev => [alertResult, ...prev]);
      
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to trigger alert",
        variant: "destructive"
      });
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Force Price Drop Alerts</h3>
        <p className="text-sm text-gray-600">Manually trigger price drop alert emails for testing and validation</p>
      </div>

      {/* Development Mode Warning */}
      {isDevelopment && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-md">
          <div className="flex items-center gap-2 text-amber-700">
            <Shield className="h-5 w-5" />
            <span className="font-medium">⚠️ Development Mode</span>
          </div>
          <p className="text-amber-600 mt-1 text-sm">
            All alerts are redirected to admin@example.com for safety. Real users will not receive test emails.
          </p>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Alert Trigger Controls</CardTitle>
            <CardDescription>
              Configure and send test price drop alerts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleTriggerAlert} className="space-y-4">
              <div>
                <Label htmlFor="alertMode">Alert Mode</Label>
                <Select 
                  value={selectedMode} 
                  onValueChange={setSelectedMode}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select how to trigger alerts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">
                      <div>
                        <div className="font-medium">Custom Product</div>
                        <div className="text-sm text-gray-500">Send alert for specific product</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="random">
                      <div>
                        <div className="font-medium">Random Product</div>
                        <div className="text-sm text-gray-500">Pick a random tracked product</div>
                      </div>
                    </SelectItem>
                    {isDevelopment && (
                      <SelectItem value="all">
                        <div>
                          <div className="font-medium">Trigger All Alerts</div>
                          <div className="text-sm text-gray-500">Run daily alert job (dev mode)</div>
                        </div>
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedMode === 'custom' && (
                <div className="space-y-4">
                  <div>
                    <Label>Product Selection</Label>
                    <Popover open={productSearchOpen} onOpenChange={setProductSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={productSearchOpen}
                          className="w-full justify-between"
                          disabled={loadingProducts}
                        >
                          {selectedProduct 
                            ? `${selectedProduct.title.substring(0, 50)}... - ${selectedProduct.asin}`
                            : "Search products..."
                          }
                          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0">
                        <Command>
                          <CommandInput placeholder="Search products by title or ASIN..." />
                          <CommandList>
                            <CommandEmpty>No products found.</CommandEmpty>
                            <CommandGroup>
                              {products.map((product) => (
                                <CommandItem
                                  key={product.id}
                                  value={`${product.title} ${product.asin}`}
                                  onSelect={() => {
                                    setSelectedProduct(product);
                                    setManualAsin('');
                                    setProductSearchOpen(false);
                                  }}
                                >
                                  <div className="flex flex-col">
                                    <span className="font-medium">{product.title.substring(0, 60)}...</span>
                                    <span className="text-sm text-gray-500">{product.asin} - ${product.currentPrice}</span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="text-center text-sm text-gray-500">or</div>

                  <div>
                    <Label htmlFor="manualAsin">Manual ASIN Entry</Label>
                    <Input
                      id="manualAsin"
                      value={manualAsin}
                      onChange={(e) => {
                        setManualAsin(e.target.value);
                        if (e.target.value) {
                          setSelectedProduct(null);
                        }
                      }}
                      placeholder="Enter ASIN manually (e.g., B07XJ8C8F5)"
                    />
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="recipient">Send To Email</Label>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <Input
                    id="recipient"
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="admin@example.com"
                    disabled={isDevelopment}
                  />
                </div>
                {isDevelopment && (
                  <p className="text-xs text-gray-500 mt-1">
                    Locked to admin email in development mode
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button 
                  type="submit" 
                  disabled={isTriggering || !selectedMode}
                  className="flex-1"
                >
                  {isTriggering && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Zap className="mr-2 h-4 w-4" />
                  {isTriggering ? 'Triggering Alert...' : 'Trigger Price Drop Alert'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alert Status</CardTitle>
            <CardDescription>
              Real-time status of triggered alerts and testing results
            </CardDescription>
          </CardHeader>
          <CardContent>
            {alertResults.length === 0 ? (
              <div className="border-2 border-dashed border-gray-300 rounded-lg h-[400px] flex flex-col items-center justify-center text-gray-500">
                <Zap className="h-12 w-12 mb-4 text-gray-400" />
                <p className="text-center">
                  No alerts triggered yet.<br />
                  Use the form to trigger a test alert.
                </p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[400px] overflow-y-auto">
                {alertResults.map((result, index) => (
                  <div 
                    key={index}
                    className={`border rounded-lg p-4 ${
                      result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        {result.success ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                        )}
                        <span className="font-medium">
                          {result.success ? 'Alert Sent Successfully' : 'Alert Failed'}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {new Date(result.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    
                    {result.productTitle && (
                      <div className="mb-2">
                        <p className="text-sm font-medium text-gray-700">Product:</p>
                        <p className="text-sm text-gray-600">{result.productTitle}</p>
                      </div>
                    )}
                    
                    {result.asin && (
                      <p className="text-sm text-gray-600 mb-1">
                        <strong>ASIN:</strong> {result.asin}
                      </p>
                    )}
                    
                    {result.recipient && (
                      <p className="text-sm text-gray-600 mb-1">
                        <strong>Sent To:</strong> {result.recipient}
                      </p>
                    )}
                    
                    {result.alertsSent && (
                      <p className="text-sm text-gray-600 mb-1">
                        <strong>Alerts Sent:</strong> {result.alertsSent}
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
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
