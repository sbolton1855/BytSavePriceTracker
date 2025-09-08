import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
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
  PieChart,
  Pie,
  Cell
} from "recharts";

// API Error interface
interface ApiError {
  id: number;
  asin: string;
  errorType: string;
  errorMessage: string;
  createdAt: string;
  resolved: boolean;
}

// Error statistics interface
interface ErrorStats {
  total: number;
  byErrorType: {
    errorType: string;
    count: number;
  }[];
  byAsin: {
    asin: string;
    count: number;
  }[];
  recentErrors: ApiError[];
}

// COLORS
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function ApiMonitor() {
  const { toast } = useToast();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const { data: errorStats, isLoading } = useQuery<ErrorStats>({
    queryKey: ['/api/admin/errors', refreshTrigger],
  });

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
    toast({
      title: "Refreshing data",
      description: "Fetching the latest error statistics..."
    });
  };

  // Format timestamp to a readable format
  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Amazon API Error Monitor</h1>
        <Button onClick={handleRefresh} variant="outline" className="flex items-center gap-2">
          <RefreshCcw className="h-4 w-4" />
          Refresh Data
        </Button>
      </div>

      {!errorStats ? (
        <div className="text-center py-16">
          <h2 className="text-2xl font-bold mb-4">No data available</h2>
          <p className="mb-6">There are no API errors logged yet.</p>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Total API Errors</CardTitle>
                <CardDescription>All time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold">{errorStats.total}</div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="byType" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="byType">Errors by Type</TabsTrigger>
              <TabsTrigger value="byProduct">Errors by Product</TabsTrigger>
            </TabsList>

            <TabsContent value="byType" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Errors by Type</CardTitle>
                  <CardDescription>Most common error categories</CardDescription>
                </CardHeader>
                <CardContent className="h-[400px]">
                  {errorStats.byErrorType.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p>No error type data available</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={errorStats.byErrorType}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ errorType, percent }) => `${errorType}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={150}
                          fill="#8884d8"
                          dataKey="count"
                          nameKey="errorType"
                        >
                          {errorStats.byErrorType.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="byProduct" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Errors by Product (ASIN)</CardTitle>
                  <CardDescription>Products with the most API errors</CardDescription>
                </CardHeader>
                <CardContent className="h-[400px]">
                  {errorStats.byAsin.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p>No product error data available</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={errorStats.byAsin}
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
                        <Bar dataKey="count" fill="#8884d8" name="Error Count" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <Card>
            <CardHeader>
              <CardTitle>Recent API Errors</CardTitle>
              <CardDescription>Latest Amazon API errors</CardDescription>
            </CardHeader>
            <CardContent>
              {errorStats.recentErrors.length === 0 ? (
                <p>No recent errors</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Time
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          ASIN
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Error Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Error Message
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {errorStats.recentErrors.map((error) => (
                        <tr key={error.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(error.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {error.asin}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {error.errorType}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                            {error.errorMessage}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${error.resolved ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {error.resolved ? 'Resolved' : 'Active'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* API Errors Section */}
      <div className="grid gap-6">
        <div>
          <h2 className="text-2xl font-bold mb-4">Recent API Errors</h2>
          <div className="bg-white rounded-lg shadow p-6">
            {isLoading ? ( // Changed from errorsLoading to isLoading as the initial query is for errorStats
              <div className="text-center py-8">Loading API errors...</div>
            ) : errorStats?.recentErrors?.length > 0 ? (
              <div className="space-y-4">
                {errorStats.recentErrors.map((error: ApiError) => ( // Added type annotation for clarity
                  <div key={error.id} className="border-l-4 border-red-500 pl-4 py-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">
                          {error.errorType || 'Unknown Error'}
                        </p>
                        <p className="text-sm text-gray-600">
                          ASIN: {error.asin || 'N/A'}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          {error.errorMessage}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">
                          {formatDate(error.createdAt)}
                        </p>
                        {error.resolved && (
                          <span className="inline-block mt-1 px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                            Resolved
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No API errors found
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}