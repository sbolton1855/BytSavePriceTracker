

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw, AlertTriangle, CheckCircle, XCircle, Search, Download, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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

// Response structure for API errors with pagination
interface ApiErrorsResponse {
  errors: ApiError[];
  recentErrors: ApiError[]; // For compatibility
  total: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function ApiErrorsPanel() {
  const { toast } = useToast();
  
  // State for filtering, sorting, and pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [asinFilter, setAsinFilter] = useState('');
  const [searchAsin, setSearchAsin] = useState('');
  const [errorTypeFilter, setErrorTypeFilter] = useState('all');
  const [resolvedFilter, setResolvedFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const { data: errorData, isLoading, refetch } = useQuery<ApiErrorsResponse>({
    queryKey: ['/api/admin/errors', currentPage, asinFilter, errorTypeFilter, resolvedFilter, sortBy, sortOrder],
    queryFn: async () => {
      const token = AdminAuth.getToken() || 'admin-test-token';
      if (!token) {
        throw new Error("Unauthorized");
      }

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '50'
      });

      if (asinFilter.trim()) {
        params.append('asin', asinFilter.trim());
      }

      if (errorTypeFilter !== 'all') {
        params.append('errorType', errorTypeFilter);
      }

      if (resolvedFilter !== 'all') {
        params.append('resolved', resolvedFilter);
      }

      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);

      const response = await fetch(`/api/admin/errors?${params}`, {
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

  /**
   * Handle ASIN search - apply filter when user searches
   */
  const handleSearch = () => {
    setAsinFilter(searchAsin);
    setCurrentPage(1);
  };

  /**
   * Clear all filters and reset to default view
   */
  const clearFilters = () => {
    setSearchAsin('');
    setAsinFilter('');
    setErrorTypeFilter('all');
    setResolvedFilter('all');
    setSortBy('createdAt');
    setSortOrder('desc');
    setCurrentPage(1);
  };

  /**
   * Export error logs to CSV
   */
  const exportErrors = () => {
    if (!errorData?.errors) return;

    const csvContent = [
      ['ID', 'ASIN', 'Error Type', 'Error Message', 'Created At', 'Resolved'],
      ...errorData.errors.map(error => [
        error.id.toString(),
        error.asin,
        error.errorType,
        error.errorMessage,
        new Date(error.createdAt).toISOString(),
        error.resolved ? 'Yes' : 'No'
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-errors-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  /**
   * Handle sorting column click
   */
  const handleSort = (column: string) => {
    if (sortBy === column) {
      // Toggle sort order
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      // New column, default to desc
      setSortBy(column);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  /**
   * Get sort icon for column header
   */
  const getSortIcon = (column: string) => {
    if (sortBy !== column) {
      return <ArrowUpDown className="h-4 w-4 opacity-50" />;
    }
    return sortOrder === 'desc' 
      ? <ArrowDown className="h-4 w-4" />
      : <ArrowUp className="h-4 w-4" />;
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

  /**
   * Get appropriate badge color for error type
   */
  const getErrorTypeBadge = (errorType: string) => {
    const config = {
      'PRICE_MISMATCH': { color: 'bg-orange-100 text-orange-800', label: 'Price Mismatch' },
      'API_FAILURE': { color: 'bg-red-100 text-red-800', label: 'API Failure' },
      'RATE_LIMIT': { color: 'bg-yellow-100 text-yellow-800', label: 'Rate Limited' },
      'INVALID_RESPONSE': { color: 'bg-purple-100 text-purple-800', label: 'Invalid Response' },
      'NETWORK_ERROR': { color: 'bg-gray-100 text-gray-800', label: 'Network Error' }
    };

    const typeConfig = config[errorType as keyof typeof config] || { 
      color: 'bg-blue-100 text-blue-800', 
      label: errorType 
    };

    return (
      <Badge className={typeConfig.color}>
        {typeConfig.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Controls Section - Search, Filter, Export, Refresh */}
      <Card>
        <CardHeader>
          <CardTitle>API Error Controls</CardTitle>
          <CardDescription>
            Search, filter, and export API error data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">

            {/* ASIN Search */}
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Search by ASIN</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter ASIN..."
                  value={searchAsin}
                  onChange={(e) => setSearchAsin(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} variant="outline">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Error Type Filter */}
            <div className="min-w-[180px]">
              <label className="text-sm font-medium mb-2 block">Filter by Error Type</label>
              <Select value={errorTypeFilter} onValueChange={setErrorTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="PRICE_MISMATCH">Price Mismatch</SelectItem>
                  <SelectItem value="API_FAILURE">API Failure</SelectItem>
                  <SelectItem value="RATE_LIMIT">Rate Limited</SelectItem>
                  <SelectItem value="INVALID_RESPONSE">Invalid Response</SelectItem>
                  <SelectItem value="NETWORK_ERROR">Network Error</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Resolved Status Filter */}
            <div className="min-w-[150px]">
              <label className="text-sm font-medium mb-2 block">Filter by Status</label>
              <Select value={resolvedFilter} onValueChange={setResolvedFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button onClick={clearFilters} variant="outline">
                Clear Filters
              </Button>
              <Button onClick={exportErrors} variant="outline" disabled={!errorData?.errors?.length}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button onClick={() => refetch()} disabled={isLoading} variant="outline">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Errors Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            API Error Monitor
          </CardTitle>
          <CardDescription>
            Amazon API errors and debugging information
          </CardDescription>
          <div className="flex items-center gap-4 text-sm text-gray-600 mt-2">
            <span><strong>Total Errors:</strong> {errorData?.total || 0}</span>
            <span><strong>Showing:</strong> {errorData?.errors?.length || 0} results</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              Loading API errors...
            </div>
          ) : !errorData?.errors || errorData.errors.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No API errors found</p>
              <p>API error logs will appear here when errors occur</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
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
                    onClick={() => handleSort('errorType')}
                  >
                    <div className="flex items-center gap-1">
                      Error Type
                      {getSortIcon('errorType')}
                    </div>
                  </TableHead>
                  <TableHead>Error Message</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50 select-none"
                    onClick={() => handleSort('createdAt')}
                  >
                    <div className="flex items-center gap-1">
                      Created At
                      {getSortIcon('createdAt')}
                    </div>
                  </TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {errorData.errors.map((error) => (
                  <TableRow key={error.id}>
                    
                    {/* Error ID */}
                    <TableCell className="font-mono text-sm">{error.id}</TableCell>

                    {/* ASIN */}
                    <TableCell className="font-mono text-sm">
                      {error.asin}
                    </TableCell>

                    {/* Error Type */}
                    <TableCell>
                      {getErrorTypeBadge(error.errorType)}
                    </TableCell>

                    {/* Error Message */}
                    <TableCell className="max-w-xs truncate">
                      <div title={error.errorMessage}>
                        {error.errorMessage}
                      </div>
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

      {/* Pagination Controls */}
      {errorData && errorData.pagination && errorData.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-gray-600">
            Showing {((errorData.pagination.page - 1) * errorData.pagination.limit) + 1} to {Math.min(errorData.pagination.page * errorData.pagination.limit, errorData.pagination.total)} of {errorData.pagination.total} results
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(errorData.pagination.page - 1)}
              disabled={errorData.pagination.page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>

            <span className="text-sm font-medium">
              Page {errorData.pagination.page} of {errorData.pagination.totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(errorData.pagination.page + 1)}
              disabled={errorData.pagination.page >= errorData.pagination.totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

