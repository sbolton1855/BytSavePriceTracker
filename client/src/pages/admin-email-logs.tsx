/**
 * Admin Email Logs Interface
 *
 * Purpose:
 * - Display comprehensive email logging data for admin monitoring
 * - Show email delivery status from both local logs and SendGrid webhooks
 * - Provide filtering and search capabilities for troubleshooting
 *
 * Email Status Flow:
 * 1. "pending" - Email logged locally, not yet sent
 * 2. "sent" - SendGrid accepted the email
 * 3. "delivered" - Email reached recipient inbox
 * 4. "opened" - Recipient opened the email
 * 5. "clicked" - Recipient clicked a link
 * 6. "bounced" - Email bounced (delivery failed)
 * 7. "spam_reported" - Recipient marked as spam
 *
 * Maintainer Notes:
 * - Status updates come from SendGrid webhooks automatically
 * - Preview HTML shows first 500 characters for debugging
 * - Product ID links emails to specific products (price drops, etc.)
 * - All timestamps are in user's local timezone
 */

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Eye, Download, Search, Loader2, RefreshCw, Clock, CheckCircle, XCircle, Mail, MousePointer } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { AdminAuth } from "@/lib/admin-auth";

interface EmailLog {
  id: number;
  recipientEmail: string;
  productId?: number;
  subject: string;
  previewHtml?: string;
  sgMessageId?: string;
  status: string;
  sentAt: string;
  updatedAt: string;
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

/**
 * Main Admin Email Logs Component
 *
 * Displays paginated email logs with filtering and status monitoring
 */
export default function AdminEmailLogs() {
  // State for filtering and pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [emailFilter, setEmailFilter] = useState('');
  const [searchEmail, setSearchEmail] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dataSource, setDataSource] = useState<'db' | 'sendgrid'>('db');

  /**
   * Fetch email logs from backend API
   *
   * Query includes pagination and filtering parameters
   * Automatically refetches when filters change
   */
  const { data: emailLogs, isLoading, refetch } = useQuery<EmailLogsResponse>({
    queryKey: ['admin-email-logs', currentPage, emailFilter, statusFilter, dataSource],
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

      const token = AdminAuth.getToken();
      if (!token) {
        throw new Error("Unauthorized");
      }

      const params = new URLSearchParams({
        token: token,
        page: currentPage.toString(),
        limit: '200', // Increased limit to see more data
        ...(emailFilter && { email: emailFilter }),
        ...(statusFilter && statusFilter !== 'all' && { status: statusFilter })
      });

      const response = await fetch(`/api/admin/logs?${params}`);
      if (!response.ok) {
        if (response.status === 401) {
          AdminAuth.clearToken();
          window.location.reload();
        }
        throw new Error('Failed to fetch email logs');
      }
      return response.json();
    },
    enabled: !!AdminAuth.isAuthenticated(),
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
    setCurrentPage(1);
  };

