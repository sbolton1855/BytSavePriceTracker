
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  AlertTriangle
} from "lucide-react";

export default function AdminHub() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  
  // Get tab from URL query parameter
  const tab = new URLSearchParams(window.location.search).get("tab") || "email";
  const [activeTab, setActiveTab] = useState(tab);

  // Update URL when tab changes
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const newUrl = `/admin?tab=${tab}`;
    window.history.pushState({}, '', newUrl);
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
      onClick={() => handleTabChange(tool.tabId)}
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
          return (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  API Errors
                </CardTitle>
                <CardDescription>View and track API errors</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="text-center py-12">
                    <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-red-600" />
                    <h3 className="text-xl font-semibold mb-2">Error Tracking</h3>
                    <p className="text-gray-600">API error logs and debugging tools will be shown here</p>
                    <Button className="mt-4" onClick={() => handleTabChange('analytics')}>
                      Back to Analytics Tools
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
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
                  <div className="text-center py-12">
                    <Package className="h-16 w-16 mx-auto mb-4 text-green-600" />
                    <h3 className="text-xl font-semibold mb-2">Product Management</h3>
                    <p className="text-gray-600">Product management interface will be shown here</p>
                    <Button className="mt-4" onClick={() => handleTabChange('products')}>
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
