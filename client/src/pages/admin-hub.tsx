
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, AlertTriangle, Mail, Package, Settings, BarChart3 } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import AdminTabNav from "@/components/AdminTabNav";
import ApiErrorsPanel from "@/components/ApiErrorsPanel";
import EmailLogsPanel from "@/components/EmailLogsPanel";
import ProductsPanel from "@/components/ProductsPanel";
import AnalyticsPanel from "@/components/AnalyticsPanel";
import ToolsPanel from "@/components/ToolsPanel";
import EmailPanel from "@/components/EmailPanel";

export default function AdminHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'dashboard');
  const [systemStatus, setSystemStatus] = useState({
    apiHealth: 'healthy',
    emailService: 'operational',
    database: 'connected',
    lastUpdate: new Date().toISOString()
  });

  // Sync URL with active tab
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [searchParams, activeTab]);

  const handleTabChange = (tab: string) => {
    console.log('handleTabChange called with tab:', tab);
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'email-logs':
        return <EmailLogsPanel />;
      case 'api-errors':
        return <ApiErrorsPanel />;
      case 'products':
      case 'manage-products':
        return <ProductsPanel />;
      case 'analytics':
        return <AnalyticsPanel />;
      case 'tools':
        return <ToolsPanel />;
      case 'email':
        return <EmailPanel />;
      case 'dashboard':
      default:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">API Health</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-2">
                    <Badge variant={systemStatus.apiHealth === 'healthy' ? 'default' : 'destructive'}>
                      {systemStatus.apiHealth}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Email Service</CardTitle>
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-2">
                    <Badge variant={systemStatus.emailService === 'operational' ? 'default' : 'destructive'}>
                      {systemStatus.emailService}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Database</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-2">
                    <Badge variant={systemStatus.database === 'connected' ? 'default' : 'destructive'}>
                      {systemStatus.database}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Last Update</CardTitle>
                  <Settings className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-muted-foreground">
                    {new Date(systemStatus.lastUpdate).toLocaleTimeString()}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                  <CardDescription>Common administrative tasks</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <button
                    onClick={() => handleTabChange('email-logs')}
                    className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 flex items-center space-x-3"
                  >
                    <Mail className="h-5 w-5 text-blue-500" />
                    <span>View Email Logs</span>
                  </button>
                  <button
                    onClick={() => handleTabChange('api-errors')}
                    className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 flex items-center space-x-3"
                  >
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    <span>Check API Errors</span>
                  </button>
                  <button
                    onClick={() => handleTabChange('products')}
                    className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 flex items-center space-x-3"
                  >
                    <Package className="h-5 w-5 text-green-500" />
                    <span>Manage Products</span>
                  </button>
                  <button
                    onClick={() => handleTabChange('analytics')}
                    className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 flex items-center space-x-3"
                  >
                    <BarChart3 className="h-5 w-5 text-purple-500" />
                    <span>View Analytics</span>
                  </button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>System Overview</CardTitle>
                  <CardDescription>Current system status and metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Active Users</span>
                      <Badge variant="outline">Real-time</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Price Checks Today</span>
                      <Badge variant="outline">Automated</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Email Alerts Sent</span>
                      <Badge variant="outline">24h</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );
    }
  };

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Admin Hub</h1>
          <p className="text-gray-600">Centralized administration and monitoring</p>
        </div>

        {/* System Status Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>System Status</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm">All systems operational</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm">Real-time monitoring active</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span className="text-sm">Last updated: {new Date().toLocaleTimeString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Navigation Tabs */}
        <AdminTabNav activeTab={activeTab} onTabChange={handleTabChange} />

        {/* Tab Content */}
        <div className="mt-6">
          {renderTabContent()}
        </div>
      </div>
    </AdminLayout>
  );
}
