/**
 * Platform-agnostic API Client
 * Works for both web (React) and mobile (React Native)
 */
class ApiClient {
  constructor(config) {
    this.baseURL = config.baseURL;
    this.getToken = config.getToken; // Function that returns token
    this.getOrganizationId = config.getOrganizationId; // Function that returns org ID
    this.onTokenExpired = config.onTokenExpired; // Callback for expired tokens
    this.httpClient = config.httpClient; // axios instance or fetch wrapper
  }

  /**
   * Check if endpoint is public (doesn't require auth)
   */
  isAuthEndpoint(url) {
    return url?.includes('/api/user/login') || 
           url?.includes('/api/user/register') ||
           url?.includes('/api/user/forgot-password') ||
           url?.includes('/api/user/reset-password') ||
           url?.includes('/api/user/google-login') ||
           url?.includes('/api/user/google-user-info') ||
           url?.includes('/api/user/check-email') ||
           url?.includes('/api/demo-requests');
  }

  /**
   * Check if token is expired
   */
  async isTokenExpired(token) {
    if (!token) return true;
    try {
      // Dynamic import for jwt-decode (works in both web and mobile)
      const { jwtDecode } = await import('jwt-decode');
      const decoded = jwtDecode(token);
      return decoded.exp < Date.now() / 1000;
    } catch (e) {
      return true;
    }
  }

  /**
   * Make HTTP request
   */
  async request(method, url, data = null, options = {}) {
    const token = await this.getToken();
    const orgId = await this.getOrganizationId();
    const isAuthEndpoint = this.isAuthEndpoint(url);

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    // Add auth token if available and not auth endpoint
    if (token && !isAuthEndpoint) {
      const expired = await this.isTokenExpired(token);
      if (expired) {
        this.onTokenExpired?.();
        throw new Error('Token expired');
      }
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Add organization header if available
    if (orgId && !isAuthEndpoint) {
      headers['X-Organization-Id'] = orgId.toString();
    }

    try {
      // Normalize URL to avoid double slashes
      const baseURL = this.baseURL.endsWith('/') ? this.baseURL.slice(0, -1) : this.baseURL;
      const normalizedUrl = url.startsWith('/') ? url : `/${url}`;
      const fullUrl = `${baseURL}${normalizedUrl}`;
      
      const config = {
        method,
        url: fullUrl,
        headers
      };

      if (data) {
        if (data instanceof FormData) {
          // For file uploads, let browser set Content-Type
          delete headers['Content-Type'];
          config.data = data;
        } else {
          config.data = data;
        }
      }

      const response = await this.httpClient(config);
      return response.data || response;
    } catch (error) {
      // Handle 401 errors
      if (error.response?.status === 401 && !isAuthEndpoint) {
        const isSubscriptionEndpoint = url?.includes('/api/subscription');
        if (!isSubscriptionEndpoint) {
          this.onTokenExpired?.();
        }
      }

      // Return detailed error
      const errorData = error.response?.data || {
        message: error.message || 'Request failed',
        status: error.response?.status,
        statusText: error.response?.statusText
      };

      throw errorData;
    }
  }

  async streamNdjson(url, data, { signal, onEvent } = {}) {
    const token = await this.getToken();
    const orgId = await this.getOrganizationId();
    const headers = { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' };

    if (token) {
      const expired = await this.isTokenExpired(token);
      if (expired) {
        this.onTokenExpired?.();
        throw new Error('Token expired');
      }
      headers.Authorization = `Bearer ${token}`;
    }
    if (orgId) headers['X-Organization-Id'] = orgId.toString();

    const baseURL = this.baseURL.endsWith('/') ? this.baseURL.slice(0, -1) : this.baseURL;
    const normalizedUrl = url.startsWith('/') ? url : `/${url}`;
    const response = await fetch(`${baseURL}${normalizedUrl}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
      credentials: 'include',
      signal
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: `Request failed (${response.status})`, status: response.status };
      }
      if (response.status === 401) this.onTokenExpired?.();
      throw errorData;
    }
    if (!response.body) throw new Error('Streaming responses are not supported in this browser.');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) onEvent?.(JSON.parse(trimmed));
      }
      if (done) break;
    }
    if (buffer.trim()) onEvent?.(JSON.parse(buffer.trim()));
  }

  get(url, options) {
    return this.request('GET', url, null, options);
  }

  post(url, data, options) {
    return this.request('POST', url, data, options);
  }

  put(url, data, options) {
    return this.request('PUT', url, data, options);
  }

  delete(url, options) {
    return this.request('DELETE', url, null, options);
  }

  patch(url, data, options) {
    return this.request('PATCH', url, data, options);
  }
}

export default ApiClient;
