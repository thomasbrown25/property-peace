import useSWR from 'swr';
import axiosServices from 'utils/axios';

const endpoints = {
  global: (query, maxResults = 10) => `/api/search/global?query=${encodeURIComponent(query)}&maxResults=${maxResults}`
};

// Custom fetcher for search that handles errors gracefully
const searchFetcher = async (url) => {
  try {
    const response = await axiosServices.get(url);
    return response.data;
  } catch (error) {
    // Return null instead of throwing to prevent SWR from causing issues
    console.error('Search API error:', error);
    return null;
  }
};

export function useGlobalSearch(query, maxResults = 10) {
  const key = query && query.trim().length > 0 ? endpoints.global(query.trim(), maxResults) : null;
  const { data, error, isLoading } = useSWR(key, searchFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 500,
    shouldRetryOnError: false,
    errorRetryCount: 0
  });

  return {
    searchResults: data?.data ?? null,
    searchLoading: isLoading,
    searchError: error
  };
}

export async function performGlobalSearch(query, maxResults = 10) {
  if (!query || query.trim().length === 0) {
    return { data: null };
  }

  const response = await fetcher(endpoints.global(query.trim(), maxResults));
  return response;
}

