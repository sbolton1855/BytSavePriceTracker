
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";

interface OpenAIResponse {
  success: boolean;
  message?: string;
  response?: string;
  timestamp?: string;
  error?: string;
  details?: string;
}

export function OpenAITest() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OpenAIResponse | null>(null);

  const testOpenAI = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/openai/test');
      const data: OpenAIResponse = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: 'Failed to connect to OpenAI endpoint',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          OpenAI Integration Test
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={testOpenAI} 
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Testing OpenAI...
            </>
          ) : (
            'Test OpenAI Integration'
          )}
        </Button>

        {result && (
          <div className={`p-4 rounded-lg border ${
            result.success 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              <span className={`font-semibold ${
                result.success ? 'text-green-800' : 'text-red-800'
              }`}>
                {result.success ? 'Success!' : 'Error'}
              </span>
            </div>

            {result.message && (
              <p className="mb-2 font-medium">
                {result.message}
              </p>
            )}

            {result.response && (
              <div className="mb-2">
                <p className="font-medium mb-1">OpenAI Response:</p>
                <p className="italic text-gray-700">"{result.response}"</p>
              </div>
            )}

            {result.timestamp && (
              <p className="text-sm text-gray-600">
                Timestamp: {new Date(result.timestamp).toLocaleString()}
              </p>
            )}

            {result.error && (
              <div className="mt-2">
                <p className="font-medium text-red-700">Error: {result.error}</p>
                {result.details && (
                  <p className="text-sm text-red-600">Details: {result.details}</p>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
