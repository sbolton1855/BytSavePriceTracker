import { useState, useEffect } from "react";
import HeroSection from "@/components/hero-section";
import FeaturesSection from "@/components/features-section";
import ProductSearch from "@/components/product-search";
import ProductsDisplay from "@/components/products-display";
import NotificationDemo from "@/components/notification-demo";
import SimpleTracker from "@/components/simple-tracker";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const Home: React.FC = () => {
  const { user } = useAuth();
  const [userEmail, setUserEmail] = useState<string>(() => {
    // Use authenticated user's email or get from local storage
    return user?.email || localStorage.getItem("bytsave_user_email") || "";
  });
  const { toast } = useToast();

  // Update email when user changes or localStorage changes
  useEffect(() => {
    const storedEmail = localStorage.getItem("bytsave_user_email");
    if (user?.email) {
      setUserEmail(user.email);
    } else if (storedEmail && storedEmail !== userEmail) {
      setUserEmail(storedEmail);
    }

    // Handle product tracked events
    const handleProductTracked = (event: any) => {
      if (event.detail?.email) {
        setUserEmail(event.detail.email);
      }
    };

    document.addEventListener('product-tracked', handleProductTracked);
    return () => {
      document.removeEventListener('product-tracked', handleProductTracked);
    };
  }, [user]);

  // Handle successful tracker form submission
  const handleTrackerSuccess = (customEmail?: string) => {
    // Get the email either from the parameter or try to find it in the form
    let email = customEmail;

    if (!email) {
      const emailInput = document.querySelector('input[name="email"]') as HTMLInputElement;
      if (emailInput && emailInput.value) {
        email = emailInput.value;
      }
    }

    if (email) {
      setUserEmail(email);

      // Save to local storage for persistence
      localStorage.setItem("bytsave_user_email", email);

      // Show notification
      toast({
        title: "Product tracking started",
        description: "We'll send an email when the price drops below your target.",
      });
    }
  };

  // Handle quick track form submission
  const handleQuickTrackSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Get form values
    const form = e.currentTarget;
    const urlInput = form.elements.namedItem("productUrl") as HTMLInputElement;
    const priceInput = form.elements.namedItem("targetPrice") as HTMLInputElement;
    const emailInput = form.elements.namedItem("email") as HTMLInputElement;

    const productUrl = urlInput.value;
    const targetPrice = parseFloat(priceInput.value);
    const email = emailInput.value;

    if (!productUrl || !targetPrice || !email) {
      toast({
        title: "Missing required fields",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    // Send simple tracking request
    fetch("/api/track", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        productUrl,
        targetPrice,
        email
      })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error("Failed to track product");
      }
      return response.json();
    })
    .then(data => {
      console.log("Tracking success:", data);
      toast({
        title: "Product tracked!",
        description: "We'll notify you when the price drops",
      });

      // Set the email for the dashboard
      setUserEmail(email);
      localStorage.setItem("bytsave_user_email", email);

      // Reset form
      form.reset();

      // Scroll to dashboard
      document.getElementById("dashboard")?.scrollIntoView({ behavior: "smooth" });
    })
    .catch(error => {
      console.error("Tracking error:", error);
      toast({
        title: "Tracking failed",
        description: error.message,
        variant: "destructive"
      });
    });
  };

  return (
    <>
      {/* Quick Search & Track Section at the top */}
      <section className="bg-gradient-to-r from-blue-50 to-indigo-50 py-8 border-b">
        <div className="container max-w-4xl mx-auto px-4">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Search & Track</h2>
            <p className="text-gray-600">Track Amazon products by name and get notified when prices drop</p>
          </div>
          
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardContent className="p-6">
              <ProductSearch onSuccess={handleTrackerSuccess} />
            </CardContent>
          </Card>
        </div>
      </section>

      <HeroSection />
      <FeaturesSection />

      <section id="tracker" className="py-16 bg-slate-50">
        <div className="container">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-4">Track Amazon Prices</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Enter an Amazon product URL or search by name to start tracking prices
              and get notified when they drop.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Main product search and tracking component */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Search & Track</CardTitle>
                  <CardDescription>
                    Track Amazon products by name
                  </CardDescription>
                  {/* TEST ME: Simple test product search */}
                  {/* <TestProductSearch /> */}
                </CardHeader>
                <CardContent>
                  <ProductSearch onSuccess={handleTrackerSuccess} />
                </CardContent>
              </Card>
            </div>

            {/* Simple tracker for debugging */}
            <div>
              <Card className="bg-white border-2 border-amber-200">
                <CardHeader className="bg-amber-50">
                  <CardTitle>Quick Track (Simplified)</CardTitle>
                  <CardDescription>
                    Try this direct tracking form if the regular one isn't working
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mt-2">
                    <p className="text-sm text-amber-700 mb-4">⚠️ This form bypasses the advanced features and directly tracks a product by URL.</p>
                    {/* Import the SimpleTracker component */}
                    <SimpleTracker />
                  </div>
                </CardContent>
              </Card>
            </div>

          </div>
        </div>
      </section>

      {/* Only show ProductsDisplay for authenticated users */}
      {user && <ProductsDisplay email={userEmail} />}
      <NotificationDemo />
    </>
  );
};

