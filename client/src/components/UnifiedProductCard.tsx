
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface UnifiedProductCardProps {
  title: string;
  image: string;
  url: string;
  currentPrice: string;
  originalPrice?: string;
  savings?: {
    amount?: string;
    percentage?: number;
  };
  asin: string;
}

export function UnifiedProductCard({ 
  title, 
  image, 
  url, 
  currentPrice, 
  originalPrice, 
  savings, 
  asin 
}: UnifiedProductCardProps) {
  return (
    <Card className="h-full flex flex-col justify-between shadow-sm border hover:shadow-md transition-shadow">
      <CardContent className="flex flex-col space-y-2 p-3">
        <div className="w-full h-40 flex items-center justify-center bg-slate-50 rounded-md overflow-hidden">
          <img
            src={image}
            alt={title}
            className="max-w-full max-h-full object-contain"
          />
        </div>
        <div className="text-sm font-semibold leading-tight line-clamp-3 min-h-[3rem]">
          {title}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-green-600 font-bold text-sm">${currentPrice}</span>
          {originalPrice && (
            <span className="line-through text-gray-400 text-xs">${originalPrice}</span>
          )}
          {savings?.percentage && (
            <Badge className="text-xs bg-red-500 hover:bg-red-600">
              {savings.percentage}% OFF
            </Badge>
          )}
          {savings?.amount && (
            <Badge className="text-xs bg-green-600 hover:bg-green-700">
              Save ${savings.amount}
            </Badge>
          )}
        </div>
      </CardContent>
      <CardFooter className="p-3 pt-0">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 text-sm font-medium hover:underline"
        >
          View Deal →
        </a>
      </CardFooter>
    </Card>
  );
}
