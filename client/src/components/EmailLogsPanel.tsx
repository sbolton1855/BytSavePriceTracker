
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Mail, Search, Eye, Database, Send } from "lucide-react";
import { AdminAuth } from "@/lib/admin-auth";
import LogTable, { LogColumn } from "@/components/LogTable";

// Email Log interface matching the backend structure
interface EmailLog {
  id: number;
  recipientEmail: string;
  subject: string;
  sentAt: string;
  updatedAt: string;
  previewHtml?: string;
  status: 'pending' | 'sent' | 'failed' | 'success' | 'fail';
  type?: string;
  productTitle?: string;
}

// Response structure for Email logs with pagination
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
  const { toast } = useToast();

  // State for filtering, sorting, and pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [emailFilter, setEmailFilter] = useState('');
  const [searchEmail, setSearchEmail] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dataSource, setDataSource] = useState<'db' | 'sendgrid'>('db');
  const [sortBy, setSortBy] = useState<string | null>('sentAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const { data: emailLogs, isLoading, refetch } = useQuery<EmailLogsResponse>({
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

    const csvContent = [
      ['ID', 'Recipient', 'Subject', 'Status', 'Product', 'Sent At', 'Updated At'],
      ...emailLogs.logs.map(log => [
        log.id.toString(),
        log.recipientEmail,
        log.subject,
        log.status,
        log.productTitle || '-',
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

  /**
   * Render status badge with appropriate styling
   */
  const StatusBadge = ({ status }: { status: string }) => {
    const config = {
      'pending': { color: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
      'sent': { color: 'bg-green-100 text-green-800', label: 'Sent' },
      'success': { color: 'bg-green-100 text-green-800', label: 'Success' },
      'failed': { color: 'bg-red-100 text-red-800', label: 'Failed' },
      'fail': { color: 'bg-red-100 text-red-800', label: 'Failed' }
    };

    const statusConfig = config[status as keyof typeof config] || {
      color: 'bg-gray-100 text-gray-800',
      label: status
    };

    return (
      <Badge className={statusConfig.color}>
        {statusConfig.label}
      </Badge>
    );
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
      render: (value: string) => (
        <div className="max-w-xs truncate" title={value}>
          {value}
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value: string) => <StatusBadge status={value} />
    },
    {
      key: 'productTitle',
      label: 'Product',
      render: (value: string) => (
        <span className="text-sm">{value || '-'}</span>
      )
    },
    {
      key: 'sentAt',
      label: 'Sent At',
      sortable: true,
      render: (value: string) => (
        <div className="text-sm">
          {new Date(value).toLocaleString()}
        </div>
      )
    },
    {
      key: 'updatedAt',
      label: 'Updated At',
      sortable: true,
      render: (value: string) => (
        <div className="text-sm">
          {new Date(value).toLocaleString()}
        </div>
      )
    },
    {
      key: 'previewHtml',
      label: 'Actions',
      render: (value: string, row: EmailLog) => (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Eye className="h-4 w-4 mr-1" />
              Preview
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Email Preview - {row.subject}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Email Metadata */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>To:</strong> {row.recipientEmail}
                </div>
                <div>
                  <strong>Status:</strong> <StatusBadge status={row.status} />
                </div>
                <div>
                  <strong>Sent:</strong> {new Date(row.sentAt).toLocaleString()}
                </div>
                <div>
                  <strong>Updated:</strong> {new Date(row.updatedAt).toLocaleString()}
                </div>
              </div>

              {/* Email Content Preview */}
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

  // Handle special case for SendGrid data source
  if (dataSource === 'sendgrid') {
    return (
      <div className="space-y-6">
        {/* Email Log Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Email Log Controls</CardTitle>
            <CardDescription>
              Search, filter, and export email delivery data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              {/* Data Source Toggle */}
              <div className="min-w-[120px]">
                <label className="text-sm font-medium mb-2 block">Data Source</label>
                <Select value={dataSource} onValueChange={(value: 'db' | 'sendgrid') => setDataSource(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="db">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        Database
                      </div>
                    </SelectItem>
                    <SelectItem value="sendgrid">
                      <div className="flex items-center gap-2">
                        <Send className="h-4 w-4" />
                        SendGrid
                      </div>
                    </SelectItem>
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

        {/* SendGrid Placeholder */}
        <Card>
          <CardContent className="p-8 text-center text-blue-600 bg-blue-50 border border-blue-200 rounded">
            <Mail className="h-12 w-12 mx-auto mb-4 opacity-75" />
            <p className="text-lg font-medium mb-2">SendGrid view coming soon</p>
            <p className="text-sm">This will show email logs directly from SendGrid's API</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Email Log Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Email Log Controls</CardTitle>
          <CardDescription>
            Search, filter, and export email delivery data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            {/* Data Source Toggle */}
            <div className="min-w-[120px]">
              <label className="text-sm font-medium mb-2 block">Data Source</label>
              <Select value={dataSource} onValueChange={(value: 'db' | 'sendgrid') => setDataSource(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="db">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Database
                    </div>
                  </SelectItem>
                  <SelectItem value="sendgrid">
                    <div className="flex items-center gap-2">
                      <Send className="h-4 w-4" />
                      SendGrid
                    </div>
                  </SelectItem>
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
                />
                <Button onClick={handleSearch} variant="outline">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Status Filter */}
            <div className="min-w-[150px]">
              <label className="text-sm font-medium mb-2 block">Filter by Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="fail">Failed</SelectItem>
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
        data={emailLogs?.logs || []}
        loading={isLoading}
        columns={columns}
        sortBy={sortBy || undefined}
        sortOrder={sortOrder}
        onSort={handleSort}
        pagination={emailLogs?.pagination}
        onPageChange={handlePageChange}
        onRefresh={() => refetch()}
        onExport={exportLogs}
        title="Email Delivery Logs"
        emptyMessage="No email logs found. Emails will appear here after being sent."
        emptyIcon={<Mail className="h-12 w-12 mx-auto text-gray-400" />}
      >
        {/* Data source indicator */}
        <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
          <span><strong>Data source:</strong> {dataSource.toUpperCase()}</span>
          <span><strong>Rows shown:</strong> {emailLogs?.logs.length || 0}</span>
        </div>
      </LogTable>
    </div>
  );
}
