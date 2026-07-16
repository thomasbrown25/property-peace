import { apiClient } from 'api';

// For SWR compatibility
export const fetcher = (url) => {
  return apiClient.get(url);
};

export const fetcherPost = (url, argOrOpts) => {
  const body = argOrOpts && typeof argOrOpts === 'object' && 'arg' in argOrOpts
    ? argOrOpts.arg
    : (argOrOpts ?? {});
  return apiClient.post(url, body);
};
