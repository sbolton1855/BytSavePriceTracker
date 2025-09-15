import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Package, Search } from "lucide-react";
import { AdminAuth } from "@/lib/admin-auth";
import LogTable, { LogColumn } from "@/components/LogTable";

// Product tracking data interface
interface TrackedProductAdmin {
  id: number;
  userId: string | null;
  email: string;
  productId: number;
  targetPrice: number;
  createdAt: string;
  lastAlertSent: string | null;
  cooldownHours: number;
  product: {
    id: number;
    asin: string;
    title: string;
    url: string;
    imageUrl?: string;
    currentPrice: number;
    originalPrice: number | null;
    lastChecked: string;
    createdAt: string;
  };
}

// Simplified data structure for admin display
interface ProductSummary {
  asin: string;
  title: string;
  imageUrl?: string;
  currentPrice: number;
  trackedBy: string[];
  createdAt: string;
  lastChecked?: string;
  trackerCount: number;
  lastAlertSent?: string | null;
  cooldownHours?: number;
}

// Response structure for products with pagination
interface ProductsResponse {
  products: ProductSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export default function ProductsPanel() {
  const { toast } = useToast();

  // State for filtering, sorting, and pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [searchFilter, setSearchFilter] = useState('');
  const [sortBy, setSortBy] = useState<string | null>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const { data: productsResponse, isLoading, refetch } = useQuery<ProductsResponse>({
    queryKey: ['admin-products', currentPage, searchFilter, sortBy, sortOrder],
    queryFn: async () => {
      const token = AdminAuth.getToken();
      if (!token) {
        throw new Error("Admin authentication required");
      }

      const params = new URLSearchParams({
        token,
        page: currentPage.toString(),
        limit: '25',
        sortBy: sortBy || 'createdAt',
        sortOrder,
        ...(searchFilter && { search: searchFilter })
      });

      const response = await fetch(`/api/admin/products?${params}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.status}`);
      }

      const result = await response.json();

      // Handle both paginated response format and direct array format
      let rawProducts = [];
      if (Array.isArray(result.data)) {
        rawProducts = result.data;
      } else if (Array.isArray(result)) {
        rawProducts = result;
      } else {
        rawProducts = [];
      }

      // Transform data into ProductSummary format with tracker counts
      const productMap = new Map<string, ProductSummary>();

      rawProducts.forEach((item: TrackedProductAdmin) => {
        const asin = item.product.asin;

        if (productMap.has(asin)) {
          // Add email to existing product's trackedBy array
          const existing = productMap.get(asin)!;
          existing.trackedBy.push(item.email);
          existing.trackerCount = existing.trackedBy.length;
          
          // Update cooldown info if this tracker has more recent alert
          if (item.lastAlertSent && (!existing.lastAlertSent || new Date(item.lastAlertSent) > new Date(existing.lastAlertSent))) {
            existing.lastAlertSent = item.lastAlertSent;
            existing.cooldownHours = item.cooldownHours;
          }
        } else {
          // Create new product summary
          productMap.set(asin, {
            asin: item.product.asin,
            title: item.product.title,
            imageUrl: item.product.imageUrl,
            currentPrice: item.product.currentPrice,
            trackedBy: [item.email],
            createdAt: item.product.createdAt,
            lastChecked: item.product.lastChecked,
            trackerCount: 1,
            lastAlertSent: item.lastAlertSent,
            cooldownHours: item.cooldownHours
          });
        }
      });

      const products = Array.from(productMap.values());

      // Create pagination object
      const pagination = {
        page: currentPage,
        limit: 25,
        total: products.length,
        totalPages: Math.ceil(products.length / 25),
        hasNext: currentPage < Math.ceil(products.length / 25),
        hasPrev: currentPage > 1
      };

      return { products, pagination };
    }
  });

  // Helper function to calculate cooldown status
  const getCooldownStatus = (lastAlertSent: string | null, cooldownHours: number) => {
    if (!lastAlertSent) {
      return { status: 'ready', message: 'Ready for alerts', color: 'text-green-600' };
    }

    const alertTime = new Date(lastAlertSent);
    const now = new Date();
    const timeDiff = now.getTime() - alertTime.getTime();
    const hoursPassed = timeDiff / (1000 * 60 * 60);
    
    if (hoursPassed >= cooldownHours) {
      return { 
        status: 'expired', 
        message: `Cooldown expired (${Math.floor(hoursPassed)}h ago)`, 
        color: 'text-green-600' 
      };
    } else {
      const hoursRemaining = Math.ceil(cooldownHours - hoursPassed);
      return { 
        status: 'active', 
        message: `${hoursRemaining}h remaining`, 
        color: 'text-red-600' 
      };
    }
  };

