
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ShoppingCart, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TrackedProductWithDetails {
  id: number;
  product: {
    id: number;
    title: string;
    currentPrice: number;
    imageUrl?: string;
    url: string;
  };
}

interface AIRecommendation {
  category: string;
  reasoning: string;
  suggestions: string[];
  searchTerms: string[];
}

interface AIRecommendationsProps {
  trackedProducts: TrackedProductWithDetails[];
  userEmail: string;
}

export const AIRecommendations: React.FC<AIRecommendationsProps> = ({ 
  trackedProducts = [], 
  userEmail 
}) => {
  const [recommendations, setRecommendations] = useState<AIRecommendation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const generateRecommendations = async () => {
    if (!trackedProducts || trackedProducts.length === 0) {
      toast({
        title: "No products to analyze",
        description: "Add some products to your watchlist first to get AI recommendations!",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/ai/recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          trackedProducts: (trackedProducts || []).map(tp => ({
            title: tp.product.title,
            price: tp.product.currentPrice
          })),
          userEmail
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate recommendations');
      }

      const data = await response.json();
      setRecommendations(data.recommendations);
      
      toast({
        title: "AI Recommendations Generated! 🤖",
        description: "Check out your personalized product suggestions below.",
      });
    } catch (error) {
      console.error('Error generating recommendations:', error);
      toast({
        title: "Failed to generate recommendations",
        description: "Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const searchForRecommendation = async (searchTerm: string) => {
    setIsLoading(true);
    try {
      // Open Amazon search with affiliate tag
      const amazonSearchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(searchTerm)}&tag=bytsave-20`;
      window.open(amazonSearchUrl, '_blank');
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-600" />
          <CardTitle>AI-Powered Recommendations</CardTitle>
        </div>
        <CardDescription>
          Get personalized product suggestions based on your watchlist
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!recommendations ? (
          <div className="text-center py-8">
            <Sparkles className="h-12 w-12 text-purple-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Discover Your Perfect Products
            </h3>
            <p className="text-gray-600 mb-4">
              Let AI analyze your {trackedProducts.length} tracked products and suggest 
              complementary items you might love!
            </p>
            <Button 
              onClick={generateRecommendations}
              disabled={isGenerating || !trackedProducts || trackedProducts.length === 0}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              {isGenerating ? (
                <>
                  <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing Your Preferences...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate AI Recommendations
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Category Badge */}
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-sm">
                Category: {recommendations.category}
              </Badge>
            </div>

            {/* AI Reasoning */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg border">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-600" />
                AI Analysis
              </h4>
              <p className="text-sm text-gray-700">{recommendations.reasoning}</p>
            </div>

            {/* Recommendations */}
            <div>
              <h4 className="font-semibold mb-3">Recommended Products:</h4>
              <div className="grid gap-3">
                {recommendations.suggestions.map((suggestion, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-3 bg-white border rounded-lg hover:shadow-md transition-shadow"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {suggestion}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => searchForRecommendation(recommendations.searchTerms[index] || suggestion)}
                      disabled={isLoading}
                      className="ml-3"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Find on Amazon
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Regenerate Button */}
            <div className="pt-4 border-t">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={generateRecommendations}
                disabled={isGenerating}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                    Generating New Recommendations...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate New Recommendations
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
