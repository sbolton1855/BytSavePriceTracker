
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Search, 
  ChevronUp, 
  ChevronDown, 
  Loader2, 
  AlertTriangle, 
  Package,
  FileText,
  Download,
  RefreshCw
} from "lucide-react";

interface LogTableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: any) => React.ReactNode;
  className?: string;
}

interface LogTableProps {
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  data: any[];
  columns: LogTableColumn[];
  loading: boolean;
  error: string | null;
  searchFilter: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  onSearch: (value: string) => void;
  onSort: (column: string) => void;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
  onExport?: () => void;
  extraControls?: React.ReactNode;
  summary?: React.ReactNode;
  emptyMessage?: string;
  emptyIcon?: React.ComponentType<any>;
}

export default function LogTable({
  title,
  description,
  icon: Icon,
  data,
  columns,
  loading,
  error,
  searchFilter,
  sortBy,
  sortOrder,
  pagination,
  onSearch,
  onSort,
  onPageChange,
  onRefresh,
  onExport,
  extraControls,
  summary,
  emptyMessage = "No data found",
  emptyIcon: EmptyIcon = FileText
}: LogTableProps) {
  const getSortIcon = (column: string) => {
    if (sortBy !== column) {
      return <ChevronUp className="h-4 w-4 opacity-30" />;
    }
    return sortOrder === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Controls Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Controls</CardTitle>
              <CardDescription>Search, filter, and manage data</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Search and Controls Row */}
                <div className="flex flex-wrap gap-4 items-center">
                  <div className="flex-1 min-w-[200px]">
                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                      Search
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Search..."
                        value={searchFilter}
                        onChange={(e) => onSearch(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {extraControls}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2 items-center justify-between">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSearch('')}
                    >
                      Clear Search
                    </Button>
                    {onExport && (
                      <Button variant="outline" size="sm" onClick={onExport}>
                        <Download className="h-4 w-4 mr-2" />
                        Export CSV
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onRefresh}
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Refreshing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Refresh
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="text-sm text-gray-600">
                    Showing {data.length} of {pagination.total} items
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          {summary && summary}

          {/* Loading State */}
          {loading && (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin text-blue-600" />
              <p className="text-gray-600">Loading data...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-medium">Error Loading Data</span>
              </div>
              <p className="text-red-600 mt-1 text-sm">{error}</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onRefresh} 
                className="mt-3"
              >
                Try Again
              </Button>
            </div>
          )}

          {/* Data Table */}
          {!loading && !error && (
            <div className="bg-white border rounded-lg">
              <div className="p-4 border-b">
                <h4 className="font-medium text-gray-800">{title}</h4>
                <p className="text-sm text-gray-600">{description} (click column headers to sort)</p>
              </div>

              {data.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <EmptyIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>{emptyMessage}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-gray-50/50">
                      {columns.map((column) => (
                        <TableHead 
                          key={column.key}
                          className={`${column.sortable ? 'cursor-pointer hover:bg-gray-100 select-none transition-colors' : ''} ${column.className || ''}`}
                          onClick={column.sortable ? () => onSort(column.key) : undefined}
                        >
                          <div className="flex items-center gap-1">
                            {column.label}
                            {column.sortable && getSortIcon(column.key)}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((row, index) => (
                      <TableRow 
                        key={index}
                        className="hover:bg-gray-50/75 transition-colors border-b border-gray-200"
                      >
                        {columns.map((column) => (
                          <TableCell key={column.key} className={`${column.className || ''} border-r border-gray-100 last:border-r-0`}>
                            {column.render ? column.render(row[column.key], row) : row[column.key]}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {/* Pagination */}
              {data.length > 0 && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span>
                      Showing page {pagination.page} of {pagination.totalPages}
                    </span>
                    <span className="text-gray-400">•</span>
                    <span>
                      {pagination.total} total items
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onPageChange(pagination.page - 1)}
                      disabled={!pagination.hasPrev || loading}
                    >
                      Previous
                    </Button>

                    {/* Page Numbers */}
                    <div className="flex gap-1">
                      {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                        const page = Math.max(1, pagination.page - 2) + i;
                        if (page > pagination.totalPages) return null;

                        return (
                          <Button
                            key={page}
                            variant={page === pagination.page ? "default" : "outline"}
                            size="sm"
                            onClick={() => onPageChange(page)}
                            disabled={loading}
                            className="min-w-[2.5rem]"
                          >
                            {page}
                          </Button>
                        );
                      })}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onPageChange(pagination.page + 1)}
                      disabled={!pagination.hasNext || loading}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
