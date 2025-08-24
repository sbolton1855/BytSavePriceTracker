
import React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
      <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-8">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="flex items-center gap-2 text-sm font-medium"
            >
              <tab.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
