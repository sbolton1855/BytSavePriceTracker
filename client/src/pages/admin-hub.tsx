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
    // Don't call setLocation to prevent admin hub reload
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

  // Get sort icon for column headers
  const getSortIcon = (column: string) => {
    if (sortBy !== column) {
      return <ChevronUp className="h-4 w-4 opacity-30" />;
    }
    return sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
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
          const productColumns = [
            {
              key: 'title',
              label: 'Title',
              sortable: true,
              render: (value: string) => (
                <div className="truncate font-medium max-w-xs" title={value}>
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
              className: 'text-center',
              render: (value: number, row: any) => (
                <Badge variant="secondary" className="text-xs">
                  {value || (Array.isArray(row.trackedBy) ? row.trackedBy.length : 0)}
                </Badge>
              )
            },
            {
              key: 'trackedBy',
              label: 'Tracked Emails',
              render: (value: string[], row: any) => (
                <div className="truncate text-sm max-w-xs" title={Array.isArray(value) ? value.join(', ') : ''}>
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
                <span className="text-sm text-gray-600">
                  {value ? 
                    new Date(value).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : 'N/A'}
                </span>
              )
            },
            {
              key: 'createdAt',
              label: 'Created Date',
              sortable: true,
              render: (value: string) => (
                <span className="text-sm text-gray-600">
                  {new Date(value).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </span>
              )
            }
          ];

          const productSummary = (
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
          );

          const extraControls = (
            <>
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
            </>
          );

          return (
            <div className="space-y-4">
              <LogTable
                title="Tracked Products"
                description="All products currently being tracked by users"
                icon={Package}
                data={displayedProducts}
                columns={productColumns}
                loading={productsLoading}
                error={productsError}
                searchFilter={searchFilter}
                sortBy={sortBy}
                sortOrder={sortOrder}
                pagination={productsPagination}
                onSearch={handleSearch}
                onSort={handleSort}
                onPageChange={handlePageChange}
                onRefresh={() => fetchProductData()}
                onExport={() => {
                  // TODO: Implement CSV export
                  console.log('Export CSV clicked');
                }}
                extraControls={extraControls}
                summary={productSummary}
                emptyMessage="No tracked products found. Products will appear here once users start tracking them."
                emptyIcon={Package}
              />
              
              {/* Back Button */}
              <div className="pt-4">
                <Button variant="outline" onClick={() => handleTabChange('products')}>
                  Back to Products
                </Button>
              </div>
            </div>
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
        {/* Tabbed Navigation */}
        <AdminTabNav activeTab={activeTab} onTabChange={handleTabChange} />

        {/* Tab Content */}
        {renderTabContent()}

        {/* Quick Actions - only show on main tabs, not sub-tools */}
        {!activeTab.includes('-') && (
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
        )}
      </div>
    </AdminLayout>
  );
}