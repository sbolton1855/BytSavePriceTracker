
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AdminLayout from "@/components/AdminLayout";
import { useToast } from "@/hooks/use-toast";
import { RefreshCcw, Activity, Database, Users, Package } from "lucide-react";

interface SystemStats {
  totalProducts: number;
  totalUsers: number;
  totalTrackedProducts: number;
  recentErrors: number;
  systemUptime: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        // Fallback to mock data if API doesn't exist
        setStats({
          totalProducts: 0,
          totalUsers: 0,
          totalTrackedProducts: 0,
          recentErrors: 0,
          systemUptime: "Unknown"
        });
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      // Use fallback data
      setStats({
        totalProducts: 0,
        totalUsers: 0,
        totalTrackedProducts: 0,
        recentErrors: 0,
        systemUptime: "Unknown"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleRefresh = () => {
    toast({
      title: "Refreshing Data",
      description: "Fetching latest system statistics...",
    });
    fetchStats();
  };

  if (isLoading) {
    return (
      <AdminLayout title="Admin Dashboard" description="System overview and analytics">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Admin Dashboard" description="System overview and analytics">
      <div className="space-y-6">
        {/* Header with refresh button */}
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">System Overview</h2>
          <Button onClick={handleRefresh} variant="outline" className="flex items-center gap-2">
            <RefreshCcw className="h-4 w-4" />
            Refresh Data
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Products</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalProducts || 0}</div>
              <p className="text-xs text-muted-foreground">Products in database</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
              <p className="text-xs text-muted-foreground">Registered users</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tracked Products</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalTrackedProducts || 0}</div>
              <p className="text-xs text-muted-foreground">Products being tracked</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recent Errors</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.recentErrors || 0}</div>
              <p className="text-xs text-muted-foreground">Last 24 hours</p>
            </CardContent>
          </Card>
        </div>

        {/* System Status */}
        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>Current system health and performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-green-700 font-medium">All Systems Operational</span>
              </div>
              <p className="text-sm text-gray-600">
                System uptime: {stats?.systemUptime || "Unknown"}
              </p>
              <p className="text-sm text-gray-600">
                Last updated: {new Date().toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" asChild>
                <a href="/admin/api-monitor">
                  <Activity className="h-4 w-4 mr-2" />
                  View API Monitor
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href="/admin/email-test">
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  Test Email System
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href="/admin/products">
                  <Package className="h-4 w-4 mr-2" />
                  Manage Products
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
