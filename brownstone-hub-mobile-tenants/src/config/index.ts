// Use try-catch to handle expo-constants gracefully
let Constants: any = null;
try {
  Constants = require('expo-constants');
} catch (e) {
  // expo-constants not available, will use defaults
  console.warn('expo-constants not available, using default config');
}

const ENV = {
  dev: {
    API_URL: process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.245:5001/',
    SIGNALR_URL: process.env.EXPO_PUBLIC_SIGNALR_URL || 'http://192.168.1.245:5001/notificationHub',
  },
  staging: {
    API_URL: 'https://api-staging.brownstonehub.com/',
    SIGNALR_URL: 'https://api-staging.brownstonehub.com/notificationHub',
  },
  prod: {
    API_URL: 'https://api.brownstonehub.com/',
    SIGNALR_URL: 'https://api.brownstonehub.com/notificationHub',
  },
};

const getEnvVars = () => {
  // Always use dev in development
  if (__DEV__) {
    return ENV.dev;
  }
  
  // Try to get release channel from expo-constants if available
  if (Constants?.expoConfig?.extra?.releaseChannel) {
    const releaseChannel = Constants.expoConfig.extra.releaseChannel;
    if (releaseChannel === 'staging') {
      return ENV.staging;
    }
  }
  
  return ENV.prod;
};

// Function to fetch Google Client ID from backend
let cachedGoogleClientId: string | null = null;
let fetchPromise: Promise<string | null> | null = null;

// Function to fetch Stripe Publishable Key from backend
let cachedStripePublishableKey: string | null = null;
let fetchStripeKeyPromise: Promise<string | null> | null = null;

const fetchGoogleClientId = async (): Promise<string | null> => {
  // Return cached value if available
  if (cachedGoogleClientId) {
    return cachedGoogleClientId;
  }

  // Return existing promise if already fetching
  if (fetchPromise) {
    return fetchPromise;
  }

  // Create new fetch promise
  fetchPromise = (async () => {
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || getEnvVars().API_URL;
      const fullUrl = `${apiUrl}api/config/public`;
      
      console.log('🔵 Attempting to fetch from:', fullUrl);
      
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout after 5 seconds')), 5000);
      });
      
      // Race between fetch and timeout
      const response = await Promise.race([
        fetch(fullUrl),
        timeoutPromise,
      ]);
      
      if (!response.ok) {
        console.warn('⚠️ Backend returned non-OK status:', response.status);
        return null;
      }

      const data = await response.json();
      cachedGoogleClientId = data.googleClientId || null;
      
      if (cachedGoogleClientId) {
        console.log('✅ Google Client ID fetched from backend:', cachedGoogleClientId.substring(0, 30) + '...');
      } else {
        console.warn('⚠️ Backend returned empty Google Client ID');
      }
      
      return cachedGoogleClientId;
    } catch (error: any) {
      console.warn('❌ Error fetching Google Client ID from backend:', error?.message || error);
      console.warn('⚠️ Make sure your backend API is running and accessible at:', process.env.EXPO_PUBLIC_API_URL || getEnvVars().API_URL);
      return null;
    } finally {
      fetchPromise = null;
    }
  })();

  return fetchPromise;
};

