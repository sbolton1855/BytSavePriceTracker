import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Search, CheckCircle, XCircle } from "lucide-react";
import { AdminAuth } from "@/lib/admin-auth";
import LogTable, { LogColumn, StatusBadge, ErrorTypeBadge } from "@/components/LogTable";

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
  const [sortBy, setSortBy] = useState<string | null>('createdAt');
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

      params.append('sortBy', sortBy!);
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
   * Handle page change
   */
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Define table columns using the LogTable format
  const columns: LogColumn[] = [
    {
      key: 'id',
      label: 'ID',
      sortable: true,
      render: (value: number) => (
        <span className="font-mono text-sm">{value}</span>
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
      key: 'errorType',
      label: 'Error Type',
      sortable: true,
      render: (value: string) => <ErrorTypeBadge type={value} />
    },
    {
      key: 'errorMessage',
      label: 'Error Message',
      render: (value: string) => (
        <div className="max-w-xs truncate" title={value}>
          {value}
        </div>
      )
    },
    {
      key: 'createdAt',
      label: 'Created At',
      sortable: true,
      render: (value: string) => (
        <div className="text-sm">
          {new Date(value).toLocaleString()}
        </div>
      )
    },
    {
      key: 'resolved',
      label: 'Status',
      sortable: true,
      render: (value: boolean) => <StatusBadge active={!value} />
    }
  ];

  // Calculate summary statistics
  const activeErrors = errorData?.errors?.filter(error => !error.resolved).length || 0;
  const resolvedErrors = errorData?.errors?.filter(error => error.resolved).length || 0;

  return (
    <div className="space-y-6">
      {/* API Error Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            API Error Monitor
          </CardTitle>
          <CardDescription>
            Amazon API errors and debugging information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-700">{activeErrors}</div>
              <div className="text-sm text-red-600">Active Errors</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-700">{resolvedErrors}</div>
              <div className="text-sm text-green-600">Resolved Errors</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-700">{errorData?.total || 0}</div>
              <div className="text-sm text-blue-600">Total Errors</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Controls Section */}
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

            {/* Clear Filters Button */}
            <Button onClick={clearFilters} variant="outline">
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Log Table */}
      <LogTable
        data={errorData?.errors || []}
        loading={isLoading}
        columns={columns}
        sortBy={sortBy || undefined}
        sortOrder={sortOrder}
        onSort={handleSort}
        pagination={errorData?.pagination}
        onPageChange={handlePageChange}
        onRefresh={() => refetch()}
        onExport={exportErrors}
        title="API Error Logs"
        emptyMessage="No API errors found. This is good news!"
        emptyIcon={<CheckCircle className="h-12 w-12 mx-auto text-green-400" />}
      />
    </div>
  );
}