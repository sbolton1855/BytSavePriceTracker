
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, AlertTriangle, CheckCircle } from "lucide-react";

interface ForceAlertResult {
  asin: string;
  success: boolean;
  message: string;
  emailsSent?: number;
}

export default function AdminForceAlerts() {
  const [adminToken, setAdminToken] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [asinList, setAsinList] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<ForceAlertResult[]>([]);
  const [error, setError] = useState('');

  const handleLogin = () => {
    if (adminToken) {
      setIsAuthenticated(true);
    }
  };

  const handleForceAlerts = async () => {
    if (!asinList.trim()) {
      setError('Please enter at least one ASIN');
      return;
    }

    setIsLoading(true);
    setError('');
    setResults([]);

    try {
      const asins = asinList
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      const response = await fetch('/api/dev/force-alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: adminToken,
          asins
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to trigger alerts');
      }

      const data = await response.json();
      setResults(data.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto mt-16 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Admin Access Required</CardTitle>
            <CardDescription>Enter admin token to access force alert testing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="password"
              placeholder="Admin Token"
              value={adminToken}
              onChange={(e) => setAdminToken(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            />
            <Button onClick={handleLogin} className="w-full">
              Access Force Alerts
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Force Price Drop Alerts</h1>
        <p className="text-gray-600">Manually trigger price drop alerts for testing purposes</p>
      </div>

      {/* Input Form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Trigger Alerts</CardTitle>
          <CardDescription>
            Enter ASINs (one per line) to force trigger price drop alerts for testing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              ASINs (one per line)
            </label>
            <textarea
              className="w-full h-32 p-3 border rounded-lg resize-none font-mono text-sm"
              placeholder="B08RRR61NB&#10;B0787GLBMV&#10;B09WTYDVNW"
              value={asinList}
              onChange={(e) => setAsinList(e.target.value)}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button 
            onClick={handleForceAlerts} 
            disabled={isLoading || !asinList.trim()}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Triggering Alerts...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Force Trigger Alerts
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Alert Results</CardTitle>
            <CardDescription>
              Results from the latest force alert trigger
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {results.map((result, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {result.success ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                    )}
                    <div>
                      <div className="font-mono text-sm font-medium">
                        {result.asin}
                      </div>
                      <div className="text-sm text-gray-600">
                        {result.message}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {result.emailsSent !== undefined && (
                      <Badge variant="secondary">
                        {result.emailsSent} emails sent
                      </Badge>
                    )}
                    <Badge variant={result.success ? "default" : "destructive"}>
                      {result.success ? "Success" : "Failed"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <div className="text-sm text-blue-700">
                <strong>Note:</strong> This feature bypasses normal price checking and forces alerts 
                to be sent for all products with active tracking by users. Use for testing purposes only.
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