  /**
   * Export email logs to CSV for external analysis
   */
  const exportLogs = () => {
    if (!emailLogs?.logs) return;

    const csvContent = [
      ['ID', 'Recipient', 'Subject', 'Status', 'Product ID', 'SendGrid ID', 'Sent At', 'Updated At'],
      ...emailLogs.logs.map(log => [
        log.id.toString(),
        log.recipientEmail,
        log.subject,
        log.status,
        log.productId?.toString() || '',
        log.sgMessageId || '',
        new Date(log.sentAt).toISOString(),
        new Date(log.updatedAt).toISOString()
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `email-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  /**
   * Get appropriate badge color and icon for email status
   *
   * Visual indicators help admins quickly assess email delivery health
   */
  const getStatusBadge = (status: string) => {
    const config = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Pending' },
      sent: { color: 'bg-blue-100 text-blue-800', icon: Mail, label: 'Sent' },
      delivered: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Delivered' },
      opened: { color: 'bg-purple-100 text-purple-800', icon: Eye, label: 'Opened' },
      clicked: { color: 'bg-indigo-100 text-indigo-800', icon: MousePointer, label: 'Clicked' },
      bounced: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Bounced' },
      spam_reported: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Spam' },
      failed: { color: 'bg-gray-100 text-gray-800', icon: XCircle, label: 'Failed' }
    };

    const statusConfig = config[status as keyof typeof config] || config.pending;
    const Icon = statusConfig.icon;

    return (
      <Badge className={`${statusConfig.color} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {statusConfig.label}
      </Badge>
    );
  };

  return (
    <AdminLayout
      title="Email Logs"
      description="Monitor email delivery status and troubleshoot email issues"
    >
      <div className="space-y-6">

        {/* Controls Section - Search, Filter, Export, Refresh */}
        <Card>
          <CardHeader>
            <CardTitle>Email Log Controls</CardTitle>
            <CardDescription>
              Search, filter, and export email delivery data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">

              {/* Data Source Selector */}
              <div className="min-w-[150px]">
                <label className="text-sm font-medium mb-2 block">Data Source</label>
                <Select value={dataSource} onValueChange={(value: 'db' | 'sendgrid') => setDataSource(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="db">DB</SelectItem>
                    <SelectItem value="sendgrid">SendGrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Email Search */}
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium mb-2 block">Search by Email</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter email address..."
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    disabled={dataSource === 'sendgrid'}
                  />
                  <Button onClick={handleSearch} variant="outline" disabled={dataSource === 'sendgrid'}>
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Status Filter */}
              <div className="min-w-[150px]">
                <label className="text-sm font-medium mb-2 block">Filter by Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter} disabled={dataSource === 'sendgrid'}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="opened">Opened</SelectItem>
                    <SelectItem value="clicked">Clicked</SelectItem>
                    <SelectItem value="bounced">Bounced</SelectItem>
                    <SelectItem value="spam_reported">Spam Reported</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button onClick={clearFilters} variant="outline">
                  Clear Filters
                </Button>
                <Button onClick={exportLogs} variant="outline" disabled={!emailLogs?.logs.length}>
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

        {/* Email Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Email Delivery Logs</CardTitle>
            <CardDescription>
              Real-time email delivery status from SendGrid webhooks
            </CardDescription>
            <div className="flex items-center gap-4 text-sm text-gray-600 mt-2">
              <span><strong>Data source:</strong> {dataSource.toUpperCase()}</span>
              <span><strong>Rows shown:</strong> {emailLogs?.logs.length || 0}</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {dataSource === 'sendgrid' ? (
              <div className="p-8 text-center text-blue-600 bg-blue-50 border border-blue-200 rounded m-4">
                <Mail className="h-12 w-12 mx-auto mb-4 opacity-75" />
                <p className="text-lg font-medium mb-2">SendGrid view coming soon</p>
                <p className="text-sm">This will show email logs directly from SendGrid's API</p>
              </div>
            ) : isLoading ? (
              <div className="p-8 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                Loading email logs...
              </div>
            ) : emailLogs?.logs.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No email logs found</p>
                <p>Email logs will appear here after emails are sent</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Sent At</TableHead>
                    <TableHead>Updated At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emailLogs?.logs.map((log) => (
                    <TableRow key={log.id}>

                      {/* Email Log ID */}
                      <TableCell className="font-mono text-sm">{log.id}</TableCell>

                      {/* Recipient Email */}
                      <TableCell className="max-w-[200px] truncate">
                        {log.recipientEmail}
                      </TableCell>

                      {/* Email Subject */}
                      <TableCell className="max-w-xs truncate">
                        {log.subject}
                      </TableCell>

                      {/* Delivery Status */}
                      <TableCell>
                        {getStatusBadge(log.status)}
                      </TableCell>

                      {/* Associated Product (if any) */}
                      <TableCell>
                        {log.productId ? (
                          <Badge variant="outline">
                            Product #{log.productId}
                          </Badge>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>

                      {/* Sent Timestamp */}
                      <TableCell>
                        <div className="text-sm">
                          {new Date(log.sentAt).toLocaleString()}
                        </div>
                      </TableCell>

                      {/* Last Updated Timestamp */}
                      <TableCell>
                        <div className="text-sm">
                          {new Date(log.updatedAt).toLocaleString()}
                        </div>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">

                        {/* Preview Email Content Dialog */}
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4 mr-2" />
                              Preview
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
                            <DialogHeader>
                              <DialogTitle>Email Preview - {log.subject}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">

                              {/* Email Metadata */}
                              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded">
                                <div>
                                  <strong>To:</strong> {log.recipientEmail}
                                </div>
                                <div>
                                  <strong>Status:</strong> {getStatusBadge(log.status)}
                                </div>
                                <div>
                                  <strong>SendGrid ID:</strong> {log.sgMessageId || 'Not available'}
                                </div>
                                <div>
                                  <strong>Product:</strong> {log.productId ? `#${log.productId}` : 'None'}
                                </div>
                              </div>

                              {/* Email Content Preview */}
                              <div>
                                <strong className="block mb-2">Email Content Preview:</strong>
                                <div
                                  className="border p-4 rounded bg-white max-h-96 overflow-auto"
                                  dangerouslySetInnerHTML={{
                                    __html: log.previewHtml || '<p>No preview available</p>'
                                  }}
                                />
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Pagination Controls */}
        {emailLogs && emailLogs.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {((emailLogs.pagination.page - 1) * emailLogs.pagination.limit) + 1} to{' '}
              {Math.min(emailLogs.pagination.page * emailLogs.pagination.limit, emailLogs.pagination.total)} of{' '}
              {emailLogs.pagination.total} email logs
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="px-3 py-1 text-sm">
                Page {currentPage} of {emailLogs.pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(emailLogs.pagination.totalPages, prev + 1))}
                disabled={currentPage === emailLogs.pagination.totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}