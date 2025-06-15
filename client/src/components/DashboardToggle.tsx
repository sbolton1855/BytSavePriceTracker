
import { useState } from "react";
import { Button } from "./ui/button";
import { TrendingDown, ShoppingBag } from "lucide-react";
import LiveDealsPreview from "./LiveDealsPreview";
import { PriceTrackerDashboard } from "./hero-section";

export default function DashboardToggle() {
  const [activeView, setActiveView] = useState<"deals" | "tracker">("deals");

  return (
    <div className="bg-white border rounded-xl shadow-sm p-4">
      {/* Toggle Buttons */}
      <div className="flex gap-2 mb-4">
        <Button
          variant={activeView === "deals" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveView("deals")}
          className="flex items-center gap-2"
        >
          <ShoppingBag className="h-4 w-4" />
          Live Deals
        </Button>
        <Button
          variant={activeView === "tracker" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveView("tracker")}
          className="flex items-center gap-2"
        >
          <TrendingDown className="h-4 w-4" />
          Price Tracker
        </Button>
      </div>

      {/* Content Area */}
      <div className="min-h-[300px]">
        {activeView === "deals" ? (
          <div className="-m-4">
            <LiveDealsPreview />
          </div>
        ) : (
          <div className="-m-4">
            <PriceTrackerDashboard />
          </div>
        )}
      </div>
    </div>
  );
}