const fetchStripePublishableKey = async (): Promise<string | null> => {
  // Return cached value if available
  if (cachedStripePublishableKey) {
    return cachedStripePublishableKey;
  }

  // Return existing promise if already fetching
  if (fetchStripeKeyPromise) {
    return fetchStripeKeyPromise;
  }

  // Create new fetch promise
  fetchStripeKeyPromise = (async () => {
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || getEnvVars().API_URL;
      const fullUrl = `${apiUrl}api/stripe/publishable-key`;
      
      console.log('🔵 Attempting to fetch Stripe publishable key from:', fullUrl);
      
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout after 5 seconds')), 5000);
      });
      
      // Race between fetch and timeout
      const response = await Promise.race([
        fetch(fullUrl),
        timeoutPromise,
      ]);
      
      if (!response.ok) {
        console.warn('⚠️ Backend returned non-OK status for Stripe key:', response.status);
        return null;
      }

      const data = await response.json();
      cachedStripePublishableKey = data.publishableKey || null;
      
      if (cachedStripePublishableKey) {
        console.log('✅ Stripe publishable key fetched from backend:', cachedStripePublishableKey.substring(0, 30) + '...');
      } else {
        console.warn('⚠️ Backend returned empty Stripe publishable key');
      }
      
      return cachedStripePublishableKey;
    } catch (error: any) {
      console.warn('❌ Error fetching Stripe publishable key from backend:', error?.message || error);
      console.warn('⚠️ Make sure your backend API is running and accessible at:', process.env.EXPO_PUBLIC_API_URL || getEnvVars().API_URL);
      return null;
    } finally {
      fetchStripeKeyPromise = null;
    }
  })();

  return fetchStripeKeyPromise;
};

const config = {
  API_URL: process.env.EXPO_PUBLIC_API_URL || getEnvVars().API_URL,
  SIGNALR_URL: process.env.EXPO_PUBLIC_SIGNALR_URL || getEnvVars().SIGNALR_URL,
  // Google Client ID - prefer backend, fallback to env if not placeholder
  get GOOGLE_CLIENT_ID(): string | null {
    // Check if env value is a placeholder (common placeholders)
    const envValue = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '';
    const isPlaceholder = envValue.includes('your-google-client-id') || 
                         envValue.includes('placeholder') ||
                         envValue.trim() === '';
    
    // Use env value only if it's not a placeholder
    if (envValue && !isPlaceholder) {
      return envValue;
    }
    
    // Otherwise return cached value from backend (will be set after initializeGoogleClientId is called)
    return cachedGoogleClientId;
  },
  // Async function to initialize Google Client ID from backend
  async initializeGoogleClientId(): Promise<void> {
    // Check if env value is a placeholder
    const envValue = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '';
    const isPlaceholder = envValue.includes('your-google-client-id') || 
                         envValue.includes('placeholder') ||
                         envValue.trim() === '';
    
    // Fetch from backend if not cached and (env is placeholder or not set)
    if (!cachedGoogleClientId && (!envValue || isPlaceholder)) {
      console.log('🔵 Fetching Google Client ID from backend...');
      const fetchedId = await fetchGoogleClientId();
      if (fetchedId) {
        console.log('✅ Google Client ID fetched from backend:', fetchedId.substring(0, 30) + '...');
      } else {
        console.warn('⚠️ Failed to fetch Google Client ID from backend');
      }
    }
  },
  // Stripe Publishable Key - prefer backend, fallback to env if not placeholder
  get STRIPE_PUBLISHABLE_KEY(): string | null {
    // Check if env value is a placeholder
    const envValue = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
    const isPlaceholder = envValue.includes('your-stripe-publishable-key') || 
                         envValue.includes('placeholder') ||
                         envValue.trim() === '';
    
    // Use env value only if it's not a placeholder
    if (envValue && !isPlaceholder) {
      return envValue;
    }
    
    // Otherwise return cached value from backend (will be set after initializeStripePublishableKey is called)
    return cachedStripePublishableKey;
  },
  // Async function to initialize Stripe Publishable Key from backend
  async initializeStripePublishableKey(): Promise<void> {
    // Check if env value is a placeholder
    const envValue = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
    const isPlaceholder = envValue.includes('your-stripe-publishable-key') || 
                         envValue.includes('placeholder') ||
                         envValue.trim() === '';
    
    // Fetch from backend if not cached and (env is placeholder or not set)
    if (!cachedStripePublishableKey && (!envValue || isPlaceholder)) {
      console.log('🔵 Fetching Stripe publishable key from backend...');
      const fetchedKey = await fetchStripePublishableKey();
      if (fetchedKey) {
        console.log('✅ Stripe publishable key fetched from backend:', fetchedKey.substring(0, 30) + '...');
      } else {
        console.warn('⚠️ Failed to fetch Stripe publishable key from backend');
      }
    }
  },
};

export default config;
