
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Eye, Download, Search } from "lucide-react";

interface EmailLog {
  id: number;
  to: string;
  subject: string;
  html: string;
  createdAt: string;
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

export default function AdminEmailLogs() {
  const [adminToken, setAdminToken] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [emailFilter, setEmailFilter] = useState('');
  const [searchEmail, setSearchEmail] = useState('');

  const { data: emailLogs, isLoading, refetch } = useQuery<EmailLogsResponse>({
    queryKey: ['admin-email-logs', adminToken, currentPage, emailFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        token: adminToken,
        page: currentPage.toString(),
        ...(emailFilter && { email: emailFilter })
      });

      const response = await fetch(`/api/admin/logs?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch email logs');
      }
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const handleLogin = () => {
    if (adminToken) {
      setIsAuthenticated(true);
    }
  };

  const handleSearch = () => {
    setEmailFilter(searchEmail);
    setCurrentPage(1);
  };

  const clearFilter = () => {
    setSearchEmail('');
    setEmailFilter('');
    setCurrentPage(1);
  };

  const exportLogs = () => {
    if (!emailLogs?.logs) return;
    
    const csvContent = [
      ['ID', 'To', 'Subject', 'Date'],
      ...emailLogs.logs.map(log => [
        log.id.toString(),
        log.to,
        log.subject,
        new Date(log.createdAt).toISOString()
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `email-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto mt-16 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Admin Access Required</CardTitle>
            <CardDescription>Enter admin token to view email logs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="password"
              placeholder="Admin Token"
              value={adminToken}
              onChange={(e) => setAdminToken(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            />
            <Button onClick={handleLogin} className="w-full">
              Access Email Logs
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Email Logs</h1>
        <p className="text-gray-600">View and manage sent email history</p>
      </div>

      {/* Search and Actions */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">
                Filter by Email
              </label>
              <Input
                placeholder="user@example.com"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSearch} variant="outline">
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
              {emailFilter && (
                <Button onClick={clearFilter} variant="outline">
                  Clear Filter
                </Button>
              )}
              <Button onClick={exportLogs} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>

          {emailFilter && (
            <div className="mt-4">
              <Badge variant="secondary">
                Filtered by: {emailFilter}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Logs Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">Loading email logs...</div>
          ) : emailLogs?.logs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No email logs found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emailLogs?.logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-sm">{log.id}</TableCell>
                    <TableCell>{log.to}</TableCell>
                    <TableCell className="max-w-xs truncate">{log.subject}</TableCell>
                    <TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4 mr-2" />
                            Preview
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[80vh]">
                          <DialogHeader>
                            <DialogTitle>Email Preview</DialogTitle>
                            <div className="text-sm text-gray-600">
                              <p><strong>To:</strong> {log.to}</p>
                              <p><strong>Subject:</strong> {log.subject}</p>
                              <p><strong>Date:</strong> {new Date(log.createdAt).toLocaleString()}</p>
                            </div>
                          </DialogHeader>
                          <div className="border rounded-lg overflow-hidden">
                            <iframe
                              srcDoc={log.html}
                              className="w-full h-[400px]"
                              sandbox="allow-same-origin"
                            />
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

      {/* Pagination */}
      {emailLogs && emailLogs.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-gray-600">
            Showing {((emailLogs.pagination.page - 1) * emailLogs.pagination.limit) + 1} to{' '}
            {Math.min(emailLogs.pagination.page * emailLogs.pagination.limit, emailLogs.pagination.total)} of{' '}
            {emailLogs.pagination.total} entries
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
  );
}
