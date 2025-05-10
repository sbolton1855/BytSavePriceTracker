import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

type ProductDeal = {
  id: number;
  asin: string;
  title: string;
  url: string;
  imageUrl: string | null;
  currentPrice: number;
  originalPrice: number | null;
  discountPercentage: number;
  affiliateUrl: string;
};

type CategoryPromotion = {
  id: string;
  title: string;
  description: string;
  products: ProductDeal[];
  loading: boolean;
  error: string | null;
};

export default function DealsPage() {
  const [activeCategory, setActiveCategory] = useState<string>("beauty");
  const [promotions, setPromotions] = useState<Record<string, CategoryPromotion>>({
    beauty: {
      id: "beauty",
      title: "Amazon Beauty Deals",
      description: "Top beauty products with the biggest savings",
      products: [],
      loading: true,
      error: null
    },
    seasonal: {
      id: "seasonal",
      title: "Seasonal Sale",
      description: "Limited-time seasonal promotions from Amazon",
      products: [],
      loading: true,
      error: null
    },
    events: {
      id: "events",
      title: "Amazon Events",
      description: "Special deals from current Amazon promotional events",
      products: [],
      loading: true,
      error: null
    }
  });

  // Helper function to format price
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(price);
  };

  // Load product data for the active category
  useEffect(() => {
    const fetchPromotionProducts = async (categoryId: string) => {
      try {
        // Update loading state for this category
        setPromotions(prev => ({
          ...prev,
          [categoryId]: {
            ...prev[categoryId],
            loading: true,
            error: null
          }
        }));

        // Use our existing API to get product deals with a category filter
        const response = await fetch(`/api/products/deals?category=${categoryId}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch deals');
        }
        
        const dealsData = await response.json();
        
        // Update state with the products
        setPromotions(prev => ({
          ...prev,
          [categoryId]: {
            ...prev[categoryId],
            products: dealsData,
            loading: false
          }
        }));
      } catch (error) {
        console.error(`Error fetching ${categoryId} promotions:`, error);
        setPromotions(prev => ({
          ...prev,
          [categoryId]: {
            ...prev[categoryId],
            loading: false,
            error: 'Failed to load promotions. Please try again later.'
          }
        }));
      }
    };

    // Only fetch if we don't already have products and aren't currently loading
    if (promotions[activeCategory].products.length === 0 && !promotions[activeCategory].loading) {
      fetchPromotionProducts(activeCategory);
    }
  }, [activeCategory, promotions]);

  // Initial load when component mounts
  useEffect(() => {
    // Fetch the initial active category
    if (promotions[activeCategory].products.length === 0 && !promotions[activeCategory].error) {
      const fetchInitialData = async () => {
        try {
          const response = await fetch(`/api/products/deals?category=${activeCategory}`);
          
          if (!response.ok) {
            throw new Error('Failed to fetch deals');
          }
          
          const dealsData = await response.json();
          
          setPromotions(prev => ({
            ...prev,
            [activeCategory]: {
              ...prev[activeCategory],
              products: dealsData,
              loading: false
            }
          }));
        } catch (error) {
          console.error(`Error fetching initial ${activeCategory} promotions:`, error);
          setPromotions(prev => ({
            ...prev,
            [activeCategory]: {
              ...prev[activeCategory],
              loading: false,
              error: 'Failed to load initial promotions. Please try again later.'
            }
          }));
        }
      };
      
      fetchInitialData();
    }
  }, []);

  return (
    <>
      <Helmet>
        <title>Amazon Deals & Promotions | BytSave</title>
        <meta name="description" content="Find the best Amazon deals and promotions on beauty products, seasonal sales, and special events. Save money with exclusive discounts." />
      </Helmet>
      
      <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Amazon Promotions & Deals</h1>
          <p className="mt-4 text-xl text-gray-600">
            Discover the best Amazon deals, curated for maximum savings
          </p>
        </div>
        
        <Tabs defaultValue="beauty" className="w-full" onValueChange={setActiveCategory}>
          <div className="flex justify-center mb-8">
            <TabsList className="grid grid-cols-3 w-full max-w-md">
              <TabsTrigger value="beauty">Beauty</TabsTrigger>
              <TabsTrigger value="seasonal">Seasonal</TabsTrigger>
              <TabsTrigger value="events">Amazon Events</TabsTrigger>
            </TabsList>
          </div>
          
          {Object.keys(promotions).map(categoryId => (
            <TabsContent key={categoryId} value={categoryId} className="w-full">
              <div className="mb-8 text-center">
                <h2 className="text-2xl font-bold text-gray-900">{promotions[categoryId].title}</h2>
                <p className="mt-2 text-gray-600">{promotions[categoryId].description}</p>
              </div>
              
              {promotions[categoryId].loading ? (
                <div className="flex justify-center items-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
                  <span className="ml-2 text-lg text-gray-600">Loading {categoryId} deals...</span>
                </div>
              ) : promotions[categoryId].error ? (
                <div className="flex flex-col items-center justify-center h-64">
                  <p className="text-red-500 mb-4">{promotions[categoryId].error}</p>
                  <Button 
                    onClick={() => {
                      setPromotions(prev => ({
                        ...prev,
                        [categoryId]: { ...prev[categoryId], loading: true, error: null }
                      }));
                    }}
                  >
                    Try Again
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {promotions[categoryId].products.length > 0 ? (
                    promotions[categoryId].products.map(product => (
                      <Card key={product.id} className="overflow-hidden flex flex-col h-full">
                        <div className="overflow-hidden h-48 flex items-center justify-center bg-gray-100">
                          {product.imageUrl ? (
                            <img 
                              src={product.imageUrl} 
                              alt={product.title} 
                              className="object-contain h-full w-full"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full w-full bg-gray-200">
                              <span className="text-gray-400">No image available</span>
                            </div>
                          )}
                        </div>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base line-clamp-2 h-12" title={product.title}>
                            {product.title}
                          </CardTitle>
                          <CardDescription>
                            <span className="text-success-600 font-bold">
                              {product.discountPercentage}% OFF
                            </span>
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pb-4 flex-grow">
                          <div className="flex items-baseline mb-2">
                            <span className="text-lg font-bold text-gray-900">
                              {formatPrice(product.currentPrice)}
                            </span>
                            {product.originalPrice && (
                              <span className="ml-2 text-sm line-through text-gray-500">
                                {formatPrice(product.originalPrice)}
                              </span>
                            )}
                          </div>
                        </CardContent>
                        <CardFooter className="pt-0">
                          <a 
                            href={product.affiliateUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="w-full"
                          >
                            <Button className="w-full">View Deal</Button>
                          </a>
                        </CardFooter>
                      </Card>
                    ))
                  ) : (
                    <div className="col-span-full text-center py-12">
                      <p className="text-gray-500">No {categoryId} deals available at the moment. Please check back later.</p>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </>
  );
}