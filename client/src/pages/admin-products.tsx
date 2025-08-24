
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, AlertTriangle, Check, X, Loader2 } from "lucide-react";

interface TrackedProductWithDetails {
  id: number;
  userId: string | null;
  email: string;
  productId: number;
  targetPrice: number;
  percentageAlert: boolean;
  percentageThreshold: number | null;
  notified: boolean;
  createdAt: string;
  product: {
    id: number;
    asin: string;
    title: string;
    url: string;
    imageUrl: string | null;
    currentPrice: number;
    originalPrice: number | null;
    lastChecked: string;
    lowestPrice: number | null;
    highestPrice: number | null;
    priceDropped: boolean;
    createdAt: string;
    updatedAt: string;
  };
}

export default function AdminProducts() {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [adminToken, setAdminToken] = useState(searchParams.get('token') || '');
  const [products, setProducts] = useState<TrackedProductWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingActions, setLoadingActions] = useState<Record<number, string>>({});
  const [searchFilter, setSearchFilter] = useState('');

  const fetchProducts = async () => {
    if (!adminToken) {
      toast({ 
        title: "Admin token required", 
        description: "Please enter your admin token to continue.",
        variant: "destructive" 
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/admin/products?token=${adminToken}`);
      
      if (!response.ok) {
        if (response.status === 403) {
          toast({ 
            title: "Unauthorized", 
            description: "Invalid admin token.", 
            variant: "destructive" 
          });
          return;
        }
        throw new Error('Failed to fetch products');
      }

      const data = await response.json();
      setProducts(data);
      toast({ 
        title: "Products loaded", 
        description: `Found ${data.length} tracked products.` 
      });
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({ 
        title: "Error", 
        description: "Failed to fetch products.", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetNotified = async (productId: number) => {
    setLoadingActions(prev => ({ ...prev, [productId]: 'reset' }));
    
    try {
      const response = await fetch(`/api/admin/products/${productId}/reset-notified?token=${adminToken}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to reset notification status');
      }

      // Update the local state
      setProducts(prev => prev.map(p => 
        p.id === productId ? { ...p, notified: false } : p
      ));

      toast({ 
        title: "Success", 
        description: "Notification status reset successfully." 
      });
    } catch (error) {
      console.error('Error resetting notification:', error);
      toast({ 
        title: "Error", 
        description: "Failed to reset notification status.", 
        variant: "destructive" 
      });
    } finally {
      setLoadingActions(prev => {
        const { [productId]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  const handleForceAlert = async (productId: number) => {
    setLoadingActions(prev => ({ ...prev, [productId]: 'alert' }));
    
    try {
      const response = await fetch(`/api/admin/products/${productId}/force-alert?token=${adminToken}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to force alert');
      }

      const result = await response.json();
      
      toast({ 
        title: "Alert triggered", 
        description: result.message || "Force alert executed successfully." 
      });

      // Refresh the products list
      fetchProducts();
    } catch (error) {
      console.error('Error forcing alert:', error);
      toast({ 
        title: "Error", 
        description: "Failed to trigger alert.", 
        variant: "destructive" 
      });
    } finally {
      setLoadingActions(prev => {
        const { [productId]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  useEffect(() => {
    if (adminToken) {
      fetchProducts();
    }
  }, [adminToken]);

  const filteredProducts = products.filter(product =>
    product.product.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
    product.product.asin.toLowerCase().includes(searchFilter.toLowerCase()) ||
    product.email.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Admin Products Management
          </h1>
          <p className="mt-2 text-lg text-gray-600">
            View and manage all tracked products
          </p>
        </div>

        {/* Admin Token Input */}
        <Card>
          <CardHeader>
            <CardTitle>Admin Authentication</CardTitle>
            <CardDescription>
              Enter your admin token to access the products management interface.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex space-x-2">
              <Input
                type="password"
                placeholder="Enter admin token"
                value={adminToken}
                onChange={(e) => setAdminToken(e.target.value)}
                className="flex-1"
              />
              <Button onClick={fetchProducts} disabled={!adminToken || loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {loading ? 'Loading...' : 'Load Products'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Search and Stats */}
        {products.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between items-center space-x-4">
                <div className="flex-1">
                  <Input
                    placeholder="Search by product title, ASIN, or email..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                  />
                </div>
                <div className="flex space-x-4 text-sm text-gray-600">
                  <span>Total: <strong>{products.length}</strong></span>
                  <span>Filtered: <strong>{filteredProducts.length}</strong></span>
                  <span>Notified: <strong>{products.filter(p => p.notified).length}</strong></span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Products Table */}
        {filteredProducts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Tracked Products</CardTitle>
              <CardDescription>
                All tracked products with management actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Current Price</TableHead>
                      <TableHead>Target Price</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead>Notified</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            {item.product.imageUrl && (
                              <img 
                                src={item.product.imageUrl} 
                                alt={item.product.title}
                                className="w-12 h-12 object-cover rounded"
                              />
                            )}
                            <div className="max-w-xs">
                              <p className="font-medium text-sm line-clamp-2">
                                {item.product.title}
                              </p>
                              <p className="text-xs text-gray-500">
                                ASIN: {item.product.asin}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{item.email}</span>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <span className="font-medium">${item.product.currentPrice}</span>
                            {item.product.priceDropped && (
                              <Badge variant="secondary" className="text-xs">
                                Price Dropped
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`font-medium ${
                            item.product.currentPrice <= item.targetPrice 
                              ? 'text-green-600' 
                              : 'text-gray-900'
                          }`}>
                            ${item.targetPrice}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-600">
                            {new Date(item.product.lastChecked).toLocaleDateString()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.notified ? "default" : "secondary"}>
                            {item.notified ? (
                              <><Check className="w-3 h-3 mr-1" /> Yes</>
                            ) : (
                              <><X className="w-3 h-3 mr-1" /> No</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleResetNotified(item.id)}
                              disabled={loadingActions[item.id] === 'reset'}
                            >
                              {loadingActions[item.id] === 'reset' ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3 w-3" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleForceAlert(item.id)}
                              disabled={loadingActions[item.id] === 'alert'}
                            >
                              {loadingActions[item.id] === 'alert' ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <AlertTriangle className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!loading && filteredProducts.length === 0 && products.length === 0 && adminToken && (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-gray-500">No tracked products found.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