function TestProductSearch() {
  const [query, setQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState('HealthPersonalCare');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = [
    { value: 'HealthPersonalCare', label: 'Health & Personal Care' },
    { value: 'Electronics', label: 'Electronics' },
    { value: 'ToysAndGames', label: 'Toys & Games' },
    { value: 'Beauty', label: 'Beauty' },
    { value: 'Grocery', label: 'Grocery' },
    { value: 'HomeGarden', label: 'Home & Garden' },
    { value: 'Books', label: 'Books' },
    { value: 'Fashion', label: 'Fashion' },
    { value: 'Automotive', label: 'Automotive' },
    { value: 'SportsAndOutdoors', label: 'Sports & Outdoors' },
    { value: 'PetSupplies', label: 'Pet Supplies' },
    { value: 'OfficeProducts', label: 'Office Products' },
  ];

  const handleTestSearch = async () => {
    setLoading(true);
    setError(null);
    setResults([]);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&searchIndex=${encodeURIComponent(searchIndex)}`);
      const data = await res.json();
      if (data.items) {
        setResults(data.items);
      } else {
        setError('No results found.');
      }
    } catch (err) {
      setError('Test search failed. See console for details.');
      // eslint-disable-next-line no-console
      console.error('Test search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ margin: '12px 0', padding: '8px', background: '#f3f4f6', borderRadius: '6px' }}>
      <strong>TEST ME:</strong> <span>Test Product Search</span>
      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
        <input
          type="text"
          placeholder="Enter product name or ASIN"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ flex: 2, padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4 }}
          onKeyDown={e => { if (e.key === 'Enter') handleTestSearch(); }}
        />
        <select
          value={searchIndex}
          onChange={e => setSearchIndex(e.target.value)}
          style={{ flex: 1, padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4 }}
        >
          {categories.map(cat => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>
        <button
          style={{ padding: '4px 10px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          onClick={handleTestSearch}
          disabled={loading || !query.trim()}
        >
          {loading ? 'Searching...' : 'Test Search'}
        </button>
      </div>
      <div style={{ fontSize: 13, color: '#2563eb', marginTop: 4 }}>
        Category: <b>{categories.find(cat => cat.value === searchIndex)?.label}</b>
      </div>
      {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
      <div style={{ marginTop: 12 }}>
        {loading && (
          <div style={{ color: '#2563eb', fontWeight: 500, padding: 12 }}>Searching...</div>
        )}
        {!loading && results.length > 0 && (
          <div style={{
            border: '1px solid #d1d5db',
            background: '#fff',
            borderRadius: 8,
            padding: 12,
            maxHeight: 320,
            overflowY: 'auto',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
          }}>
            <div style={{ fontWeight: 600, marginBottom: 8, color: '#2563eb' }}>Results</div>
            {results.map((item, idx) => (
              <div key={item.asin || idx} style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #f3f4f6', padding: '8px 0' }}>
                {item.imageUrl && (
                  <img src={item.imageUrl} alt={item.title} style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 4, background: '#f9fafb', border: '1px solid #eee' }} />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{item.title}</div>
                  <div style={{ fontSize: 13, color: '#666' }}>ASIN: {item.asin}</div>
                  {item.price !== undefined && item.price !== null && (
                    <div style={{ fontSize: 13, color: '#059669', fontWeight: 500 }}>
                      ${item.price.toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && !error && results.length === 0 && (
          <div style={{ color: '#888', fontSize: 14, marginTop: 8 }}>No results yet. Enter a product and search.</div>
        )}
      </div>
    </div>
  );
}

export default Home;