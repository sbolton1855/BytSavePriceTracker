
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Package, Search } from "lucide-react";
import { AdminAuth } from "@/lib/admin-auth";
import LogTable, { LogColumn } from "@/components/LogTable";

// Product data interface based on API response
interface TrackedProductAdmin {
  id: number;
  userId: string | null;
  email: string;
  productId: number;
  targetPrice: number;
  createdAt: string;
  product: {
    id: number;
    asin: string;
    title: string;
    url: string;
    currentPrice: number;
    originalPrice: number | null;
    lastChecked: string;
    createdAt: string;
    imageUrl?: string;
  };
}

// Simplified data structure for display
interface ProductSummary {
  asin: string;
  title: string;
  currentPrice: number;
  trackedBy: string[];
  createdAt: string;
  lastChecked: string;
  trackerCount: number;
  imageUrl?: string;
}

// API response structure
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
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Fetch products data
  const { data: productsData, isLoading, refetch, error } = useQuery<ProductSummary[]>({
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
        sortBy,
        sortOrder,
        ...(searchFilter && { search: searchFilter })
      });

      const response = await fetch(`/api/admin/products?${params}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.status}`);
      }

      const result = await response.json();
      
      // Handle both paginated response format and direct array format
      let products = [];
      if (Array.isArray(result.data)) {
        products = result.data;
      } else if (Array.isArray(result)) {
        products = result;
      } else {
        products = [];
      }

      // Transform data into ProductSummary format with tracker counts
      const productMap = new Map<string, ProductSummary>();

      products.forEach((item: TrackedProductAdmin) => {
        const asin = item.product.asin;

        if (productMap.has(asin)) {
          // Add email to existing product's trackedBy array
          const existing = productMap.get(asin)!;
          existing.trackedBy.push(item.email);
          existing.trackerCount = existing.trackedBy.length;
        } else {
          // Create new product summary
          productMap.set(asin, {
            asin: item.product.asin,
            title: item.product.title,
            currentPrice: item.product.currentPrice,
            trackedBy: [item.email],
            createdAt: item.product.createdAt,
            lastChecked: item.product.lastChecked,
            trackerCount: 1,
            imageUrl: item.product.imageUrl
          });
        }
      });

      return Array.from(productMap.values());
    },
    refetchInterval: 30000 // Refetch every 30 seconds
  });

  // Create pagination data
  const pagination = {
    page: currentPage,
    limit: 25,
    total: productsData?.length || 0,
    totalPages: Math.ceil((productsData?.length || 0) / 25),
    hasNext: currentPage < Math.ceil((productsData?.length || 0) / 25),
    hasPrev: currentPage > 1
  };

  // Handle search with debouncing
  const handleSearch = (value: string) => {
    setSearchFilter(value);
    setCurrentPage(1); // Reset to page 1 when searching
  };

  // Handle sorting
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
    setCurrentPage(1); // Reset to page 1 when sorting
  };

  // Handle pagination
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  // Export products to CSV
  const exportProducts = () => {
    if (!productsData?.length) {
      toast({
        title: "No data to export",
        description: "There are no products to export.",
        variant: "destructive"
      });
      return;
    }

    const csvContent = [
      ['ASIN', 'Title', 'Current Price', 'Trackers', 'Tracked Emails', 'Last Updated', 'Created Date'].join(','),
      ...productsData.map(product => [
        product.asin,
        `"${product.title.replace(/"/g, '""')}"`,
        product.currentPrice,
        product.trackerCount,
        `"${product.trackedBy.join(', ')}"`,
        new Date(product.lastChecked).toISOString(),
        new Date(product.createdAt).toISOString()
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `products_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export successful",
      description: `Exported ${productsData.length} products to CSV.`
    });
  };

  // Define table columns using the LogTable format
  const columns: LogColumn[] = [
    {
      key: 'product',
      label: 'Product',
      render: (value: any, row: ProductSummary) => (
        <div className="flex items-start gap-3 max-w-md">
          {row.imageUrl && (
            <img 
              src={row.imageUrl} 
              alt={row.title}
              className="w-12 h-12 object-cover rounded border flex-shrink-0"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="font-medium text-sm leading-tight mb-1 line-clamp-2" title={row.title}>
              {row.title}
            </div>
            <div className="text-xs text-gray-500 font-mono">
              {row.asin}
            </div>
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
      )
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
        <div className="text-center">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {value}
          </span>
        </div>
      )
    },
    {
      key: 'lastChecked',
      label: 'Last Updated',
      sortable: true,
      render: (value: string) => (
        <div className="text-sm">
          {new Date(value).toLocaleString()}
        </div>
      )
    },
    {
      key: 'createdAt',
      label: 'Created Date',
      sortable: true,
      render: (value: string) => (
        <div className="text-sm">
          {new Date(value).toLocaleDateString()}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Products Management
          </CardTitle>
          <CardDescription>
            View and manage all tracked products
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600 font-medium">Total Products:</span>
              <div className="text-lg font-bold text-blue-800">
                {productsData?.length || 0}
              </div>
            </div>
            <div>
              <span className="text-gray-600 font-medium">Total Trackers:</span>
              <div className="text-lg font-bold text-blue-800">
                {productsData?.reduce((sum, p) => sum + p.trackerCount, 0) || 0}
              </div>
            </div>
            <div>
              <span className="text-gray-600 font-medium">Avg. Price:</span>
              <div className="text-lg font-bold text-blue-800">
                ${productsData?.length ? (productsData.reduce((sum, p) => sum + p.currentPrice, 0) / productsData.length).toFixed(2) : '0.00'}
              </div>
            </div>
            <div>
              <span className="text-gray-600 font-medium">Status:</span>
              <div className="text-lg font-bold text-green-600">
                {productsData?.length ? 'Live' : 'No Data'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Product Filters</CardTitle>
          <CardDescription>Search and filter tracked products</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-center">
            <div className="flex-1 max-w-md">
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
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <LogTable
        data={productsData || []}
        loading={isLoading}
        error={error?.message || null}
        columns={columns}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        pagination={pagination}
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
          <span><strong>Products shown:</strong> {productsData?.length || 0}</span>
          {searchFilter && (
            <span><strong>Filtered by:</strong> "{searchFilter}"</span>
          )}
        </div>
      </LogTable>
    </div>
  );
}
