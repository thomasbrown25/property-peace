/**
 * Instructional Videos Configuration
 * 
 * Add your YouTube video IDs here.
 * To get the video ID: 
 * - Go to your YouTube video
 * - Copy the ID from the URL: youtube.com/watch?v=VIDEO_ID
 * 
 * Example: If URL is https://www.youtube.com/watch?v=dQw4w9WgXcQ
 * Then videoId is: dQw4w9WgXcQ
 */

export const INSTRUCTIONAL_VIDEOS = {
  // Onboarding
  onboarding: {
    id: 'tuHorLOkYbY', // YouTube video ID from https://youtu.be/tuHorLOkYbY
    title: 'Welcome to Property Peace - Getting Started',
    description: 'Learn the basics of Property Peace and get started managing your properties.',
    category: 'onboarding',
    tags: ['onboarding', 'welcome', 'getting started', 'tutorial', 'introduction']
  },

  // Setup & Account
  addUser: {
    id: 'f_EZsUSAATs', // YouTube video ID from https://youtu.be/f_EZsUSAATs
    title: 'How to add a user to your account',
    description: 'Learn how to add team members and manage user access to your account.',
    category: 'setup',
    tags: ['user', 'team', 'account', 'setup']
  },

  connectBankAccount: {
    id: 'LjhhCPINTJ0', // YouTube video ID from https://youtu.be/LjhhCPINTJ0
    title: 'How to connect bank account to receive payments',
    description: 'Set up your bank account to start receiving rent payments from tenants.',
    category: 'payments',
    tags: ['bank', 'payments', 'setup', 'stripe']
  },

  // Core Features
  createProperty: {
    id: 'I6JkZ80BIag', // YouTube video ID from https://youtu.be/I6JkZ80BIag
    title: 'How to create a property',
    description: 'Add a new property to your portfolio with detailed information and photos.',
    category: 'properties',
    tags: ['property', 'create', 'add', 'portfolio']
  },

  createLease: {
    id: 'i2WdV6McNcE', // YouTube video ID from https://youtu.be/i2WdV6McNcE
    title: 'How to create a lease',
    description: 'Create and manage lease agreements for your properties.',
    category: 'leases',
    tags: ['lease', 'create', 'agreement', 'contract']
  },

  // Communication & Management
  messageTenant: {
    id: 'ed6CZdrdLzU', // YouTube video ID from https://youtu.be/ed6CZdrdLzU
    title: 'How to message a tenant',
    description: 'Communicate with your tenants through the messaging system.',
    category: 'communication',
    tags: ['message', 'tenant', 'communication', 'chat']
  },

  sendApplication: {
    id: 'rk5Q72ugj7w', // YouTube video ID from https://youtu.be/rk5Q72ugj7w
    title: 'How to send application to tenant',
    description: 'Send rental applications to potential tenants for property listings.',
    category: 'applications',
    tags: ['application', 'tenant', 'send', 'rental']
  },

  uploadMoveInPhotos: {
    id: 'QPBsIMG1yso', // YouTube video ID from https://youtu.be/QPBsIMG1yso
    title: 'How to upload before move-in photos',
    description: 'Document property condition with photos before tenant move-in.',
    category: 'documentation',
    tags: ['photos', 'move-in', 'documentation', 'property condition']
  }
};

// Video categories for filtering
export const VIDEO_CATEGORIES = {
  onboarding: 'Onboarding',
  setup: 'Setup & Account',
  properties: 'Properties',
  leases: 'Leases',
  payments: 'Payments',
  communication: 'Communication',
  applications: 'Applications',
  documentation: 'Documentation'
};

// Get video by key
export const getVideo = (key) => {
  return INSTRUCTIONAL_VIDEOS[key] || null;
};

// Get videos by category
export const getVideosByCategory = (category) => {
  return Object.entries(INSTRUCTIONAL_VIDEOS)
    .filter(([_, video]) => video.category === category)
    .map(([key, video]) => ({ key, ...video }));
};

// Get all videos as array
export const getAllVideos = () => {
  return Object.entries(INSTRUCTIONAL_VIDEOS)
    .map(([key, video]) => ({ key, ...video }));
};

// Video mapping for contextual help on specific pages
export const PAGE_VIDEOS = {
  '/landlord/properties/add': 'createProperty',
  '/landlord/property-add': 'createProperty',
  '/landlord/leases/add': 'createLease',
  '/landlord/lease-add': 'createLease',
  '/landlord/properties': 'createProperty',
  '/landlord/leases': 'createLease',
  '/landlord/settings': 'addUser',
  '/landlord/messages': 'messageTenant'
};

// Get relevant video for a page
export const getVideoForPage = (pathname) => {
  // Try exact match first
  if (PAGE_VIDEOS[pathname]) {
    return getVideo(PAGE_VIDEOS[pathname]);
  }
  
  // Try partial match (e.g., /landlord/properties/123 matches /landlord/properties)
  for (const [pagePath, videoKey] of Object.entries(PAGE_VIDEOS)) {
    if (pathname.startsWith(pagePath)) {
      return getVideo(videoKey);
    }
  }
  
  return null;
};
