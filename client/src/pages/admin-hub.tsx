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
import LogTable from "@/components/LogTable";
import { AdminAuth } from "@/lib/admin-auth";
import AdminEmailTest from "./admin-email-test";

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
      href: `/admin/email-test`,
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
    switch (activeTab) {
      case 'email':
        return <EmailPanel />;
      case 'email-test':
        return <AdminEmailTest />;
      case 'analytics':
        return <AnalyticsPanel />;
      case 'tools':
        return <ToolsPanel />;
      case 'products':
        return <ProductsPanel />;
      default:
        return <EmailPanel />;
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