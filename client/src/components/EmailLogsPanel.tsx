
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Mail, Database, Cloud, Search, X } from "lucide-react";
import LogTable, { LogColumn } from './LogTable';
import { AdminAuth } from '@/lib/admin-auth';

interface EmailLog {
  id: string;
  recipientEmail: string;
  subject: string;
  status: string;
  productId?: string;
  product?: {
    title: string;
    asin: string;
  };
  sentAt: string;
  updatedAt: string;
  previewHtml?: string;
}

interface EmailLogsResponse {
  logs: EmailLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function EmailLogsPanel() {
  // State for filtering and pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [emailFilter, setEmailFilter] = useState('');
  const [searchEmail, setSearchEmail] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dataSource, setDataSource] = useState<'db' | 'sendgrid'>('db');
  const [sortBy, setSortBy] = useState<string>('sentAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  /**
   * Fetch email logs from backend API
   */
  const { data: emailLogs, isLoading, error, refetch } = useQuery<EmailLogsResponse>({
    queryKey: ['admin-email-logs', currentPage, emailFilter, statusFilter, dataSource, sortBy, sortOrder],
    queryFn: async () => {
      // Don't fetch if SendGrid is selected (placeholder for now)
      if (dataSource === 'sendgrid') {
        return {
          logs: [],
          pagination: {
            page: 1,
            limit: 200,
            total: 0,
            totalPages: 1
          }
        };
      }

      const token = AdminAuth.getToken() || 'admin-test-token';
      if (!token) {
        throw new Error("Unauthorized");
      }

      const params = new URLSearchParams({
        token: token,
        page: currentPage.toString(),
        limit: '200',
        sortBy: sortBy ?? '',
        sortOrder: sortOrder,
        ...(emailFilter && { recipientEmail: emailFilter }),
        ...(statusFilter !== 'all' && { status: statusFilter })
      });

      const response = await fetch(`/api/admin/logs?${params}`);
      if (!response.ok) {
        if (response.status === 403) {
          AdminAuth.clearToken();
        }
        throw new Error("Failed to fetch email logs");
      }
      return response.json();
    },
    enabled: AdminAuth.getToken() !== null,
  });

  /**
   * Handle email search - apply filter when user searches
   */
  const handleSearch = () => {
    setEmailFilter(searchEmail);
    setCurrentPage(1);
  };

  /**
   * Clear all filters and reset to default view
   */
  const clearFilters = () => {
    setSearchEmail('');
    setEmailFilter('');
    setStatusFilter('all');
    setSortBy('sentAt');
    setSortOrder('desc');
    setCurrentPage(1);
  };

  /**
   * Export email logs to CSV
   */
  const exportLogs = () => {
    if (!emailLogs?.logs) return;

    const csvHeaders = ['ID', 'Recipient', 'Subject', 'Status', 'Product', 'Sent At', 'Updated At'];
    const csvRows = emailLogs.logs.map(log => [
      log.id,
      log.recipientEmail,
      log.subject,
      log.status,
      log.product?.title || '-',
      log.sentAt,
      log.updatedAt
    ]);

    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `email-logs-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  /**
   * Handle sorting
   */
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
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

  /**
   * Status badge component
   */
  const StatusBadge = ({ status }: { status: string }) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      'pending': { color: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
      'sent': { color: 'bg-blue-100 text-blue-800', label: 'Sent' },
      'delivered': { color: 'bg-green-100 text-green-800', label: 'Delivered' },
      'opened': { color: 'bg-purple-100 text-purple-800', label: 'Opened' },
      'clicked': { color: 'bg-indigo-100 text-indigo-800', label: 'Clicked' },
      'bounced': { color: 'bg-red-100 text-red-800', label: 'Bounced' },
      'spam_reported': { color: 'bg-orange-100 text-orange-800', label: 'Spam' },
      'failed': { color: 'bg-red-100 text-red-800', label: 'Failed' }
    };

    const config = statusConfig[status] || {
      color: 'bg-gray-100 text-gray-800',
      label: status
    };

    return (
      <Badge className={config.color}>
        {config.label}
      </Badge>
    );
  };

  /**
   * Define table columns
   */
  const columns: LogColumn[] = [
    {
      key: 'id',
      label: 'ID',
      sortable: true,
      render: (value: string) => (
        <span className="font-mono text-sm">{value}</span>
      )
    },
    {
      key: 'recipientEmail',
      label: 'Recipient',
      sortable: true,
      render: (value: string) => (
        <span className="text-sm">{value}</span>
      )
    },
    {
      key: 'subject',
      label: 'Subject',
      sortable: true,
      render: (value: string) => (
        <span className="text-sm truncate max-w-xs" title={value}>
          {value}
        </span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value: string) => <StatusBadge status={value} />
    },
    {
      key: 'product',
      label: 'Product',
      render: (value: any, row: EmailLog) => (
        <span className="text-sm">
          {row.product?.title ? (
            <span className="truncate max-w-xs" title={row.product.title}>
              {row.product.title}
            </span>
          ) : '-'}
        </span>
      )
    },
    {
      key: 'sentAt',
      label: 'Sent At',
      sortable: true,
      render: (value: string) => (
        <span className="text-sm text-gray-600">
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
      key: 'updatedAt',
      label: 'Updated At',
      sortable: true,
      render: (value: string) => (
        <span className="text-sm text-gray-600">
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
      key: 'actions',
      label: 'Actions',
      render: (value: any, row: EmailLog) => (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              Preview
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Email Preview - {row.subject}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><strong>To:</strong> {row.recipientEmail}</div>
                <div><strong>Status:</strong> <StatusBadge status={row.status} /></div>
                <div><strong>Sent:</strong> {new Date(row.sentAt).toLocaleString()}</div>
                <div><strong>Updated:</strong> {new Date(row.updatedAt).toLocaleString()}</div>
              </div>
              
              {row.product && (
                <div className="text-sm">
                  <strong>Product:</strong> {row.product.title} (ASIN: {row.product.asin})
                </div>
              )}

              <div>
                <strong className="block mb-2">Email Content Preview:</strong>
                <div 
                  className="border p-4 rounded bg-white max-h-96 overflow-auto"
                  dangerouslySetInnerHTML={{ 
                    __html: row.previewHtml || '<p>No preview available</p>' 
                  }}
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{emailLogs?.pagination.total || 0}</div>
            <p className="text-xs text-muted-foreground">Total Emails</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {emailLogs?.logs.filter(log => log.status === 'delivered').length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Delivered</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">
              {emailLogs?.logs.filter(log => log.status === 'pending').length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">
              {emailLogs?.logs.filter(log => ['bounced', 'failed'].includes(log.status)).length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Failed</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Email Log Filters</CardTitle>
          <CardDescription>
            Filter and search email delivery data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            {/* Data Source Toggle */}
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Data Source</label>
              <div className="flex gap-2">
                <Button
                  variant={dataSource === 'db' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDataSource('db')}
                  className="flex items-center gap-2"
                >
                  <Database className="h-4 w-4" />
                  Database
                </Button>
                <Button
                  variant={dataSource === 'sendgrid' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDataSource('sendgrid')}
                  className="flex items-center gap-2"
                >
                  <Cloud className="h-4 w-4" />
                  SendGrid
                </Button>
              </div>
            </div>

            {/* Email Search */}
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Search Email</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter email address..."
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} size="sm">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Status Filter */}
            <div className="flex-1 min-w-[150px]">
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="opened">Opened</SelectItem>
                  <SelectItem value="clicked">Clicked</SelectItem>
                  <SelectItem value="bounced">Bounced</SelectItem>
                  <SelectItem value="spam_reported">Spam</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Clear Filters */}
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Clear
            </Button>
          </div>

          {/* Active Filters Display */}
          {(emailFilter || statusFilter !== 'all') && (
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
              <span className="text-sm text-gray-600">Active filters:</span>
              {emailFilter && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Email: {emailFilter}
                  <button
                    onClick={() => {
                      setEmailFilter('');
                      setSearchEmail('');
                    }}
                    className="ml-1 hover:bg-gray-200 rounded"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {statusFilter !== 'all' && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Status: {statusFilter}
                  <button
                    onClick={() => setStatusFilter('all')}
                    className="ml-1 hover:bg-gray-200 rounded"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* LogTable */}
      <LogTable
        data={dataSource === 'sendgrid' ? [] : emailLogs?.logs || []}
        loading={isLoading}
        error={error?.message || null}
        columns={columns}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        pagination={emailLogs?.pagination ? {
          page: emailLogs.pagination.page,
          limit: emailLogs.pagination.limit,
          total: emailLogs.pagination.total,
          totalPages: emailLogs.pagination.totalPages,
          hasNext: emailLogs.pagination.page < emailLogs.pagination.totalPages,
          hasPrev: emailLogs.pagination.page > 1
        } : undefined}
        onPageChange={handlePageChange}
        onRefresh={refetch}
        onExport={exportLogs}
        title="Email Delivery Logs"
        emptyMessage={
          dataSource === 'sendgrid' 
            ? "SendGrid integration coming soon" 
            : "No email logs found"
        }
        emptyIcon={<Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />}
      />
    </div>
  );
}
