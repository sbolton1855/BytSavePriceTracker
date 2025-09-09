
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Settings, Search, Database } from "lucide-react";

export default function ToolsPanel() {
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
          <Settings className="h-5 w-5" />
          System Tools
        </CardTitle>
        <CardDescription>Database and system management</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {systemTools.map((tool) => (
            <ToolCard key={tool.name} tool={tool} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
