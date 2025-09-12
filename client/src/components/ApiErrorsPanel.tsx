import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import LogTable from "./LogTable";
import { AdminAuth } from "@/lib/admin-auth";
import { AlertTriangle, CheckCircle, Clock, XCircle } from "lucide-react";

// API Error interface matching the backend structure
interface ApiError {
  id: number;
  asin: string;
  errorType: string;
  errorMessage: string;
  createdAt: string;
  resolved: boolean;
}

// Pagination interface for API errors
interface ApiErrorsPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export default function ApiErrorsPanel() {
  const [errors, setErrors] = useState<ApiError[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'errorType' | 'asin'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [statusFilter, setStatusFilter] = useState<'all' | 'resolved' | 'unresolved'>('all');
  const [pagination, setPagination] = useState<ApiErrorsPagination>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });

  // Fetch errors from the API
  const fetchErrors = async (page = pagination.page) => {
    const token = AdminAuth.getToken();
    if (!token) {
      setError("Admin authentication required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        token,
        page: page.toString(),
        limit: pagination.limit.toString(),
        sortBy,
        sortOrder,
        ...(searchFilter && { search: searchFilter }),
        ...(statusFilter !== 'all' && { status: statusFilter })
      });

      const response = await fetch(`/api/admin/errors?${params}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch errors: ${response.status}`);
      }

      const result = await response.json();
      console.log('[DEBUG] API Errors Response:', result);

      setErrors(result.errors || []);

      // Update pagination state based on API response
      if (result.pagination) {
        setPagination(result.pagination);
      } else {
        // Fallback pagination if API doesn't return it
        setPagination({
          page: 1,
          limit: result.errors?.length || 0,
          total: result.errors?.length || 0,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        });
      }
    } catch (err) {
      console.error("Error fetching API errors:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch API errors");
    } finally {
      setLoading(false);
    }
  };

  // Handle sorting by column
  const handleSort = (column: 'createdAt' | 'errorType' | 'asin') => {
    if (sortBy === column) {
      // Toggle sort order if the same column is clicked
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column to sort by and reset order to descending
      setSortBy(column);
      setSortOrder('desc');
    }
    // Fetch data with new sorting parameters, resetting to the first page
    fetchErrors(1);
  };

  // Handle search input changes
  const handleSearch = (value: string) => {
    setSearchFilter(value);
    // Reset to the first page when search filter changes
    setPagination(prev => ({ ...prev, page: 1 }));
    // Debounce the fetch call to avoid excessive requests
    setTimeout(() => fetchErrors(1), 300);
  };

  // Handle page change for pagination
  const handlePageChange = (newPage: number) => {
    fetchErrors(newPage);
  };

  // Function to resolve an error by its ID
  const resolveError = async (errorId: number) => {
    const token = AdminAuth.getToken();
    if (!token) return;

    try {
      const response = await fetch(`/api/admin/errors/${errorId}/resolve`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }) // Assuming token is needed in the body as well
      });

      if (response.ok) {
        // Refresh the errors list after resolving
        fetchErrors();
      }
    } catch (err) {
      console.error("Error resolving error:", err);
      // Optionally show a toast notification for error
    }
  };

  // Fetch errors on component mount
  useEffect(() => {
    fetchErrors();
  }, []);

  // Define columns for the LogTable component
  const errorColumns = [
    {
      key: 'createdAt',
      label: 'Date',
      sortable: true,
      // Custom rendering for the date column
      render: (value: string) => (
        <span className="text-sm">
          {new Date(value).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </span>
      )
    },
    {
      key: 'asin',
      label: 'ASIN',
      sortable: true,
      // Custom rendering for the ASIN column
      render: (value: string) => (
        <span className="font-mono text-sm">{value}</span>
      )
    },
    {
      key: 'errorType',
      label: 'Error Type',
      sortable: true,
      // Custom rendering for error type with colored badges
      render: (value: string) => {
        const typeColors: { [key: string]: string } = {
          'PRICE_MISMATCH': 'bg-yellow-100 text-yellow-800',
          'SCRAPE_ERROR': 'bg-red-100 text-red-800',
          'API_ERROR': 'bg-blue-100 text-blue-800',
          'TIMEOUT': 'bg-orange-100 text-orange-800'
        };

        return (
          <Badge className={typeColors[value] || 'bg-gray-100 text-gray-800'}>
            {value.replace(/_/g, ' ')} {/* Replace underscores with spaces for readability */}
          </Badge>
        );
      }
    },
    {
      key: 'errorMessage',
      label: 'Message',
      // Custom rendering for error message with truncation
      render: (value: string) => (
        <div className="max-w-sm truncate" title={value}>
          {value}
        </div>
      )
    },
    {
      key: 'resolved',
      label: 'Status',
      // Custom rendering for status with resolve button
      render: (value: boolean, row: ApiError) => (
        <div className="flex items-center gap-2">
          {value ? (
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              <CheckCircle className="h-3 w-3 mr-1" />
              Resolved
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-red-100 text-red-800">
              <XCircle className="h-3 w-3 mr-1" />
              Open
            </Badge>
          )}
          {!value && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => resolveError(row.id)}
              className="ml-2"
            >
              Resolve
            </Button>
          )}
        </div>
      )
    }
  ];

  // Summary component to display error statistics
  const errorSummary = (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <h4 className="font-medium text-red-800 mb-2">Error Summary</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <span className="text-red-600 font-medium">Total Errors:</span>
          <div className="text-lg font-bold text-red-800">{errors.length}</div>
        </div>
        <div>
          <span className="text-red-600 font-medium">Open:</span>
          <div className="text-lg font-bold text-red-800">
            {errors.filter(e => !e.resolved).length}
          </div>
        </div>
        <div>
          <span className="text-red-600 font-medium">Resolved:</span>
          <div className="text-lg font-bold text-green-600">
            {errors.filter(e => e.resolved).length}
          </div>
        </div>
        <div>
          <span className="text-red-600 font-medium">Status:</span>
          <div className={`text-lg font-bold ${errors.filter(e => !e.resolved).length > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {errors.filter(e => !e.resolved).length > 0 ? 'Needs Action' : 'All Clear'}
          </div>
        </div>
      </div>
    </div>
  );

  // Extra controls for filtering status
  const extraControls = (
    <div className="min-w-[120px]">
      <label className="text-sm font-medium text-gray-700 mb-1 block">
        Status
      </label>
      <select
        value={statusFilter}
        onChange={(e) => {
          setStatusFilter(e.target.value as 'all' | 'resolved' | 'unresolved');
          fetchErrors(1); // Fetch data when filter changes
        }}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="all">All Errors</option>
        <option value="unresolved">Open Only</option>
        <option value="resolved">Resolved Only</option>
      </select>
    </div>
  );

  // Filter errors based on search and status (client-side filtering if needed, though API handles most)
  const filteredErrors = errors.filter(errorItem => {
    const matchesSearch = !searchFilter ||
      errorItem.asin.toLowerCase().includes(searchFilter.toLowerCase()) ||
      errorItem.errorType.toLowerCase().includes(searchFilter.toLowerCase()) ||
      errorItem.errorMessage.toLowerCase().includes(searchFilter.toLowerCase());

    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'resolved' && errorItem.resolved) ||
      (statusFilter === 'unresolved' && !errorItem.resolved);

    return matchesSearch && matchesStatus;
  });

  return (
    <LogTable
      title="API Errors"
      description="System errors and issues that require attention"
      icon={AlertTriangle} // Icon for the panel title
      data={filteredErrors} // Data to display in the table
      columns={errorColumns} // Column definitions for the table
      loading={loading} // Loading state indicator
      error={error} // Error message to display
      searchFilter={searchFilter} // Current search filter value
      sortBy={sortBy} // Current sort by column
      sortOrder={sortOrder} // Current sort order
      pagination={pagination} // Pagination details
      onSearch={handleSearch} // Handler for search input
      onSort={handleSort} // Handler for column sorting
      onPageChange={handlePageChange} // Handler for page changes
      onRefresh={() => fetchErrors()} // Handler for refresh action
      onExport={() => {
        // TODO: Implement CSV export for errors
        console.log('Export errors CSV clicked');
      }}
      extraControls={extraControls} // Additional controls to render alongside search
      summary={errorSummary} // Summary component to display statistics
      emptyMessage="No API errors found. System is running smoothly!" // Message when no data is present
      emptyIcon={CheckCircle} // Icon to display when no data is present
    />
  );
}