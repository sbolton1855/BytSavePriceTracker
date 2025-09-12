import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import AdminLayout from "@/components/AdminLayout";
import AdminTabNav from "@/components/AdminTabNav";
import { Link, useLocation } from "wouter";
import { useState, useEffect, useMemo } from "react";
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
import EmailLogsPanel from "@/components/EmailLogsPanel";
import EmailTestPanel from "@/components/EmailTestPanel";
import LogTable from "@/components/LogTable";
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
  lastChecked?: string;
  trackerCount?: number;
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
  const [productsPagination, setProductsPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });

  // Sorting and filtering state
  const [sortBy, setSortBy] = useState<'createdAt' | 'currentPrice' | 'title' | 'asin' | 'lastChecked'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchFilter, setSearchFilter] = useState('');

  // Update URL when tab changes
  const handleTabChange = (tab: string) => {
    console.log(`handleTabChange called with tab: ${tab}`);
    setActiveTab(tab);
    const newUrl = `/admin?tab=${tab}`;
    window.history.pushState({}, '', newUrl);
    setLocation(newUrl); // This ensures wouter updates the route
  };

  // Sorting function
  const handleSort = (column: 'createdAt' | 'currentPrice' | 'title' | 'asin' | 'lastChecked') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
    // Trigger refetch when sorting changes
    fetchProductData();
  };



  // Handle pagination
  const handlePageChange = (newPage: number) => {
    fetchProductData(newPage);
  };

  // Handle search with debouncing
  const handleSearch = (value: string) => {
    setSearchFilter(value);
    // Reset to page 1 when searching
    setProductsPagination(prev => ({ ...prev, page: 1 }));
    // Trigger search after a short delay
    setTimeout(() => fetchProductData(1), 300);
  };

  // Products are already sorted and filtered on the server side
  const displayedProducts = useMemo(() => {
    console.log('Computing displayedProducts - products:', products, 'searchFilter:', searchFilter);

    if (!Array.isArray(products)) {
      console.log('Products is not an array:', typeof products);
      return [];
    }

    let filtered = products;
    if (searchFilter) {
      filtered = products.filter(product => 
        product.product?.title?.toLowerCase().includes(searchFilter.toLowerCase()) ||
        product.product?.asin?.toLowerCase().includes(searchFilter.toLowerCase()) ||
        product.email?.toLowerCase().includes(searchFilter.toLowerCase())
      );
      console.log('Filtered products by search:', filtered.length);
    }

    console.log('Final displayedProducts:', filtered.length);
    return filtered;
  }, [products, searchFilter]);

  // Fetch product tracking data with pagination and sorting
  const fetchProductData = async (page = productsPagination.page) => {
    const token = AdminAuth.getToken();
    if (!token) {
      setProductsError("Admin authentication required");
      return;
    }

    setProductsLoading(true);
    setProductsError(null);

    try {
      console.log("🚀 BEFORE API CALL - Fetching admin product data...");
      const params = new URLSearchParams({
        token,
        page: page.toString(),
        limit: productsPagination.limit.toString(),
        sortBy,
        sortOrder,
        ...(searchFilter && { search: searchFilter })
      });

      console.log("🔗 API URL:", `/api/admin/products?${params}`);
      const response = await fetch(`/api/admin/products?${params}`);

      console.log("📡 AFTER API CALL - Response status:", response.status, response.statusText);

      if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.status}`);
      }

      const result = await response.json();
      console.log("📊 FULL API RESPONSE:", result);
      console.log("📋 response.data:", result.data);
      console.log("📋 response.pagination:", result.pagination);
      console.log("📋 Is result.data an array?", Array.isArray(result.data));
      console.log("📋 Is result itself an array?", Array.isArray(result));

      // Handle both paginated response format and direct array format
      let products = [];
      if (Array.isArray(result.data)) {
        // Paginated response format: { data: [...], pagination: {...} }
        products = result.data;
      } else if (Array.isArray(result)) {
        // Direct array response format: [...]
        products = result;
      } else {
        console.warn("Unexpected API response format:", result);
        products = [];
      }

      console.log("✅ Processed products array:", products);
      console.log("📊 Products array length:", products.length);

      // Transform data into ProductSummary format with tracker counts
      const productMap = new Map<string, ProductSummary & { lastChecked: string; trackerCount: number }>();

      products.forEach((item: TrackedProductAdmin) => {
        const asin = item.product.asin;

        if (productMap.has(asin)) {
          // Add email to existing product's trackedBy array
          const existing = productMap.get(asin)!;
          existing.trackedBy.push(item.email);
          existing.trackerCount = existing.trackedBy.length;
        } else {
          // Create new product summary
          productMap.set(asin, {
            asin: item.product.asin,
            title: item.product.title,
            currentPrice: item.product.currentPrice,
            trackedBy: [item.email],
            createdAt: item.product.createdAt,
            lastChecked: item.product.lastChecked,
            trackerCount: 1
          });
        }
      });

      const transformedProducts = Array.from(productMap.values());
      console.log("Transformed product data:", transformedProducts);

      setProducts(transformedProducts);

      // Handle pagination - use provided pagination or create default for direct array
      if (result.pagination) {
        setProductsPagination(result.pagination);
      } else {
        // Direct array response - create simple pagination
        setProductsPagination({
          page: 1,
          limit: transformedProducts.length,
          total: transformedProducts.length,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        });
      }

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
      onClick: () => handleTabChange('email-test'), // Changed from href to onClick
      icon: Send,
      badge: "Core"
    },
    {
      name: "Email Logs",
      description: "View sent email history",
      tabId: "email-logs",
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
        if (tool.tabId) {
          console.log(`Navigating to tab: ${tool.tabId}`);
          handleTabChange(tool.tabId);
        } else if (tool.onClick) {
          tool.onClick();
        }
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
        case 'email-logs':
          return (
            <div className="space-y-6">
              <EmailLogsPanel />
              <div className="pt-4">
                <Button variant="outline" onClick={() => handleTabChange('email')}>
                  Back to Email System
                </Button>
              </div>
            </div>
          );
        case 'email-test': // Added case for email-test tab
          return (
            <div className="space-y-6">
              <EmailTestPanel />
              <div className="pt-4">
                <Button variant="outline" onClick={() => handleTabChange('email')}>
                  Back to Email System
                </Button>
              </div>
            </div>
          );
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
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => fetchProductData()} 
                        className="mt-3"
                      >
                        Try Again
                      </Button>
                    </div>
                  )}

                  {/* Empty Data State */}
                  {!productsLoading && !productsError && (!products || products.length === 0) && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-yellow-700">
                        <AlertTriangle className="h-5 w-5" />
                        <span className="font-medium">No Product Data</span>
                      </div>
                      <p className="text-yellow-600 mt-1 text-sm">No tracked products found. Data may still be loading or there might be a connectivity issue.</p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => fetchProductData()} 
                        className="mt-3"
                      >
                        Refresh Data
                      </Button>
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
                                    value={searchFilter}
                                    onChange={(e) => handleSearch(e.target.value)}
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
                                  onChange={(e) => setSortBy(e.target.value as 'createdAt' | 'currentPrice' | 'title' | 'asin' | 'lastChecked')}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="createdAt">Date Added</option>
                                  <option value="currentPrice">Price</option>
                                  <option value="title">Product Name</option>
                                  <option value="asin">ASIN</option>
                                  <option value="lastChecked">Last Updated</option>
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
                                    setSearchFilter('');
                                    setSortBy('createdAt');
                                    setSortOrder('desc');
                                    fetchProductData(1);
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
                                  onClick={() => fetchProductData()}
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
                                Showing {products.length} of {productsPagination.total} products
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
                            <div className="text-lg font-bold text-blue-800">{Array.isArray(products) ? products.length : 0}</div>
                          </div>
                          <div>
                            <span className="text-blue-600 font-medium">Total Trackers:</span>
                            <div className="text-lg font-bold text-blue-800">
                              {Array.isArray(products) ? products.reduce((sum, p) => sum + (Array.isArray(p.trackedBy) ? p.trackedBy.length : 0), 0) : 0}
                            </div>
                          </div>
                          <div>
                            <span className="text-blue-600 font-medium">Avg. Price:</span>
                            <div className="text-lg font-bold text-blue-800">
                              ${Array.isArray(products) && products.length > 0 ? (products.reduce((sum, p) => sum + (typeof p.currentPrice === 'number' ? p.currentPrice : 0), 0) / products.length).toFixed(2) : '0.00'}
                            </div>
                          </div>
                          <div>
                            <span className="text-blue-600 font-medium">Status:</span>
                            <div className="text-lg font-bold text-green-600">
                              {Array.isArray(products) && products.length > 0 ? 'Live' : 'No Data'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Products LogTable */}
                      <LogTable
                        data={displayedProducts}
                        loading={productsLoading}
                        error={productsError}
                        columns={[
                          {
                            key: 'title',
                            label: 'Title',
                            sortable: true,
                            render: (value: string) => (
                              <div className="max-w-xs truncate font-medium" title={value}>
                                {value}
                              </div>
                            )
                          },
                          {
                            key: 'asin',
                            label: 'ASIN',
                            sortable: true,
                            render: (value: string) => (
                              <span className="font-mono text-sm">{value}</span>
                            )
                          },
                          {
                            key: 'currentPrice',
                            label: 'Current Price',
                            sortable: true,
                            render: (value: number) => (
                              <span className="font-medium">${value.toFixed(2)}</span>
                            )
                          },
                          {
                            key: 'trackerCount',
                            label: '# of Trackers',
                            render: (value: number, row: ProductSummary) => (
                              <Badge variant="secondary" className="text-xs">
                                {value || row.trackedBy.length}
                              </Badge>
                            ),
                            className: 'text-center'
                          },
                          {
                            key: 'trackedBy',
                            label: 'Tracked Emails',
                            render: (value: string[]) => (
                              <div className="max-w-xs truncate text-sm" title={Array.isArray(value) ? value.join(', ') : ''}>
                                {Array.isArray(value) && value.map((email, index) => (
                                  <span key={index}>
                                    {searchFilter && email.toLowerCase().includes(searchFilter.toLowerCase()) ? (
                                      <mark className="bg-yellow-200 px-1 rounded">
                                        {email}
                                      </mark>
                                    ) : (
                                      email
                                    )}
                                    {index < value.length - 1 && ', '}
                                  </span>
                                ))}
                              </div>
                            )
                          },
                          {
                            key: 'lastChecked',
                            label: 'Last Updated',
                            sortable: true,
                            render: (value: string) => (
                              <div className="text-sm text-gray-600">
                                {value ? 
                                  new Date(value).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  }) : 'N/A'}
                              </div>
                            )
                          },
                          {
                            key: 'createdAt',
                            label: 'Created Date',
                            sortable: true,
                            render: (value: string, row: ProductSummary) => (
                              <div className="text-sm text-gray-600 flex items-center gap-2">
                                {new Date(value).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric'
                                })}
                                {sortBy === 'createdAt' && (
                                  <Badge variant="secondary" className="text-xs">
                                    Default
                                  </Badge>
                                )}
                              </div>
                            )
                          }
                        ]}
                        sortBy={sortBy || undefined}
                        sortOrder={sortOrder}
                        onSort={handleSort}
                        pagination={productsPagination}
                        onPageChange={handlePageChange}
                        onRefresh={() => fetchProductData()}
                        onExport={() => {
                          if (!products || products.length === 0) return;

                          const csvContent = [
                            ['ASIN', 'Title', 'Current Price', 'Tracker Count', 'Tracked By', 'Last Updated', 'Created Date'],
                            ...products.map(product => [
                              product.asin,
                              `"${product.title.replace(/"/g, '""')}"`,
                              product.currentPrice.toFixed(2),
                              product.trackerCount || product.trackedBy.length,
                              `"${product.trackedBy.join(', ')}"`,
                              (product as any).lastChecked ? new Date((product as any).lastChecked).toISOString() : 'N/A',
                              new Date(product.createdAt).toISOString()
                            ])
                          ].map(row => row.join(',')).join('\n');

                          const blob = new Blob([csvContent], { type: 'text/csv' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `products-${new Date().toISOString().split('T')[0]}.csv`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        title="Tracked Products"
                        emptyMessage="No tracked products found. Products will appear here once users start tracking them."
                        emptyIcon={<Package className="h-12 w-12 mx-auto text-gray-400" />}
                      >
                        {/* Data source indicator */}
                        <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                          <span><strong>Data source:</strong> DATABASE</span>
                          <span><strong>Products shown:</strong> {displayedProducts.length}</span>
                          {searchFilter && (
                            <span><strong>Search:</strong> "{searchFilter}"</span>
                          )}
                        </div>
                      </LogTable>
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
                  tool.href ? (
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
                  ) : (
                    <ToolCard key={tool.name} tool={tool} />
                  )
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

        </div>
    </AdminLayout>
  );
}