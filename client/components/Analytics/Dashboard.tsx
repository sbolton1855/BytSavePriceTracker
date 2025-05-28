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
import { AsinInspector } from '../Admin/AsinInspector';
import type { AnalyticsSummary } from '../../../server/controllers/analyticsController';
import { HealthMonitor } from '../System/HealthMonitor';
import { ErrorMonitor } from './ErrorMonitor';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

interface DashboardProps {
  pollInterval?: number; // milliseconds
}

export function AnalyticsDashboard({ pollInterval = 30000 }: DashboardProps) {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');
  const [showInspector, setShowInspector] = useState(false);
  const [cacheStats, setCacheStats] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [summaryRes, trendsRes, cacheStatsRes] = await Promise.all([
          fetch(`/analytics/summary?since=${getTimeInMs(timeRange)}`),
          fetch(`/analytics/trends?days=${getDays(timeRange)}`),
          fetch('/admin/cache/stats')
        ]);

        const [summaryData, trendsData, cacheStatsData] = await Promise.all([
          summaryRes.json(),
          trendsRes.json(),
          cacheStatsRes.json()
        ]);

        setSummary(summaryData);
        setTrends(trendsData);
        setCacheStats(cacheStatsData);
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, pollInterval);
    return () => clearInterval(interval);
  }, [timeRange, pollInterval]);

  const handleClearCache = async () => {
    try {
      const response = await fetch('/admin/cache/clear', {
        method: 'POST'
      });

      if (response.ok) {
        alert('Cache cleared successfully');
      } else {
        throw new Error('Failed to clear cache');
      }
    } catch (error) {
      alert('Error clearing cache');
    }
  };

  if (!summary) {
    return <div>Loading analytics...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* System Health Monitor */}
      <HealthMonitor />

      {/* Admin Controls */}
      <div className="flex justify-between items-center">
        <div className="space-x-2">
          <button
            onClick={handleClearCache}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Clear Cache
          </button>
          <button
            onClick={() => setShowInspector(!showInspector)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            {showInspector ? 'Hide Inspector' : 'ASIN Inspector'}
          </button>
          {process.env.NODE_ENV === 'development' && (
            <button
              onClick={async () => {
                try {
                  await fetch('/api/admin/errors/mock', { method: 'POST' });
                  alert('Mock errors injected');
                } catch (error) {
                  alert('Failed to inject mock errors');
                }
              }}
              className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
            >
              Inject Test Errors
            </button>
          )}
        </div>

        {/* Time Range Selector */}
        <div className="flex space-x-2">
          {['24h', '7d', '30d'].map(range => (
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

      {/* ASIN Inspector */}
      {showInspector && (
        <div className="mb-6">
          <AsinInspector />
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          title="API Hits"
          value={summary.apiHits}
          subtitle="Total requests"
        />
        <MetricCard
          title="Cache Efficiency"
          value={summary.cacheEfficiency}
          subtitle="Percentage"
          format={v => `${v.toFixed(1)}%`}
        />
        <MetricCard
          title="Price Drops"
          value={summary.priceDrops}
          subtitle="Total detected"
        />
        <MetricCard
          title="Cache Size"
          value={cacheStats?.items || 0}
          subtitle="Cached items"
        />
      </div>

      {/* Error Monitor */}
      <ErrorMonitor />

      {/* Price Drops Chart */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Price Drops Over Time</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#8884d8"
                name="Drop Count"
              />
              <Line
                type="monotone"
                dataKey="averageDropPercent"
                stroke="#82ca9d"
                name="Avg Drop %"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Price Drops */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Top Price Drops</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="px-4 py-2">Product</th>
                <th className="px-4 py-2">Old Price</th>
                <th className="px-4 py-2">New Price</th>
                <th className="px-4 py-2">Drop %</th>
                <th className="px-4 py-2">Detected</th>
              </tr>
            </thead>
            <tbody>
              {summary.topDrops.map(drop => (
                <tr key={drop.asin} className="hover:bg-gray-50">
                  <td className="px-4 py-2">{drop.title}</td>
                  <td className="px-4 py-2">${drop.oldPrice.toFixed(2)}</td>
                  <td className="px-4 py-2">${drop.newPrice.toFixed(2)}</td>
                  <td className="px-4 py-2">
                    <span className="text-red-500">
                      -{drop.dropPercent.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-500">
                    {new Date(drop.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Error Distribution */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Error Distribution</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={Object.entries(summary.errorCounts).map(([type, count]) => ({
                  name: type,
                  value: count
                }))}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                label
              >
                {Object.entries(summary.errorCounts).map((entry, index) => (
                  <Cell key={entry[0]} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Last Update */}
      <div className="text-right text-sm text-gray-500">
        Last updated: {new Date(summary.lastUpdate).toLocaleString()}
      </div>
    </div>
  );
}

// Helper component for metric cards
function MetricCard({
  title,
  value,
  subtitle,
  format = (v: number) => v.toLocaleString()
}: {
  title: string;
  value: number;
  subtitle: string;
  format?: (value: number) => string;
}) {
  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="text-3xl font-bold my-2">{format(value)}</div>
      <div className="text-sm text-gray-500">{subtitle}</div>
    </div>
  );
}

// Helper functions for time calculations
function getTimeInMs(range: string): number {
  switch (range) {
    case '24h':
      return 24 * 60 * 60 * 1000;
    case '7d':
      return 7 * 24 * 60 * 60 * 1000;
    case '30d':
      return 30 * 24 * 60 * 60 * 1000;
    default:
      return 24 * 60 * 60 * 1000;
  }
}

function getDays(range: string): number {
  switch (range) {
    case '24h':
      return 1;
    case '7d':
      return 7;
    case '30d':
      return 30;
    default:
      return 1;
  }
} 