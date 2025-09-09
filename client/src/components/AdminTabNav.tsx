
import React from 'react';
import { Link } from 'wouter';
import { Mail, BarChart3, Settings, Package } from 'lucide-react';

interface AdminTabNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function AdminTabNav({ activeTab }: AdminTabNavProps) {
  const tabs = [
    { id: 'email', label: 'Email', icon: Mail },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'tools', label: 'Tools', icon: Settings },
    { id: 'products', label: 'Products', icon: Package }
  ];

  return (
    <div className="w-full overflow-x-auto">
      <nav className="flex space-x-1 bg-muted p-1 rounded-md mb-8">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={`/admin?tab=${tab.id}`}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-sm transition-all hover:bg-background hover:text-foreground"
          >
            <tab.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
