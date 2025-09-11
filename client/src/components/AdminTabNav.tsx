
import React from 'react';
import { Link } from 'wouter';
import { Mail, BarChart3, Settings, Package } from 'lucide-react';

interface AdminTabNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function AdminTabNav({ activeTab, onTabChange }: AdminTabNavProps) {
  const tabs = [
    { id: 'email', label: 'Email', icon: Mail },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'tools', label: 'Tools', icon: Settings },
    { id: 'products', label: 'Products', icon: Package }
  ];

  return (
    <div className="w-full overflow-x-auto">
      <nav className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground mb-8">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={`/admin?tab=${tab.id}`}
            onClick={(e) => {
              e.preventDefault();
              onTabChange(tab.id);
            }}
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:bg-background hover:text-foreground gap-2 ${
              activeTab === tab.id 
                ? 'bg-background text-foreground shadow-sm' 
                : ''
            }`}
          >
            <tab.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
