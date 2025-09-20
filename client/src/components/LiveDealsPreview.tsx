import CategoryDeals from "./CategoryDeals";

export default function LiveDealsPreview() {
  return (
    <div className="bg-white border rounded-xl shadow-sm p-4">
      <h3 className="text-sm font-semibold mb-4">Live Deals</h3>

      <CategoryDeals title="Seasonal Deals" category="seasonal" />

      <CategoryDeals title="Health & Beauty Deals" category="health" />

      <CategoryDeals title="Tech & Home Gadgets" category="tech" />

      <p className="text-[10px] text-muted-foreground mt-4">Updated daily from Amazon</p>
    </div>
  );
}