
import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Download, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

/**
 * LogTable Component - Single Source of Truth for All Admin Log Tables
 * 
 * This is the standardized table component that MUST be used for all log views in the admin area.
 * It provides consistent styling, sorting, pagination, and actions across:
 * - API Error logs
 * - Email logs 
 * - Product logs
 * - Any future log tables
 * 
 * Key Features:
 * - Clean table design (no vertical borders)
 * - Sortable column headers
 * - Hover row highlighting
 * - Built-in pagination controls
 * - Export CSV functionality
 * - Refresh button
 * - Loading and empty states
 * - Error state handling
 * 
 * Usage Rules:
 * 1. Any new log area MUST use this component
 * 2. Do not create custom table components for logs
 * 3. Follow the column definition pattern shown below
 * 4. Maintain consistent styling by using this component
 */

export interface LogColumn {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: any) => React.ReactNode;
  className?: string;
}

export interface LogTableProps {
  // Data and loading states
  data: any[];
  loading?: boolean;
  error?: string | null;
  
  // Column configuration
  columns: LogColumn[];
  
  // Sorting
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (column: string) => void;
  
  // Pagination
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext?: boolean;
    hasPrev?: boolean;
  };
  onPageChange?: (page: number) => void;
  
  // Actions
  onRefresh?: () => void;
  onExport?: () => void;
  
  // UI customization
  title?: string;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  
  // Additional content above table
  children?: React.ReactNode;
}

export default function LogTable({
  data,
  loading = false,
  error = null,
  columns,
  sortBy,
  sortOrder = 'desc',
  onSort,
  pagination,
  onPageChange,
  onRefresh,
  onExport,
  title,
  emptyMessage = "No data found",
  emptyIcon,
  children
}: LogTableProps) {

  /**
   * Get sort icon for column headers
   * Shows the appropriate arrow based on current sort state
   */
  const getSortIcon = (column: string) => {
    if (!onSort || sortBy !== column) {
      return <ArrowUpDown className="h-4 w-4 opacity-50" />;
    }
    return sortOrder === 'desc'
      ? <ArrowDown className="h-4 w-4" />
      : <ArrowUp className="h-4 w-4" />;
  };

  /**
   * Handle column header click for sorting
   */
  const handleSort = (column: string) => {
    if (onSort) {
      onSort(column);
    }
  };

  /**
   * Handle page change with bounds checking
   */
  const handlePageChange = (newPage: number) => {
    if (!onPageChange || !pagination) return;
    
    // Ensure page is within valid bounds
    const validPage = Math.max(1, Math.min(newPage, pagination.totalPages));
    
    if (validPage !== pagination.page) {
      console.log(`[LogTable] Page change: ${pagination.page} -> ${validPage}`);
      onPageChange(validPage);
    }
  };

  /**
   * Render pagination controls
   */
  const renderPagination = () => {
    if (!pagination || pagination.totalPages <= 1) {
      return null;
    }

    return (
      <div className="flex items-center justify-between mt-6 px-4 py-3 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={!pagination.hasPrev || pagination.page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>

          <span className="text-sm font-medium">
            Page {pagination.page} of {pagination.totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={!pagination.hasNext || pagination.page >= pagination.totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  /**
   * Render action buttons (refresh, export)
   */
  const renderActions = () => {
    if (!onRefresh && !onExport) return null;

    return (
      <div className="flex gap-2 mb-4">
        {onRefresh && (
          <Button
            onClick={onRefresh}
            disabled={loading}
            variant="outline"
            size="sm"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
        )}
        
        {onExport && (
          <Button
            onClick={onExport}
            disabled={loading || !data?.length}
            variant="outline"
            size="sm"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Custom content above table (filters, summary cards, etc.) */}
      {children}

      {/* Action buttons */}
      {renderActions()}

      {/* Main table container */}
      <div className="bg-white border rounded-lg overflow-hidden">
        {title && (
          <div className="p-4 border-b">
            <h4 className="font-medium text-gray-800">{title}</h4>
          </div>
        )}

        {/* Loading state */}
        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading data...</p>
          </div>
        ) : error ? (
          /* Error state */
          <div className="p-8 text-center text-red-600">
            <p className="font-medium">Error loading data</p>
            <p className="text-sm mt-1">{error}</p>
            {onRefresh && (
              <Button
                onClick={onRefresh}
                variant="outline"
                size="sm"
                className="mt-3"
              >
                Try Again
              </Button>
            )}
          </div>
        ) : !data || data.length === 0 ? (
          /* Empty state */
          <div className="p-8 text-center text-gray-500">
            {emptyIcon && <div className="mb-4">{emptyIcon}</div>}
            <p className="text-lg font-medium mb-2">No Data Found</p>
            <p className="text-sm">{emptyMessage}</p>
          </div>
        ) : (
          /* Data table */
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-gray-50/50">
                {columns.map((column) => (
                  <TableHead
                    key={column.key}
                    className={`border-0 ${
                      column.sortable && onSort
                        ? 'cursor-pointer hover:bg-gray-100 select-none transition-colors'
                        : ''
                    } ${column.className || ''}`}
                    onClick={() => column.sortable && handleSort(column.key)}
                  >
                    <div className="flex items-center gap-1">
                      {column.label}
                      {column.sortable && onSort && getSortIcon(column.key)}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, rowIndex) => (
                <TableRow 
                  key={rowIndex}
                  className="hover:bg-gray-50/75 transition-colors border-b border-gray-200 border-x-0"
                >
                  {columns.map((column) => (
                    <TableCell
                      key={column.key}
                      className={`border-0 ${column.className || ''}`}
                    >
                      {column.render 
                        ? column.render(row[column.key], row)
                        : row[column.key] || '-'
                      }
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Pagination */}
        {renderPagination()}
      </div>
    </div>
  );
}

/**
 * Common badge components for consistent styling across log tables
 */
export const StatusBadge = ({ active }: { active: boolean }) => (
  <Badge className={active ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}>
    {active ? "Active" : "Resolved"}
  </Badge>
);

export const ErrorTypeBadge = ({ type }: { type: string }) => {
  const config = {
    'PRICE_MISMATCH': { color: 'bg-orange-100 text-orange-800', label: 'Price Mismatch' },
    'API_FAILURE': { color: 'bg-red-100 text-red-800', label: 'API Failure' },
    'RATE_LIMIT': { color: 'bg-yellow-100 text-yellow-800', label: 'Rate Limited' },
    'INVALID_RESPONSE': { color: 'bg-purple-100 text-purple-800', label: 'Invalid Response' },
    'NETWORK_ERROR': { color: 'bg-gray-100 text-gray-800', label: 'Network Error' }
  };

  const typeConfig = config[type as keyof typeof config] || {
    color: 'bg-blue-100 text-blue-800',
    label: type
  };

  return (
    <Badge className={typeConfig.color}>
      {typeConfig.label}
    </Badge>
  );
};
