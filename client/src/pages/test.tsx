import { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface SearchResult {
  asin: string;
  title: string;
  price?: string;
  imageUrl?: string;
}

export default function TestPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/test/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to search products');
      }

      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Amazon Product Search Test</h1>
      
      <div className="flex gap-4 mb-8">
        <Input
          type="text"
          placeholder="Enter search query..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          className="max-w-md"
        />
        <Button onClick={handleSearch} disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Searching...
            </>
          ) : (
            'Search'
          )}
        </Button>
      </div>

      {error && (
        <div className="text-red-500 mb-4">
          Error: {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {results.map((result) => (
          <Card key={result.asin}>
            <CardContent className="p-4">
              {result.imageUrl && (
                <img
                  src={result.imageUrl}
                  alt={result.title}
                  className="w-full h-48 object-contain mb-4"
                />
              )}
              <h3 className="font-semibold mb-2">{result.title}</h3>
              {result.price && (
                <p className="text-lg font-bold text-primary-500">{result.price}</p>
              )}
              <p className="text-sm text-gray-500">ASIN: {result.asin}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {results.length === 0 && !isLoading && !error && (
        <p className="text-gray-500">No results to display. Try searching for a product.</p>
      )}
    </div>
  );
} 