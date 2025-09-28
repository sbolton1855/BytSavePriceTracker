
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import UnifiedDeals from "./UnifiedDeals";

export default function DealsTabContainer() {
  return (
    <div className="w-[30%] min-w-[300px]">
      <Tabs defaultValue="live" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="live">Live Deals</TabsTrigger>
          <TabsTrigger value="trending">Trending Now</TabsTrigger>
        </TabsList>
        <TabsContent value="live" className="mt-4">
          <UnifiedDeals type="live" title="Live Deals Right Now" />
        </TabsContent>
        <TabsContent value="trending" className="mt-4">
          <UnifiedDeals type="trending" title="Trending Now" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
