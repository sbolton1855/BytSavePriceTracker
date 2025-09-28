
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
    <Card className="overflow-hidden flex flex-col h-[360px] max-w-[240px] mx-auto hover:shadow-lg transition-shadow">
      <div className="aspect-square bg-slate-50 flex items-center justify-center relative overflow-hidden h-40">
        {optimizedImageUrl ? (
          <img 
            src={optimizedImageUrl} 
            alt={title} 
            className="object-contain w-full h-full p-2"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-slate-400 text-xs">
            No image
          </div>
        )}
        <div className="absolute top-1 right-1 flex flex-col gap-0.5 items-end">
          {discount && discount > 0 && (
            <Badge className="bg-red-600 text-white font-bold text-xs px-1 py-0.5">
              {discount}% OFF
            </Badge>
          )}
          {originalPrice && currentPrice < originalPrice && savings > 0 && (
            <Badge className="bg-green-600 text-white text-xs px-1 py-0.5">
              Save ${savings.toFixed(0)}
            </Badge>
          )}
          {currentPrice < 15 && (
            <Badge className="bg-blue-600 text-white text-xs px-1 py-0.5">
              Under $15
            </Badge>
          )}
        </div>
      </div>
      <CardHeader className="p-2 pb-1">
        <CardTitle className="text-xs font-medium line-clamp-2 leading-tight h-8">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 pt-0 flex-grow">
        <div className="flex items-baseline gap-1 mb-1">
          <span className="text-sm font-bold text-primary">
            ${currentPrice.toFixed(2)}
          </span>
          {originalPrice && originalPrice > currentPrice && (
            <span className="text-xs line-through text-muted-foreground">
              ${originalPrice.toFixed(2)}
            </span>
          )}
        </div>

        {discount && discount > 0 && (
          <div className="flex items-center text-red-600 text-xs mb-1">
            <ArrowDownRight className="h-3 w-3 mr-1" />
            {discount}% off
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>L: ${(lowestPrice ?? currentPrice).toFixed(2)}</span>
            <span>H: ${(highestPrice ?? originalPrice ?? currentPrice).toFixed(2)}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="p-2 pt-0">
        <div className="space-y-1 w-full">
          <Button asChild className="w-full h-7 text-xs">
            <a href={url} target="_blank" rel="noopener noreferrer">
              View Deal <ArrowRight className="ml-1 h-3 w-3" />
            </a>
          </Button>
          {asin && (
            <Badge variant="outline" className="w-full justify-center py-0.5 border-dashed text-xs text-muted-foreground hover:bg-primary/5 cursor-pointer hover:border-primary transition-colors">
              <a href={`/dashboard?track=${asin}`} className="flex items-center w-full justify-center">
                Track Price
              </a>
            </Badge>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
