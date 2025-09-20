
import { useState } from "react";
import CategoryDeals from "./CategoryDeals";
import { Button } from "./ui/button";

type CategoryType = 'seasonal' | 'health' | 'tech';

export default function LiveDealsPreview() {
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('seasonal');

  const categories: { key: CategoryType; label: string }[] = [
    { key: 'seasonal', label: 'Seasonal Deals' },
    { key: 'health', label: 'Health & Beauty' },
    { key: 'tech', label: 'Tech & Gadgets' }
  ];

  return (
    <div className="bg-white border rounded-xl shadow-sm p-4">
      <h3 className="text-sm font-semibold mb-4">Live Deals</h3>

      {/* Category Toggle Buttons */}
      <div className="flex gap-2 mb-4">
        {categories.map((cat) => (
          <Button
            key={cat.key}
            variant={selectedCategory === cat.key ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(cat.key)}
            className="text-xs"
          >
            {cat.label}
          </Button>
        ))}
      </div>

      {/* Selected Category Deals */}
      <CategoryDeals 
        title={categories.find(c => c.key === selectedCategory)?.label || 'Deals'} 
        category={selectedCategory} 
      />

      <p className="text-[10px] text-muted-foreground mt-4">Updated daily from Amazon</p>
    </div>
  );
}
