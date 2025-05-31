import axios from 'axios';

interface SearchResult {
  asin: string;
  title: string;
  price?: string;
  imageUrl?: string;
}

class AmazonAPI {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor() {
    this.apiKey = process.env.AMAZON_API_KEY || '';
    this.baseUrl = process.env.AMAZON_API_URL || 'https://api.rainforestapi.com/request';
  }

  async searchProducts(query: string): Promise<SearchResult[]> {
    if (!this.apiKey) {
      throw new Error('Amazon API key is not configured');
    }

    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          api_key: this.apiKey,
          type: 'search',
          amazon_domain: 'amazon.com',
          search_term: query
        }
      });

      return response.data.search_results.map((result: any) => ({
        asin: result.asin,
        title: result.title,
        price: result.price?.raw,
        imageUrl: result.image
      }));
    } catch (error) {
      console.error('Amazon API error:', error);
      throw error;
    }
  }
}

export const amazonApi = new AmazonAPI(); 