import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PriceHistoryPoint = {
  id: number;
  productId: number;
  price: number;
  timestamp: string;
};

type Product = {
  id: number;
  asin: string;
  title: string;
  url: string;
  imageUrl: string | null;
  currentPrice: number;
  originalPrice: number | null;
  lowestPrice: number;
  highestPrice: number;
  lastChecked: string;
  affiliateUrl: string;
};

type PriceHistoryResponse = {
  product: Product;
  priceHistory: PriceHistoryPoint[];
};

interface PriceHistoryChartProps {
  productId: number;
}

type TimeFrame = '1m' | '3m' | '6m' | '1y' | 'all';

export default function PriceHistoryChart({ productId }: PriceHistoryChartProps) {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('1m');
  
  const {
    data,
    isLoading,
    isError,
    error,
  } = useQuery<PriceHistoryResponse>({
    queryKey: [`/api/products/${productId}/price-history`],
    enabled: !!productId,
  });

  const [chartData, setChartData] = useState<any[]>([]);

  // Function to filter data based on selected time frame
  const filterDataByTimeFrame = (fullData: any[], selectedTimeFrame: TimeFrame) => {
    if (fullData.length === 0) return [];
    
    const now = new Date();
    const cutoffDate = new Date();
    
    switch (selectedTimeFrame) {
      case '1m':
        cutoffDate.setMonth(now.getMonth() - 1);
        break;
      case '3m':
        cutoffDate.setMonth(now.getMonth() - 3);
        break;
      case '6m':
        cutoffDate.setMonth(now.getMonth() - 6);
        break;
      case '1y':
        cutoffDate.setFullYear(now.getFullYear() - 1);
        break;
      case 'all':
        // Return all data
        return fullData;
      default:
        cutoffDate.setMonth(now.getMonth() - 1); // Default to 1 month
    }
    
    return fullData.filter(item => item.date >= cutoffDate);
  };

  // State to store the full unfiltered data
  const [fullChartData, setFullChartData] = useState<any[]>([]);
  
  useEffect(() => {
    if (data?.priceHistory) {
      // Create and optimize chart data
      let formattedData = data.priceHistory.map((point) => ({
        date: new Date(point.timestamp),
        price: point.price,
      }));

      // Sort by date
      formattedData.sort((a, b) => a.date.getTime() - b.date.getTime());

      // Remove duplicate price points that occur on the same day
      formattedData = formattedData.reduce((acc, current, index, array) => {
        if (index === 0) return [current];
        
        const prev = acc[acc.length - 1];
        const sameDay = prev.date.toDateString() === current.date.toDateString();
        const samePrice = Math.abs(prev.price - current.price) < 0.01;
        
        // Only keep point if price changed or it's a different day
        if (!sameDay || !samePrice) {
          acc.push(current);
        }
        return acc;
      }, [] as typeof formattedData);

      // Add current price point if needed
      const lastDataPoint = formattedData[formattedData.length - 1];
      const currentDate = new Date(data.product.lastChecked);
      const currentPrice = data.product.currentPrice;
      
      const differentDay = !lastDataPoint || 
        lastDataPoint.date.toDateString() !== currentDate.toDateString();
      const priceChanged = !lastDataPoint || 
        Math.abs(lastDataPoint.price - currentPrice) > 0.01;
      
      if (differentDay || priceChanged) {
        formattedData.push({
          date: currentDate,
          price: currentPrice,
        });
      }

      // Store full data and filter for display
      setFullChartData(formattedData);
      setChartData(filterDataByTimeFrame(formattedData, timeFrame));
    }
  }, [data, timeFrame]);
  
  // Update chart when time frame changes
  useEffect(() => {
    if (fullChartData.length > 0) {
      setChartData(filterDataByTimeFrame(fullChartData, timeFrame));
    }
  }, [timeFrame, fullChartData]);

  const formatPrice = (value: number) => {
    return `$${value.toFixed(2)}`;
  };

  const formatDate = (date: Date) => {
    return format(date, "MMM d");
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Price History</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Price History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-destructive">
            Failed to load price history: {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Price History</CardTitle>
      </CardHeader>
      <CardContent>
        {data && (
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              {data.product.imageUrl && (
                <img
                  src={data.product.imageUrl}
                  alt={data.product.title}
                  className="w-16 h-16 object-contain"
                />
              )}
              <div>
                <h3 className="font-medium">{data.product.title}</h3>
                <div className="flex items-center text-sm space-x-3 mt-1">
                  <span className="text-primary font-bold">
                    {formatPrice(data.product.currentPrice)}
                  </span>
                  {data.product.originalPrice && data.product.originalPrice > data.product.currentPrice && (
                    <span className="line-through text-muted-foreground">
                      {formatPrice(data.product.originalPrice)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Time frame selection */}
            <div className="flex flex-wrap gap-2 mt-4">
              <Button 
                size="sm" 
                variant={timeFrame === '1m' ? 'default' : 'outline'}
                onClick={() => setTimeFrame('1m')}
              >
                1 Month
              </Button>
              <Button 
                size="sm" 
                variant={timeFrame === '3m' ? 'default' : 'outline'}
                onClick={() => setTimeFrame('3m')}
              >
                3 Months
              </Button>
              <Button 
                size="sm" 
                variant={timeFrame === '6m' ? 'default' : 'outline'}
                onClick={() => setTimeFrame('6m')}
              >
                6 Months
              </Button>
              <Button 
                size="sm" 
                variant={timeFrame === '1y' ? 'default' : 'outline'}
                onClick={() => setTimeFrame('1y')}
              >
                1 Year
              </Button>
              <Button 
                size="sm" 
                variant={timeFrame === 'all' ? 'default' : 'outline'}
                onClick={() => setTimeFrame('all')}
              >
                All History
              </Button>
            </div>

            {chartData.length > 0 ? (
              <div className="h-64 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{
                      top: 5,
                      right: 20,
                      left: 10,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDate}
                      minTickGap={30}
                    />
                    <YAxis
                      domain={["auto", "auto"]}
                      tickFormatter={formatPrice}
                    />
                    <Tooltip
                      formatter={(value: number) => [
                        formatPrice(value),
                        "Price",
                      ]}
                      labelFormatter={(label: Date) =>
                        format(label, "MMMM d, yyyy")
                      }
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke="hsl(var(--primary))"
                      activeDot={{ r: 6 }}
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center">
                <p className="text-muted-foreground">
                  Not enough price history data available for {timeFrame === '1m' ? '1 month' : 
                                                             timeFrame === '3m' ? '3 months' : 
                                                             timeFrame === '6m' ? '6 months' : 
                                                             timeFrame === '1y' ? '1 year' : 'all time'}
                </p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Current</p>
                <p className="font-bold text-primary">
                  {formatPrice(data.product.currentPrice)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Lowest</p>
                <p className="font-bold text-green-600">
                  {formatPrice(data.product.lowestPrice)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Highest</p>
                <p className="font-bold text-red-600">
                  {formatPrice(data.product.highestPrice)}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}