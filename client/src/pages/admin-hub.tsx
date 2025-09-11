
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import AdminLayout from "@/components/AdminLayout";
import AdminTabNav from "@/components/AdminTabNav";
import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { 
  Mail, 
  Send, 
  FileText, 
  Zap, 
  BarChart3, 
  Activity, 
  Database, 
  Search,
  Settings,
  Users,
  Package,
  AlertTriangle,
  Loader2,
  ChevronUp,
  ChevronDown,
  Filter
} from "lucide-react";
import ApiErrorsPanel from "@/components/ApiErrorsPanel";
import { AdminAuth } from "@/lib/admin-auth";

// Product tracking data interface
interface TrackedProductAdmin {
  id: number;
  userId: string | null;
  email: string;
  productId: number;
  targetPrice: number;
  createdAt: string;
  product: {
    id: number;
    asin: string;
    title: string;
    url: string;
    currentPrice: number;
    originalPrice: number | null;
    lastChecked: string;
    createdAt: string;
  };
}

// Simplified data structure for admin display
interface ProductSummary {
  asin: string;
  title: string;
  currentPrice: number;
  trackedBy: string[];
  createdAt: string;
}

export default function AdminHub() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  
  // Get tab from URL query parameter
  const tab = new URLSearchParams(window.location.search).get("tab") || "email";
  const [activeTab, setActiveTab] = useState(tab);

  // Product tracking data state
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  
  // Sorting and filtering state
  const [sortBy, setSortBy] = useState<'createdAt' | 'price' | 'title' | 'asin'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [emailFilter, setEmailFilter] = useState('');

  // Update URL when tab changes
  const handleTabChange = (tab: string) => {
    console.log(`handleTabChange called with tab: ${tab}`);
    setActiveTab(tab);
    const newUrl = `/admin?tab=${tab}`;
    window.history.pushState({}, '', newUrl);
    setLocation(newUrl); // This ensures wouter updates the route
  };

  // Sorting function
  const handleSort = (column: 'createdAt' | 'price' | 'title' | 'asin') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  // Get sort icon for column headers
  const getSortIcon = (column: string) => {
    if (sortBy !== column) {
      return <ChevronUp className="h-4 w-4 opacity-30" />;
    }
    return sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
  };

  // Filter and sort products
  const filteredAndSortedProducts = products
    .filter(product => {
      if (!emailFilter) return true;
      const searchTerm = emailFilter.toLowerCase();
      return (
        product.title.toLowerCase().includes(searchTerm) ||
        product.asin.toLowerCase().includes(searchTerm) ||
        product.trackedBy.some(email => 
          email.toLowerCase().includes(searchTerm)
        )
      );
    })
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'price':
          comparison = a.currentPrice - b.currentPrice;
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'asin':
          comparison = a.asin.localeCompare(b.asin);
          break;
        default:
          comparison = 0;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // Fetch product tracking data
  const fetchProductData = async () => {
    const token = AdminAuth.getToken();
    if (!token) {
      setProductsError("Admin authentication required");
      return;
    }

    setProductsLoading(true);
    setProductsError(null);
    
    try {
      console.log("Fetching admin product data...");
      const response = await fetch(`/api/admin/products?token=${token}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.status}`);
      }
      
      const rawData: TrackedProductAdmin[] = await response.json();
      console.log("Raw admin product data:", rawData);
      
      // Transform data into ProductSummary format
      const productMap = new Map<string, ProductSummary>();
      
      rawData.forEach((item) => {
        const asin = item.product.asin;
        
        if (productMap.has(asin)) {
          // Add email to existing product's trackedBy array
          productMap.get(asin)!.trackedBy.push(item.email);
        } else {
          // Create new product summary
          productMap.set(asin, {
            asin: item.product.asin,
            title: item.product.title,
            currentPrice: item.product.currentPrice,
            trackedBy: [item.email],
            createdAt: item.product.createdAt
          });
        }
      });
      
      const transformedProducts = Array.from(productMap.values());
      console.log("Transformed product data:", transformedProducts);
      
      setProducts(transformedProducts);
      
    } catch (error) {
      console.error("Error fetching product data:", error);
      setProductsError(error instanceof Error ? error.message : "Failed to fetch product data");
    } finally {
      setProductsLoading(false);
    }
  };

  // Listen for browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const urlTab = new URLSearchParams(window.location.search).get("tab") || "email";
      setActiveTab(urlTab);
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Fetch product data when manage-products tab is active
  useEffect(() => {
    if (activeTab === 'manage-products') {
      fetchProductData();
    }
  }, [activeTab]);

  // Update tab when URL changes
  useEffect(() => {
    const urlTab = new URLSearchParams(window.location.search).get("tab") || "email";
    setActiveTab(urlTab);
  }, [location]);

  const emailTools = [
    {
      name: "Email Testing",
      description: "Test email templates and sending",
      href: `/admin/email-test`,
      icon: Send,
      badge: "Core"
    },
    {
      name: "Email Logs",
      description: "View sent email history",
      href: `/admin/email-logs`,
      icon: FileText,
      badge: "Logs"
    },
    {
      name: "Force Alerts",
      description: "Manually trigger price drop alerts",
      href: `/admin/force-alerts`,
      icon: Zap,
      badge: "Testing"
    }
  ];

  const analyticsTools = [
    {
      name: "Admin Dashboard",
      description: "System statistics and metrics",
      tabId: "dashboard",
      icon: BarChart3,
      badge: "Live"
    },
    {
      name: "API Monitor",
      description: "Monitor API performance and errors",
      tabId: "api-monitor",
      icon: Activity,
      badge: "Real-time"
    },
    {
      name: "API Errors",
      description: "View and track API errors",
      tabId: "api-errors",
      icon: AlertTriangle,
      badge: "Debug"
    }
  ];

  const systemTools = [
    {
      name: "ASIN Inspector",
      description: "Inspect individual product data",
      tabId: "asin-inspector",
      icon: Search,
      badge: "Debug"
    },
    {
      name: "Cache Management",
      description: "Manage system cache",
      tabId: "cache-management",
      icon: Database,
      badge: "System"
    }
  ];

  const productTools = [
    {
      name: "Manage Products",
      description: "View and manage all tracked products",
      tabId: "manage-products",
      icon: Package,
      badge: "Management"
    }
  ];

  const ToolCard = ({ tool }: { tool: any }) => (
    <Card 
      key={tool.name} 
      className="cursor-pointer transition-all hover:shadow-md hover:scale-105"
      onClick={() => {
        console.log(`Navigating to tab: ${tool.tabId}`);
        handleTabChange(tool.tabId);
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <tool.icon className="h-5 w-5 text-blue-600" />
          <Badge variant="secondary" className="text-xs">
            {tool.badge}
          </Badge>
        </div>
        <h3 className="font-semibold mb-1">{tool.name}</h3>
        <p className="text-sm text-gray-600 leading-relaxed">
          {tool.description}
        </p>
      </CardContent>
    </Card>
  );

  const renderTabContent = () => {
    // Handle sub-tools within tabs
    if (activeTab.includes('-')) {
      const [mainTab, subTool] = activeTab.split('-', 2);
      
      switch (activeTab) {
        case 'dashboard':
          return (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Admin Dashboard
                </CardTitle>
                <CardDescription>System statistics and metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="text-center py-12">
                    <BarChart3 className="h-16 w-16 mx-auto mb-4 text-blue-600" />
                    <h3 className="text-xl font-semibold mb-2">System Analytics</h3>
                    <p className="text-gray-600">Dashboard content will be loaded here</p>
                    <Button className="mt-4" onClick={() => handleTabChange('analytics')}>
                      Back to Analytics Tools
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        case 'api-monitor':
          return (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  API Monitor
                </CardTitle>
                <CardDescription>Monitor API performance and errors</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="text-center py-12">
                    <Activity className="h-16 w-16 mx-auto mb-4 text-green-600" />
                    <h3 className="text-xl font-semibold mb-2">API Performance</h3>
                    <p className="text-gray-600">Real-time API monitoring will be displayed here</p>
                    <Button className="mt-4" onClick={() => handleTabChange('analytics')}>
                      Back to Analytics Tools
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        case 'api-errors':
          return <ApiErrorsPanel />;
        case 'asin-inspector':
          return (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  ASIN Inspector
                </CardTitle>
                <CardDescription>Inspect individual product data</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="text-center py-12">
                    <Search className="h-16 w-16 mx-auto mb-4 text-purple-600" />
                    <h3 className="text-xl font-semibold mb-2">Product Inspector</h3>
                    <p className="text-gray-600">ASIN inspection tools will be available here</p>
                    <Button className="mt-4" onClick={() => handleTabChange('tools')}>
                      Back to System Tools
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        case 'cache-management':
          return (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Cache Management
                </CardTitle>
                <CardDescription>Manage system cache</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="text-center py-12">
                    <Database className="h-16 w-16 mx-auto mb-4 text-blue-600" />
                    <h3 className="text-xl font-semibold mb-2">Cache Control</h3>
                    <p className="text-gray-600">Cache management interface will be implemented here</p>
                    <Button className="mt-4" onClick={() => handleTabChange('tools')}>
                      Back to System Tools
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        case 'manage-products':
          return (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Manage Products
                </CardTitle>
                <CardDescription>View and manage all tracked products</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Page Header */}
                  <div>
                    <h3 className="text-lg font-medium">Tracked Products Overview</h3>
                    <p className="text-sm text-gray-600">Products currently being tracked by users</p>
                  </div>

                  {/* Loading State */}
                  {productsLoading && (
                    <div className="text-center py-8">
                      <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin text-blue-600" />
                      <p className="text-gray-600">Loading product data...</p>
                    </div>
                  )}

                  {/* Error State */}
                  {productsError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-red-700">
                        <AlertTriangle className="h-5 w-5" />
                        <span className="font-medium">Error Loading Products</span>
                      </div>
                      <p className="text-red-600 mt-1 text-sm">{productsError}</p>
                    </div>
                  )}

                  {/* Data Display */}
                  {!productsLoading && !productsError && (
                    <div className="space-y-4">
                      {/* Product Controls Panel */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Product Controls</CardTitle>
                          <CardDescription>Manage and filter tracked products</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {/* Controls Row 1: Sort, Search, Status Filter */}
                            <div className="flex flex-wrap gap-4 items-center">
                              <div className="flex-1 min-w-[200px]">
                                <label className="text-sm font-medium text-gray-700 mb-1 block">
                                  Search Products
                                </label>
                                <div className="relative">
                                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                  <Input
                                    type="text"
                                    placeholder="Search by title, ASIN, or email..."
                                    value={emailFilter}
                                    onChange={(e) => setEmailFilter(e.target.value)}
                                    className="pl-10"
                                  />
                                </div>
                              </div>
                              
                              <div className="min-w-[150px]">
                                <label className="text-sm font-medium text-gray-700 mb-1 block">
                                  Sort By
                                </label>
                                <select
                                  value={sortBy}
                                  onChange={(e) => setSortBy(e.target.value as 'createdAt' | 'price' | 'title' | 'asin')}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="createdAt">Date Added</option>
                                  <option value="price">Price</option>
                                  <option value="title">Product Name</option>
                                  <option value="asin">ASIN</option>
                                </select>
                              </div>

                              <div className="min-w-[120px]">
                                <label className="text-sm font-medium text-gray-700 mb-1 block">
                                  Status
                                </label>
                                <select
                                  defaultValue="active"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="active">Active</option>
                                  <option value="paused">Paused</option>
                                  <option value="all">All</option>
                                </select>
                              </div>
                            </div>

                            {/* Controls Row 2: Action Buttons */}
                            <div className="flex flex-wrap gap-2 items-center justify-between">
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEmailFilter('');
                                    setSortBy('createdAt');
                                    setSortOrder('desc');
                                  }}
                                >
                                  Clear Filters
                                </Button>
                                <Button variant="outline" size="sm">
                                  Export CSV
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={fetchProductData}
                                  disabled={productsLoading}
                                >
                                  {productsLoading ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      Refreshing...
                                    </>
                                  ) : (
                                    'Refresh'
                                  )}
                                </Button>
                                <Button variant="outline" size="sm">
                                  Debug API
                                </Button>
                              </div>
                              
                              <div className="text-sm text-gray-600">
                                Showing {filteredAndSortedProducts.length} of {products.length} products
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Product Data Summary */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="font-medium text-blue-800 mb-2">Product Data Summary</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-blue-600 font-medium">Total Products:</span>
                            <div className="text-lg font-bold text-blue-800">{products.length}</div>
                          </div>
                          <div>
                            <span className="text-blue-600 font-medium">Total Trackers:</span>
                            <div className="text-lg font-bold text-blue-800">
                              {products.reduce((sum, p) => sum + p.trackedBy.length, 0)}
                            </div>
                          </div>
                          <div>
                            <span className="text-blue-600 font-medium">Avg. Price:</span>
                            <div className="text-lg font-bold text-blue-800">
                              ${products.length > 0 ? (products.reduce((sum, p) => sum + p.currentPrice, 0) / products.length).toFixed(2) : '0.00'}
                            </div>
                          </div>
                          <div>
                            <span className="text-blue-600 font-medium">Status:</span>
                            <div className="text-lg font-bold text-green-600">Live</div>
                          </div>
                        </div>
                      </div>

                      {/* Products Table */}
                      <div className="bg-white border rounded-lg">
                        <div className="p-4 border-b">
                          <h4 className="font-medium text-gray-800">Tracked Products</h4>
                          <p className="text-sm text-gray-600">All products currently being tracked by users (click column headers to sort)</p>
                        </div>
                        
                        {products.length === 0 ? (
                          <div className="text-center py-8 text-gray-500">
                            <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                            <p>No tracked products found</p>
                            <p className="text-sm">Products will appear here once users start tracking them</p>
                          </div>
                        ) : filteredAndSortedProducts.length === 0 ? (
                          <div className="text-center py-8 text-gray-500">
                            <Search className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                            <p>No products match your filter</p>
                            <p className="text-sm">Try adjusting your email filter</p>
                          </div>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead 
                                  className="cursor-pointer hover:bg-gray-50 select-none"
                                  onClick={() => handleSort('title')}
                                >
                                  <div className="flex items-center gap-1">
                                    Title
                                    {getSortIcon('title')}
                                  </div>
                                </TableHead>
                                <TableHead 
                                  className="cursor-pointer hover:bg-gray-50 select-none"
                                  onClick={() => handleSort('asin')}
                                >
                                  <div className="flex items-center gap-1">
                                    ASIN
                                    {getSortIcon('asin')}
                                  </div>
                                </TableHead>
                                <TableHead 
                                  className="cursor-pointer hover:bg-gray-50 select-none"
                                  onClick={() => handleSort('price')}
                                >
                                  <div className="flex items-center gap-1">
                                    Current Price
                                    {getSortIcon('price')}
                                  </div>
                                </TableHead>
                                <TableHead>Tracked Emails</TableHead>
                                <TableHead 
                                  className="cursor-pointer hover:bg-gray-50 select-none"
                                  onClick={() => handleSort('createdAt')}
                                >
                                  <div className="flex items-center gap-1">
                                    Created Date
                                    {getSortIcon('createdAt')}
                                    {sortBy === 'createdAt' && (
                                      <Badge variant="secondary" className="ml-1 text-xs">
                                        Default
                                      </Badge>
                                    )}
                                  </div>
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredAndSortedProducts.map((product) => (
                                <TableRow key={product.asin}>
                                  <TableCell className="max-w-xs">
                                    <div className="truncate" title={product.title}>
                                      {product.title}
                                    </div>
                                  </TableCell>
                                  <TableCell className="font-mono text-sm">
                                    {product.asin}
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    ${product.currentPrice.toFixed(2)}
                                  </TableCell>
                                  <TableCell className="max-w-xs">
                                    <div className="truncate" title={product.trackedBy.join(', ')}>
                                      {product.trackedBy.map((email, index) => (
                                        <span key={index}>
                                          {emailFilter && email.toLowerCase().includes(emailFilter.toLowerCase()) ? (
                                            <mark className="bg-yellow-200 px-1 rounded">
                                              {email}
                                            </mark>
                                          ) : (
                                            email
                                          )}
                                          {index < product.trackedBy.length - 1 && ', '}
                                        </span>
                                      ))}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-sm text-gray-600">
                                    {new Date(product.createdAt).toLocaleDateString('en-US', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric'
                                    })}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Back Button */}
                  <div className="pt-4">
                    <Button variant="outline" onClick={() => handleTabChange('products')}>
                      Back to Products
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        default:
          return null;
      }
    }

    // Main tab content (tool grid views)
    switch (activeTab) {
      case 'email':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email System
              </CardTitle>
              <CardDescription>Test and manage email functionality</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {emailTools.map((tool) => (
                  <Link key={tool.name} href={tool.href}>
                    <Card className="cursor-pointer transition-all hover:shadow-md hover:scale-105">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <tool.icon className="h-5 w-5 text-blue-600" />
                          <Badge variant="secondary" className="text-xs">
                            {tool.badge}
                          </Badge>
                        </div>
                        <h3 className="font-semibold mb-1">{tool.name}</h3>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          {tool.description}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        );

      case 'analytics':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Analytics & Monitoring
              </CardTitle>
              <CardDescription>System performance and error tracking</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {analyticsTools.map((tool) => (
                  <ToolCard key={tool.name} tool={tool} />
                ))}
              </div>
            </CardContent>
          </Card>
        );

      case 'tools':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                System Tools
              </CardTitle>
              <CardDescription>Database and system management</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {systemTools.map((tool) => (
                  <ToolCard key={tool.name} tool={tool} />
                ))}
              </div>
            </CardContent>
          </Card>
        );

      case 'products':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Products Management
              </CardTitle>
              <CardDescription>View and manage all tracked products</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {productTools.map((tool) => (
                  <ToolCard key={tool.name} tool={tool} />
                ))}
              </div>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <AdminLayout 
      title="Admin Hub" 
      description="Comprehensive administrative control panel for BytSave system management"
    >
      <div className="space-y-6">
        {/* System Status Overview */}
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-green-700">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="font-medium">System Status: Online</span>
            </div>
            <p className="text-sm text-green-600 mt-1">
              All admin tools are accessible and functioning normally.
            </p>
          </CardContent>
        </Card>

        {/* Tabbed Navigation */}
        <AdminTabNav activeTab={activeTab} onTabChange={handleTabChange} />

        {/* Tab Content */}
        {renderTabContent()}

        {/* Quick Actions - always visible */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Quick Actions
            </CardTitle>
            <CardDescription>Frequently used admin shortcuts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" asChild>
                <Link href={`/admin/email-test`}>
                  <Mail className="h-4 w-4 mr-2" />
                  Test Email
                </Link>
              </Button>
              <Button variant="outline" onClick={() => handleTabChange('dashboard')}>
                <BarChart3 className="h-4 w-4 mr-2" />
                View Stats
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/admin/email-logs`}>
                  <FileText className="h-4 w-4 mr-2" />
                  Email Logs
                </Link>
              </Button>
              <Button variant="outline" onClick={() => handleTabChange('api-errors')}>
                <AlertTriangle className="h-4 w-4 mr-2" />
                Check Errors
              </Button>
            </div>
          </CardContent>
        </Card>

        </div>
    </AdminLayout>
  );
}
