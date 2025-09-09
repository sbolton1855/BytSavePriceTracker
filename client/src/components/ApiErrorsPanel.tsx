
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { AdminAuth } from "@/lib/admin-auth";

// API Error interface matching the backend structure
interface ApiError {
  id: number;
  asin: string;
  errorType: string;
  errorMessage: string;
  createdAt: string;
  resolved: boolean;
}

// Response structure for API errors
interface ApiErrorsResponse {
  total: number;
  recentErrors: ApiError[];
}

export default function ApiErrorsPanel() {
  const { toast } = useToast();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const { data: errorData, isLoading, refetch } = useQuery<ApiErrorsResponse>({
    queryKey: ['/api/admin/errors', refreshTrigger],
    queryFn: async () => {
      const token = AdminAuth.getToken() || 'admin-test-token';
      if (!token) {
        throw new Error("Unauthorized");
      }

      const response = await fetch('/api/admin/errors', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[DEBUG] API Errors Response:', data);
      
      return data;
    },
    enabled: !!AdminAuth.isAuthenticated(),
  });

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
    toast({
      title: "Refreshing data",
      description: "Fetching the latest API error data..."
    });
  };

  /**
   * Get appropriate badge for resolved status
   */
  const getResolvedBadge = (resolved: boolean) => {
    if (resolved) {
      return (
        <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Resolved
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-red-100 text-red-800 flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          Active
        </Badge>
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <h2 className="text-2xl font-bold">API Error Monitor</h2>
        </div>
        <Button onClick={handleRefresh} variant="outline" className="flex items-center gap-2">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {/* API Errors Table */}
      <Card>
        <CardHeader>
          <CardTitle>API Error Logs</CardTitle>
          <CardDescription>
            Amazon API errors and debugging information
          </CardDescription>
          <div className="flex items-center gap-4 text-sm text-gray-600 mt-2">
            <span><strong>Total Errors:</strong> {errorData?.total || 0}</span>
            <span><strong>Recent Errors:</strong> {errorData?.recentErrors?.length || 0}</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              Loading API errors...
            </div>
          ) : !errorData?.recentErrors || errorData.recentErrors.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No API errors found</p>
              <p>API error logs will appear here when errors occur</p>
              {errorData && (
                <p className="text-sm mt-2 text-blue-600">
                  API returned: {JSON.stringify(errorData)}
                </p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>ASIN</TableHead>
                  <TableHead>Error Type</TableHead>
                  <TableHead>Error Message</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {errorData.recentErrors.map((error) => (
                  <TableRow key={error.id}>
                    
                    {/* Error ID */}
                    <TableCell className="font-mono text-sm">{error.id}</TableCell>

                    {/* ASIN */}
                    <TableCell className="font-mono text-sm">
                      {error.asin}
                    </TableCell>

                    {/* Error Type */}
                    <TableCell className="max-w-xs truncate">
                      {error.errorType}
                    </TableCell>

                    {/* Error Message */}
                    <TableCell className="max-w-xs truncate">
                      {error.errorMessage}
                    </TableCell>

                    {/* Created At Timestamp */}
                    <TableCell>
                      <div className="text-sm">
                        {new Date(error.createdAt).toLocaleString()}
                      </div>
                    </TableCell>

                    {/* Resolved Status */}
                    <TableCell>
                      {getResolvedBadge(error.resolved)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
