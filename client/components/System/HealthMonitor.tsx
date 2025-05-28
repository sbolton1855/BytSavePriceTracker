import React, { useEffect, useState } from 'react';

interface SystemStatus {
  status: {
    amazon: string;
    uptime: string;
  };
  trackedProducts: number;
  lastHour: {
    apiHits: number;
    cacheEfficiency: number;
    priceDrops: number;
  };
  timestamp: string;
}

interface Activity {
  type: 'price_drop' | 'error';
  timestamp: string;
  data: {
    asin: string;
    title?: string;
    dropAmount?: number;
    dropPercent?: number;
    type?: string;
    message?: string;
  };
}

export function HealthMonitor() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statusRes, activitiesRes] = await Promise.all([
          fetch('/api/system/status'),
          fetch('/api/activity/feed')
        ]);

        const [statusData, activitiesData] = await Promise.all([
          statusRes.json(),
          activitiesRes.json()
        ]);

        setStatus(statusData);
        setActivities(activitiesData);
      } catch (error) {
        console.error('Failed to fetch system health data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div>Loading system status...</div>;
  }

  return (
    <div className="space-y-6">
      {/* System Status */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">System Status</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatusCard
            title="Amazon API"
            status={status?.status.amazon === 'ok' ? 'healthy' : 'error'}
            value={status?.status.amazon === 'ok' ? '✓ Online' : '✗ Offline'}
          />
          <StatusCard
            title="API Uptime"
            status="info"
            value={status?.status.uptime || '0%'}
          />
          <StatusCard
            title="Tracked Products"
            status="info"
            value={status?.trackedProducts.toString() || '0'}
          />
          <StatusCard
            title="Price Drops (1h)"
            status="info"
            value={status?.lastHour.priceDrops.toString() || '0'}
          />
        </div>
      </div>

      {/* Activity Feed */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
        <div className="space-y-2">
          {activities.map((activity, index) => (
            <ActivityItem key={index} activity={activity} />
          ))}
        </div>
      </div>

      {/* Last Update */}
      <div className="text-right text-sm text-gray-500">
        Last updated: {status ? new Date(status.timestamp).toLocaleString() : 'Never'}
      </div>
    </div>
  );
}

function StatusCard({
  title,
  status,
  value
}: {
  title: string;
  status: 'healthy' | 'error' | 'info';
  value: string;
}) {
  const getStatusColor = () => {
    switch (status) {
      case 'healthy':
        return 'text-green-500';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-blue-500';
    }
  };

  return (
    <div className="p-3 border rounded">
      <div className="text-sm text-gray-500">{title}</div>
      <div className={`text-lg font-semibold ${getStatusColor()}`}>{value}</div>
    </div>
  );
}

function ActivityItem({ activity }: { activity: Activity }) {
  const getIcon = () => {
    switch (activity.type) {
      case 'price_drop':
        return '📉';
      case 'error':
        return '⚠️';
      default:
        return '📌';
    }
  };

  const getMessage = () => {
    if (activity.type === 'price_drop') {
      return `${activity.data.title} dropped by $${activity.data.dropAmount?.toFixed(2)} (-${activity.data.dropPercent?.toFixed(1)}%)`;
    } else {
      return `${activity.data.type}: ${activity.data.message}`;
    }
  };

  return (
    <div className="flex items-start space-x-2 text-sm">
      <span>{getIcon()}</span>
      <span className="flex-1">{getMessage()}</span>
      <span className="text-gray-400">
        {new Date(activity.timestamp).toLocaleTimeString()}
      </span>
    </div>
  );
} 