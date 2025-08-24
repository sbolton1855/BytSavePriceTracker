import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AdminLayout from "@/components/AdminLayout";
import { Link } from "wouter";
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

  const adminTools = [
    {
      title: "Email System",
      description: "Test and manage email functionality",
      icon: Mail,
      tools: [
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
      ]
    },
    {
      title: "Analytics & Monitoring",
      description: "System performance and error tracking",
      icon: BarChart3,
      tools: [
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
          href: "/api-monitor",
          icon: Activity,
          badge: "Real-time"
        }
      ]
    },
    {
      title: "System Tools",
      description: "Database and system management",
      icon: Database,
      tools: [
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
      ]
    }
  ];

  return (
    <AdminLayout 
      title="Admin Hub" 
      description="Comprehensive administrative control panel for BytSave system management"
    >
      <div className="grid gap-8">
        {adminTools.map((section, sectionIndex) => (
          <Card key={sectionIndex}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <section.icon className="h-5 w-5" />
                {section.title}
              </CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {section.tools.map((tool, toolIndex) => (
                  <Link key={toolIndex} href={tool.href}>
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
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
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

      {/* System Status Overview */}
      <Card className="mt-8 border-green-200 bg-green-50">
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

      {/* New Section: Products Management */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Products Management
          </CardTitle>
          <CardDescription>View and manage all tracked products</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" asChild>
              <Link href={`/admin/products`}>
                <Package className="h-4 w-4 mr-2" />
                Manage Products
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
    </AdminLayout>
  );
}