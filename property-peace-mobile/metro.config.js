// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Ensure Metro resolves modules from the mobile app's node_modules
// This is critical for monorepo setups where packages might be hoisted
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');
const sharedRoot = path.resolve(monorepoRoot, 'shared');

config.watchFolders = [...new Set([...(config.watchFolders || []), sharedRoot])];

config.resolver = {
  ...config.resolver,
  // Explicitly set node_modules paths
  nodeModulesPaths: [
    path.resolve(projectRoot, 'node_modules'),
  ],
  // Add extra node modules for shared packages
  extraNodeModules: {
    // Ensure react-native resolves from local node_modules
    'react-native': path.resolve(projectRoot, 'node_modules', 'react-native'),
    'react': path.resolve(projectRoot, 'node_modules', 'react'),
    'react-native-svg': path.resolve(projectRoot, 'node_modules', 'react-native-svg'),
  },
  // Enable source extensions for TypeScript files in node_modules
  sourceExts: [...config.resolver.sourceExts, 'ts', 'tsx'],
};

module.exports = config;
