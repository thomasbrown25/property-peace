import ApiClient from './client.js';

export class SearchAPI {
  constructor(apiClient) {
    this.client = apiClient;
  }

  async performGlobalSearch(query, maxResults = 10) {
    if (!query || query.trim().length === 0) {
      return { data: null };
    }

    try {
      const url = `/api/search/global?query=${encodeURIComponent(query.trim())}&maxResults=${maxResults}`;
      return await this.client.get(url);
    } catch (error) {
      console.error('Search API error:', error);
      return null;
    }
  }
}

export default SearchAPI;
