import React, { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface ErrorLog {
  type: string;
  asin: string;
  message: string;
  timestamp: string;
}

interface ErrorDistribution {
  [key: string]: number;
}

const ERROR_COLORS = {
  API_FAILURE: '#FF6B6B',
  PRICE_MISMATCH: '#4ECDC4',
  RATE_LIMIT: '#FFD93D',
  TIMEOUT: '#95A5A6',
  NOT_FOUND: '#BDC3C7',
  DEFAULT: '#6C5CE7'
};

export function ErrorMonitor() {
  const [recentErrors, setRecentErrors] = useState<ErrorLog[]>([]);
  const [distribution, setDistribution] = useState<ErrorDistribution>({});
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d'>('24h');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const since = getTimeInMs(timeRange);
        const response = await fetch(`/api/errors?since=${since}`);
        const data = await response.json();
        
        setRecentErrors(data.errors);
        setDistribution(data.distribution);
      } catch (error) {
        console.error('Failed to fetch error data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, [timeRange]);

  if (loading) {
    return <div>Loading error data...</div>;
  }

  if (recentErrors.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Amazon API Error Monitor</h3>
        <div className="text-center text-gray-500 py-8">
          <p>No API errors logged yet.</p>
          <p className="text-sm mt-2">The system is running smoothly! 🎉</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Amazon API Error Monitor</h3>
        <div className="flex space-x-2">
          {['1h', '24h', '7d'].map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range as any)}
              className={`px-3 py-1 rounded ${
                timeRange === range ? 'bg-blue-500 text-white' : 'bg-gray-200'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Error Distribution Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={Object.entries(distribution).map(([type, count]) => ({
                name: type,
                value: count
              }))}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              fill="#8884d8"
              paddingAngle={5}
              dataKey="value"
              label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
            >
              {Object.entries(distribution).map(([type]) => (
                <Cell key={type} fill={ERROR_COLORS[type] || ERROR_COLORS.DEFAULT} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Errors Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-2 text-left">Time</th>
              <th className="px-4 py-2 text-left">Type</th>
              <th className="px-4 py-2 text-left">ASIN</th>
              <th className="px-4 py-2 text-left">Message</th>
            </tr>
          </thead>
          <tbody>
            {recentErrors.map((error, index) => (
              <tr key={index} className="border-t">
                <td className="px-4 py-2 text-gray-500">
                  {new Date(error.timestamp).toLocaleTimeString()}
                </td>
                <td className="px-4 py-2">
                  <span
                    className="px-2 py-1 rounded text-xs font-medium"
                    style={{
                      backgroundColor: ERROR_COLORS[error.type] || ERROR_COLORS.DEFAULT,
                      color: 'white'
                    }}
                  >
                    {error.type}
                  </span>
                </td>
                <td className="px-4 py-2 font-mono text-sm">{error.asin}</td>
                <td className="px-4 py-2 text-gray-600">{error.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function getTimeInMs(range: string): number {
  switch (range) {
    case '1h':
      return 60 * 60 * 1000;
    case '24h':
      return 24 * 60 * 60 * 1000;
    case '7d':
      return 7 * 24 * 60 * 60 * 1000;
    default:
      return 24 * 60 * 60 * 1000;
  }
} 