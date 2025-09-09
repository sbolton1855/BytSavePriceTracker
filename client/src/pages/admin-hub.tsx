
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AdminLayout from "@/components/AdminLayout";
import AdminTabNav from "@/components/AdminTabNav";
import EmailPanel from "@/components/EmailPanel";
import AnalyticsPanel from "@/components/AnalyticsPanel";
import ToolsPanel from "@/components/ToolsPanel";
import ProductsPanel from "@/components/ProductsPanel";
import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { 
  Mail, 
  Send, 
  FileText, 
  Zap, 
  BarChart3, 
  Activity, 
  Database, 
  Search,
  Settings,
  Users,
  Package,
  AlertTriangle
} from "lucide-react";

export default function AdminHub() {
  const { toast } = useToast();
  const [location] = useLocation();
  
  // Get current tab from URL query parameter
  const tab = new URLSearchParams(window.location.search).get('tab') || 'email';

  const emailTools = [
    {
      name: "Email Testing",
      description: "Test email templates and sending",
      href: `/admin/email-test`,
      icon: Send,
      badge: "Core"
    },
    {
      name: "Email Logs",
      description: "View sent email history",
      href: `/admin/email-logs`,
      icon: FileText,
      badge: "Logs"
    },
    {
      name: "Force Alerts",
      description: "Manually trigger price drop alerts",
      href: `/admin/force-alerts`,
      icon: Zap,
      badge: "Testing"
    }
  ];

  const analyticsTools = [
    {
      name: "Admin Dashboard",
      description: "System statistics and metrics",
      href: "/admin-dashboard",
      icon: BarChart3,
      badge: "Live"
    },
    {
      name: "API Monitor",
      description: "Monitor API performance and errors",
      href: "/admin/api-monitor",
      icon: Activity,
      badge: "Real-time"
    },
    {
      name: "API Errors",
      description: "View and track API errors",
      href: "/admin/api-errors",
      icon: AlertTriangle,
      badge: "Debug"
    }
  ];

  const systemTools = [
    {
      name: "ASIN Inspector",
      description: "Inspect individual product data",
      href: `/admin/asin-inspector`,
      icon: Search,
      badge: "Debug"
    },
    {
      name: "Cache Management",
      description: "Manage system cache",
      href: `/admin/cache`,
      icon: Database,
      badge: "System"
    }
  ];

  const productTools = [
    {
      name: "Manage Products",
      description: "View and manage all tracked products",
      href: `/admin/products`,
      icon: Package,
      badge: "Management"
    }
  ];

  const ToolCard = ({ tool }: { tool: any }) => (
    <Link key={tool.name} href={tool.href}>
      <Card className="cursor-pointer transition-all hover:shadow-md hover:scale-105">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <tool.icon className="h-5 w-5 text-blue-600" />
            <Badge variant="secondary" className="text-xs">
              {tool.badge}
            </Badge>
          </div>
          <h3 className="font-semibold mb-1">{tool.name}</h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            {tool.description}
          </p>
        </CardContent>
      </Card>
    </Link>
  );

  

  const renderTabContent = () => {
    switch (tab) {
      case 'email':
      default:
        return <EmailPanel />;
      case 'analytics':
        return <AnalyticsPanel />;
      case 'tools':
        return <ToolsPanel />;
      case 'products':
        return <ProductsPanel />;
    }
  };

  return (
    <AdminLayout 
      title="Admin Hub" 
      description="Comprehensive administrative control panel for BytSave system management"
    >
      <div className="space-y-6">
        {/* System Status Overview */}
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-green-700">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="font-medium">System Status: Online</span>
            </div>
            <p className="text-sm text-green-600 mt-1">
              All admin tools are accessible and functioning normally.
            </p>
          </CardContent>
        </Card>

        {/* Tabbed Navigation */}
        <AdminTabNav activeTab={tab} onTabChange={() => {}} />

        {/* Tab Content */}
        {renderTabContent()}

        {/* Quick Actions - always visible */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Quick Actions
            </CardTitle>
            <CardDescription>Frequently used admin shortcuts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" asChild>
                <Link href={`/admin/email-test`}>
                  <Mail className="h-4 w-4 mr-2" />
                  Test Email
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/admin-dashboard">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  View Stats
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/admin/email-logs`}>
                  <FileText className="h-4 w-4 mr-2" />
                  Email Logs
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/api-monitor">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Check Errors
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        </div>
    </AdminLayout>
  );
}
