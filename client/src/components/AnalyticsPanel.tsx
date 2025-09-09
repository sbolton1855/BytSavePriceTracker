
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { BarChart3, Activity, AlertTriangle } from "lucide-react";

export default function AnalyticsPanel() {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Analytics & Monitoring
        </CardTitle>
        <CardDescription>System performance and error tracking</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {analyticsTools.map((tool) => (
            <ToolCard key={tool.name} tool={tool} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
