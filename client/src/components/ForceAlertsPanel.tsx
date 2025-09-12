
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Zap, AlertTriangle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AdminAuth } from "@/lib/admin-auth";

interface ForceAlertResult {
  success: boolean;
  productId?: number;
  productTitle?: string;
  alertsSent?: number;
  error?: string;
  timestamp: string;
}

export default function ForceAlertsPanel() {
  const { toast } = useToast();
  
  // Form state
  const [selectedMode, setSelectedMode] = useState('');
  const [customProductId, setCustomProductId] = useState('');
  const [isTriggering, setIsTriggering] = useState(false);
  const [alertResults, setAlertResults] = useState<ForceAlertResult[]>([]);

  const isDevelopment = process.env.NODE_ENV === 'development';

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

    if (selectedMode === 'custom' && !customProductId) {
      toast({
        title: "Error",
        description: "Please enter a product ID for custom testing",
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

      if (selectedMode === 'random') {
        // Trigger alerts for a random product
        endpoint = '/api/admin/force-alerts/random';
        requestBody = { mode: 'random' };
      } else if (selectedMode === 'custom') {
        // Trigger alerts for specific product ID
        endpoint = '/api/admin/force-alerts/product';
        requestBody = { productId: parseInt(customProductId), mode: 'custom' };
      } else if (selectedMode === 'all') {
        // Trigger all pending alerts (development only)
        endpoint = '/api/admin/force-alerts/all';
        requestBody = { mode: 'all' };
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
        productTitle: result.productTitle,
        alertsSent: result.alertsSent || 1,
        timestamp: new Date().toISOString()
      };

      setAlertResults(prev => [alertResult, ...prev]);
      
      toast({
        title: "Success",
        description: `Force alert triggered successfully. ${result.alertsSent || 1} alert(s) sent.`,
      });

    } catch (error) {
      console.error('Force alert failed:', error);
      
      const alertResult: ForceAlertResult = {
        success: false,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Failed to trigger alert"
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
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Alert Trigger Controls</CardTitle>
            <CardDescription>
              {isDevelopment ? 
                'Development mode: Full testing controls available' : 
                'Production mode: Basic alert triggering'
              }
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
                    <SelectItem value="random">
                      <div>
                        <div className="font-medium">Random Product</div>
                        <div className="text-sm text-gray-500">Pick a random tracked product</div>
                      </div>
                    </SelectItem>
                    {isDevelopment && (
                      <>
                        <SelectItem value="custom">
                          <div>
                            <div className="font-medium">Custom Product ID</div>
                            <div className="text-sm text-gray-500">Test with specific product</div>
                          </div>
                        </SelectItem>
                        <SelectItem value="all">
                          <div>
                            <div className="font-medium">All Pending Alerts</div>
                            <div className="text-sm text-gray-500">Trigger all ready alerts</div>
                          </div>
                        </SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedMode === 'custom' && isDevelopment && (
                <div>
                  <Label htmlFor="productId">Product ID</Label>
                  <Input
                    id="productId"
                    type="number"
                    value={customProductId}
                    onChange={(e) => setCustomProductId(e.target.value)}
                    placeholder="Enter product ID (e.g., 42)"
                    min="1"
                  />
                </div>
              )}

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

              {isDevelopment && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="flex items-center gap-2 text-blue-700">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">Development Mode</span>
                  </div>
                  <p className="text-blue-600 mt-1 text-sm">
                    Additional testing options are available. Use responsibly to avoid spamming users.
                  </p>
                </div>
              )}
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
              <div className="border-2 border-dashed border-gray-300 rounded-lg h-[300px] flex flex-col items-center justify-center text-gray-500">
                <Zap className="h-12 w-12 mb-4 text-gray-400" />
                <p className="text-center">
                  No alerts triggered yet.<br />
                  Use the form to trigger a test alert.
                </p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[300px] overflow-y-auto">
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
                          {result.success ? 'Alert Triggered' : 'Alert Failed'}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {new Date(result.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    
                    {result.productTitle && (
                      <p className="text-sm text-gray-600 mb-1">
                        <strong>Product:</strong> {result.productTitle}
                      </p>
                    )}
                    
                    {result.productId && (
                      <p className="text-sm text-gray-600 mb-1">
                        <strong>Product ID:</strong> {result.productId}
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
