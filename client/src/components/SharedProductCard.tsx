
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { ArrowRight, ArrowDownRight } from "lucide-react";

interface SharedProductCardProps {
  title: string;
  imageUrl?: string;
  currentPrice: number;
  originalPrice?: number;
  discount?: number;
  url: string;
  asin?: string;
  isHot?: boolean;
  premium?: boolean;
  lowestPrice?: number;
  highestPrice?: number;
}

export default function SharedProductCard({
  title,
  imageUrl,
  currentPrice,
  originalPrice,
  discount,
  url,
  asin,
  isHot = false,
  premium = false,
  lowestPrice,
  highestPrice
}: SharedProductCardProps) {
  const savings = originalPrice && originalPrice > currentPrice 
    ? originalPrice - currentPrice 
    : 0;

  // Optimize image URL for smaller size
  const optimizedImageUrl = imageUrl 
    ? imageUrl.replace(/_SL\d+_/, '_SL160_').replace(/\._AC_.*?\./, '._AC_SX160_SY160_.')
    : imageUrl;

  return (
    <Card className="overflow-hidden flex h-[120px] w-full hover:shadow-md transition-shadow border-l-4 border-l-primary/20">
      <div className="w-24 bg-slate-50 flex items-center justify-center relative overflow-hidden flex-shrink-0">
        {optimizedImageUrl ? (
          <img 
            src={optimizedImageUrl} 
            alt={title} 
            className="object-contain w-full h-full p-1"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-slate-400 text-xs">
            No image
          </div>
        )}
        {discount && discount > 0 && (
          <Badge className="absolute top-0.5 right-0.5 bg-red-600 text-white font-bold text-xs px-1 py-0.5">
            {discount}%
          </Badge>
        )}
      </div>
      <div className="flex-1 flex flex-col justify-between p-2 min-w-0">
        <div className="flex-1">
          <h3 className="text-xs font-medium line-clamp-2 leading-tight mb-1 text-gray-900">
            {title}
          </h3>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-sm font-bold text-primary">
              ${currentPrice.toFixed(2)}
            </span>
            {originalPrice && originalPrice > currentPrice && (
              <span className="text-xs line-through text-muted-foreground">
                ${originalPrice.toFixed(2)}
              </span>
            )}
            {savings > 0 && (
              <span className="text-xs text-green-600 font-medium">
                Save ${savings.toFixed(0)}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          <Button asChild size="sm" className="flex-1 h-6 text-xs px-2">
            <a href={url} target="_blank" rel="noopener noreferrer">
              View Deal
            </a>
          </Button>
          {asin && (
            <Button variant="outline" size="sm" className="h-6 text-xs px-2" asChild>
              <a href={`/dashboard?track=${asin}`}>
                Track
              </a>
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
