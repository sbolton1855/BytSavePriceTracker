import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { ArrowRight, ArrowDownRight } from "lucide-react";
import AddToWishlistButton from "./AddToWishlistButton";

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
  productId?: number;
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
  highestPrice,
  productId
}: SharedProductCardProps) {
  const savings = originalPrice && originalPrice > currentPrice
    ? originalPrice - currentPrice
    : 0;

  return (
    <Card className="overflow-hidden flex flex-col h-full hover:shadow-lg transition-shadow">
      <div className="aspect-video bg-slate-50 flex items-center justify-center relative overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="object-contain w-full h-full p-2"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-slate-400">
            No image available
          </div>
        )}
        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
          {discount && discount > 0 && (
            <Badge className="bg-red-600 text-white font-bold shadow-lg">
              {discount}% OFF
            </Badge>
          )}
          {originalPrice && currentPrice < originalPrice && (
            <Badge className="bg-green-600 text-white text-xs shadow-lg">
              Save ${savings.toFixed(2)}
            </Badge>
          )}
          {currentPrice < 15 && (
            <Badge className="bg-blue-600 text-white text-xs">
              Under $15
            </Badge>
          )}
          {premium && (
            <Badge className="bg-purple-600 text-white text-xs">
              PREMIUM DEAL
            </Badge>
          )}
          {isHot && !discount && (
            <Badge className="bg-red-500 text-white text-xs">
              HOT DEAL
            </Badge>
          )}
        </div>
      </div>
      <CardHeader className="p-4 pb-0">
        <CardTitle className="text-sm font-medium line-clamp-2">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-2 flex-grow">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold text-primary">
            ${currentPrice.toFixed(2)}
          </span>
          {originalPrice && originalPrice > currentPrice && (
            <span className="text-sm line-through text-muted-foreground">
              ${originalPrice.toFixed(2)}
            </span>
          )}
        </div>

        {discount && discount > 0 && (
          <div className="flex flex-col gap-1 mt-1">
            <div className="flex items-center text-red-600 text-sm">
              <ArrowDownRight className="h-4 w-4 mr-1" />
              Price dropped {discount}%
            </div>
            {savings > 0 && (
              <div className="text-green-600 text-sm font-medium">
                Save ${savings.toFixed(2)}
              </div>
            )}
          </div>
        )}

        <div className="mt-2 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Lowest: ${(lowestPrice ?? currentPrice).toFixed(2)}</span>
            <span>Highest: ${(highestPrice ?? originalPrice ?? currentPrice).toFixed(2)}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <div className="space-y-2 w-full">
          <div className="flex gap-2">
            <Button asChild className="flex-1">
              <a href={url} target="_blank" rel="noopener noreferrer">
                View Deal <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            {productId && (
              <AddToWishlistButton productId={productId} />
            )}
          </div>
          {asin && (
            <Badge variant="outline" className="w-full justify-center py-1 border-dashed text-xs text-muted-foreground hover:bg-primary/5 cursor-pointer hover:border-primary transition-colors">
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