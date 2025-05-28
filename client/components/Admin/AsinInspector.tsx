import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface PriceHistory {
  price: number;
  timestamp: string;
}

interface CacheStatus {
  inCache: boolean;
  lastUpdated: string;
  priceDrops: Array<{
    oldPrice: number;
    newPrice: number;
    dropPercent: number;
    timestamp: string;
  }>;
}

interface Product {
  asin: string;
  title: string;
  price: number;
  originalPrice?: number;
  imageUrl?: string;
  url: string;
}

interface InspectorResponse {
  product: Product;
  priceHistory: PriceHistory[];
  cacheStatus: CacheStatus;
}

export function AsinInspector() {
  const [asin, setAsin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<InspectorResponse | null>(null);

  const inspectAsin = async (forceRefresh: boolean = false) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/admin/asin/${asin}?force=${forceRefresh}`);

      if (!response.ok) {
        throw new Error('Failed to fetch ASIN data');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    inspectAsin();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex gap-4">
          <input
            type="text"
            value={asin}
            onChange={(e) => setAsin(e.target.value)}
            placeholder="Enter ASIN"
            className="flex-1 px-3 py-2 border rounded"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            Inspect
          </button>
          <button
            type="button"
            onClick={() => inspectAsin(true)}
            disabled={loading}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
          >
            Force Refresh
          </button>
        </div>
      </form>

      {error && (
        <div className="text-red-500 mb-4">{error}</div>
      )}

      {loading && (
        <div className="text-center">Loading...</div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Product Info */}
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex gap-6">
              {data.product.imageUrl && (
                <img
                  src={data.product.imageUrl}
                  alt={data.product.title}
                  className="w-32 h-32 object-contain"
                />
              )}
              <div>
                <h2 className="text-xl font-bold mb-2">{data.product.title}</h2>
                <div className="space-y-1">
                  <p>Current Price: ${data.product.price}</p>
                  {data.product.originalPrice && (
                    <p>Original Price: ${data.product.originalPrice}</p>
                  )}
                  <a
                    href={data.product.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    View on Amazon
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Cache Status */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Cache Status</h3>
            <div className="space-y-2">
              <p>In Cache: {data.cacheStatus.inCache ? 'Yes' : 'No'}</p>
              <p>Last Updated: {new Date(data.cacheStatus.lastUpdated).toLocaleString()}</p>
            </div>
          </div>

          {/* Price History Chart */}
          {data.priceHistory.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">Price History</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.priceHistory}>
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={(timestamp) => new Date(timestamp).toLocaleDateString()}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(timestamp) => new Date(timestamp).toLocaleString()}
                      formatter={(value: number) => [`$${value}`, 'Price']}
                    />
                    <Line type="monotone" dataKey="price" stroke="#8884d8" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Price Drops */}
          {data.cacheStatus.priceDrops.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">Price Drops</h3>
              <div className="space-y-2">
                {data.cacheStatus.priceDrops.map((drop, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <span>
                      ${drop.oldPrice} → ${drop.newPrice} (-{drop.dropPercent.toFixed(1)}%)
                    </span>
                    <span className="text-gray-500">
                      {new Date(drop.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 