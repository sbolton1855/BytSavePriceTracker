
import { cn } from "@/lib/utils";

interface AdminSubTabNavProps {
  activeSubTab: string;
  onSubTabChange: (subTab: string) => void;
  className?: string;
}

const subTabs = [
  { id: 'templates', label: 'Templates' },
  { id: 'send', label: 'Send Test' },
  { id: 'logs', label: 'Logs' },
  { id: 'settings', label: 'Settings' }
];

export default function AdminSubTabNav({ activeSubTab, onSubTabChange, className }: AdminSubTabNavProps) {
  return (
    <div className={cn("border-b border-gray-200", className)}>
      <nav className="-mb-px flex space-x-8 overflow-x-auto">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onSubTabChange(tab.id)}
            className={cn(
              "whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm",
              activeSubTab === tab.id
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            )}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
