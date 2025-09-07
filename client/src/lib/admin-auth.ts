const ADMIN_TOKEN_KEY = 'admin_token';

export class AdminAuth {
  private static getStoredToken(): string | null {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  }

  private static async validateToken(token: string): Promise<boolean> {
    try {
      // Test the token with a protected admin endpoint
      const response = await fetch('/api/admin/email-logs', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      console.log('[AdminAuth] Token validation response:', response.status);
      return response.ok;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }

  static async login(token: string): Promise<boolean> {
    const isValid = await this.validateToken(token);
    if (isValid) {
      localStorage.setItem(ADMIN_TOKEN_KEY, token);
      return true;
    }
    return false;
  }

  static logout(): void {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
  }

  static async isAuthenticated(): Promise<boolean> {
    const token = this.getStoredToken();
    if (!token) return false;
    return await this.validateToken(token);
  }

  static getToken(): string | null {
    if (typeof window === 'undefined') return null;
    const token = localStorage.getItem(this.TOKEN_KEY) || sessionStorage.getItem(this.TOKEN_KEY);
    console.log('[AdminAuth] Retrieved token:', token ? `${token.substring(0, 8)}...` : 'NONE');
    return token;
  }
}