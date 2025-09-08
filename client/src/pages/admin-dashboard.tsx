import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCcw } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from "recharts";

// Error statistics interface
interface ErrorStats {
  total: number;
  byDate: {
    date: string;
    count: number;
  }[];
  byAsin: {
    asin: string;
    count: number;
  }[];
  byErrorType: {
    type: string;
    count: number;
  }[];
}

// Product statistics interface
interface ProductStats {
  total: number;
  tracked: number;
  withPriceHistory: number;
  withAlerts: number;
  recentlyAdded: {
    date: string;
    count: number;
  }[];
}

// System statistics interface
interface SystemStats {
  apiSuccessRate: number;
  averageResponseTime: number;
  lastPriceCheck: string;
  totalPriceChecks: number;
  checkHistory: {
    date: string;
    success: number;
    failed: number;
  }[];
}

// Dashboard data interface
interface DashboardData {
  errorStats: ErrorStats;
  productStats: ProductStats;
  systemStats: SystemStats;
}

// COLORS
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function AdminDashboard() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const { data: dashboardData, isLoading: isLoadingStats } = useQuery<DashboardData>({
    queryKey: ['/api/admin/stats', refreshTrigger],
    enabled: isAuthenticated,
  });

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
    toast({
      title: "Refreshing dashboard",
      description: "Fetching the latest statistics data..."
    });
  };

  // If not logged in or loading, show authentication required
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
        <p className="text-lg mb-8">Please log in with admin credentials to view this dashboard.</p>
        <Button onClick={() => window.location.href = "/auth"}>Go to Login</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <Button onClick={handleRefresh} variant="outline" className="flex items-center gap-2">
          <RefreshCcw className="h-4 w-4" />
          Refresh Data
        </Button>
      </div>

      {isLoadingStats ? (
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : dashboardData ? (
        <Tabs defaultValue="errors" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="errors">API Errors</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="system">System Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="errors" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <Card>
                <CardHeader>
                  <CardTitle>Error Overview</CardTitle>
                  <CardDescription>Total Amazon API errors: {dashboardData.errorStats.total}</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dashboardData.errorStats.byErrorType}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                        nameKey="type"
                      >
                        {dashboardData.errorStats.byErrorType.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Errors Over Time</CardTitle>
                  <CardDescription>Daily error count</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={dashboardData.errorStats.byDate}
                      margin={{
                        top: 5,
                        right: 30,
                        left: 20,
                        bottom: 5,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="count" stroke="#8884d8" activeDot={{ r: 8 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Errors by Product</CardTitle>
                <CardDescription>Products with the most API errors</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dashboardData.errorStats.byAsin}
                    margin={{
                      top: 5,
                      right: 30,
                      left: 20,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="asin" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Products</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardData.productStats.total}</div>
                  <p className="text-xs text-muted-foreground">Products in database</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Tracked Products</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardData.productStats.tracked}</div>
                  <p className="text-xs text-muted-foreground">Products being tracked by users</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardData.productStats.withAlerts}</div>
                  <p className="text-xs text-muted-foreground">Products with price alerts</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Products Added Over Time</CardTitle>
                <CardDescription>New products added per day</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={dashboardData.productStats.recentlyAdded}
                    margin={{
                      top: 5,
                      right: 30,
                      left: 20,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="count" stroke="#82ca9d" activeDot={{ r: 8 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="system" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">API Success Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardData.systemStats.apiSuccessRate}%</div>
                  <p className="text-xs text-muted-foreground">Last 24 hours</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardData.systemStats.averageResponseTime}ms</div>
                  <p className="text-xs text-muted-foreground">Last 24 hours</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Price Checks</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardData.systemStats.totalPriceChecks}</div>
                  <p className="text-xs text-muted-foreground">All time</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Last Price Check</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{new Date(dashboardData.systemStats.lastPriceCheck).toLocaleTimeString()}</div>
                  <p className="text-xs text-muted-foreground">{new Date(dashboardData.systemStats.lastPriceCheck).toLocaleDateString()}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Price Check Performance</CardTitle>
                <CardDescription>Success vs. failure rate over time</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dashboardData.systemStats.checkHistory}
                    margin={{
                      top: 5,
                      right: 30,
                      left: 20,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="success" stackId="a" fill="#82ca9d" />
                    <Bar dataKey="failed" stackId="a" fill="#ff8042" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <div className="text-center py-16">
          <h2 className="text-2xl font-bold mb-4">No data available</h2>
          <p className="mb-6">Unable to fetch dashboard statistics.</p>
          <Button onClick={handleRefresh}>Try Again</Button>
        </div>
      )}
    </div>
  );
}