  // Define table columns using the LogTable format
  const columns: LogColumn[] = [
    {
      key: 'title',
      label: 'Product',
      sortable: true,
      render: (value: string, row: ProductSummary) => (
        <div className="flex items-center gap-3 max-w-xs">
          {row.imageUrl && (
            <img
              src={row.imageUrl}
              alt={value}
              className="w-12 h-12 object-cover rounded border flex-shrink-0"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          )}
          <div className="truncate" title={value}>
            <div className="font-medium truncate">{value}</div>
            <div className="text-xs text-gray-500 font-mono">{row.asin}</div>
          </div>
        </div>
      )
    },
    {
      key: 'asin',
      label: 'ASIN',
      sortable: true,
      render: (value: string) => (
        <span className="font-mono text-sm">{value}</span>
      ),
      className: 'hidden md:table-cell'
    },
    {
      key: 'currentPrice',
      label: 'Current Price',
      sortable: true,
      render: (value: number) => (
        <span className="font-medium">${value.toFixed(2)}</span>
      )
    },
    {
      key: 'trackerCount',
      label: '# of Trackers',
      sortable: true,
      render: (value: number) => (
        <Badge variant="secondary" className="text-xs">
          {value}
        </Badge>
      ),
      className: 'text-center'
    },
    {
      key: 'lastAlertSent',
      label: 'Last Alert',
      sortable: true,
      render: (value: string | null, row: ProductSummary) => (
        <div className="text-sm">
          {value ? (
            <div>
              <div>{new Date(value).toLocaleDateString()}</div>
              <div className="text-xs text-gray-500">
                {new Date(value).toLocaleTimeString()}
              </div>
            </div>
          ) : (
            <span className="text-gray-400">Never</span>
          )}
        </div>
      ),
      className: 'hidden lg:table-cell'
    },
    {
      key: 'cooldownStatus',
      label: 'Cooldown Status',
      sortable: false,
      render: (value: any, row: ProductSummary) => {
        const status = getCooldownStatus(row.lastAlertSent, row.cooldownHours || 48);
        return (
          <div className="text-sm">
            <div className={`font-medium ${status.color}`}>
              {status.status === 'ready' && '🟢'}
              {status.status === 'expired' && '🟢'}
              {status.status === 'active' && '🔴'}
              {' '}{status.message}
            </div>
            <div className="text-xs text-gray-500">
              ({row.cooldownHours || 48}h period)
            </div>
          </div>
        );
      },
      className: 'hidden md:table-cell'
    },
    {
      key: 'lastChecked',
      label: 'Last Updated',
      sortable: true,
      render: (value: string) => (
        <div className="text-sm">
          {value ? new Date(value).toLocaleString() : 'N/A'}
        </div>
      ),
      className: 'hidden lg:table-cell'
    },
    {
      key: 'createdAt',
      label: 'Created Date',
      sortable: true,
      render: (value: string) => (
        <div className="text-sm">
          {new Date(value).toLocaleDateString()}
        </div>
      ),
      className: 'hidden lg:table-cell'
    }
  ];

  // Handle sorting
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  // Handle pagination
  const handlePageChange = (newPage: number) => {
    console.log(`[ProductsPanel] Page change requested: ${currentPage} -> ${newPage}`);
    setCurrentPage(newPage);
    // Refetch will happen automatically due to the dependency on currentPage
  };

  // Handle search with debouncing
  const handleSearch = (value: string) => {
    setSearchFilter(value);
    setCurrentPage(1); // Reset to page 1 when searching
  };

  // Export products to CSV
  const exportProducts = () => {
    const products = productsResponse?.products || [];
    if (products.length === 0) {
      toast({
        title: "No data to export",
        description: "There are no products to export.",
        variant: "destructive"
      });
      return;
    }

    const csvHeaders = ['ASIN', 'Title', 'Current Price', 'Tracker Count', 'Tracked By', 'Last Updated', 'Created Date'];
    const csvRows = products.map(product => [
      product.asin,
      `"${product.title.replace(/"/g, '""')}"`,
      product.currentPrice.toFixed(2),
      product.trackerCount,
      `"${product.trackedBy.join(', ')}"`,
      product.lastChecked ? new Date(product.lastChecked).toISOString() : 'N/A',
      new Date(product.createdAt).toISOString()
    ]);

    const csvContent = [csvHeaders.join(','), ...csvRows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `products-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Export successful",
      description: `Exported ${products.length} products to CSV.`
    });
  };

  // Calculate summary statistics
  const products = productsResponse?.products || [];
  const totalProducts = products.length;
  const totalTrackers = products.reduce((sum, p) => sum + p.trackerCount, 0);
  const avgPrice = totalProducts > 0
    ? products.reduce((sum, p) => sum + p.currentPrice, 0) / totalProducts
    : 0;

  return (
    <div className="space-y-6">
      {/* Product Data Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Products Management
          </CardTitle>
          <CardDescription>View and manage all tracked products</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-800 mb-2">Product Data Summary</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-blue-600 font-medium">Total Products:</span>
                <div className="text-lg font-bold text-blue-800">{totalProducts}</div>
              </div>
              <div>
                <span className="text-blue-600 font-medium">Total Trackers:</span>
                <div className="text-lg font-bold text-blue-800">{totalTrackers}</div>
              </div>
              <div>
                <span className="text-blue-600 font-medium">Avg. Price:</span>
                <div className="text-lg font-bold text-blue-800">${avgPrice.toFixed(2)}</div>
              </div>
              <div>
                <span className="text-blue-600 font-medium">Status:</span>
                <div className="text-lg font-bold text-green-600">
                  {totalProducts > 0 ? 'Live' : 'No Data'}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Product Controls Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Product Controls</CardTitle>
          <CardDescription>Search, filter, and manage tracked products</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Search Products
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by title or ASIN..."
                  value={searchFilter}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchFilter('');
                  setSortBy('createdAt');
                  setSortOrder('desc');
                  setCurrentPage(1);
                }}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <LogTable
        data={products}
        loading={isLoading}
        columns={columns}
        sortBy={sortBy || undefined}
        sortOrder={sortOrder}
        onSort={handleSort}
        pagination={productsResponse?.pagination}
        onPageChange={handlePageChange}
        onRefresh={() => refetch()}
        onExport={exportProducts}
        title="Tracked Products"
        emptyMessage="No tracked products found. Products will appear here once users start tracking them."
        emptyIcon={<Package className="h-12 w-12 mx-auto text-gray-400" />}
      >
        {/* Data source indicator */}
        <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
          <span><strong>Data source:</strong> DATABASE</span>
          <span><strong>Products shown:</strong> {products.length}</span>
          {searchFilter && (
            <span><strong>Search:</strong> "{searchFilter}"</span>
          )}
        </div>
      </LogTable>
    </div>
  );
}