// Script to remove only metro-react-native-babel-preset from root
// Keep metro, expo, @expo/cli, and @expo/metro in root - they're needed for Expo CLI to work
const fs = require('fs');
const path = require('path');

const rootNodeModules = path.join(__dirname, '..', 'node_modules');
const metroBabelPresetPath = path.join(rootNodeModules, 'metro-react-native-babel-preset');
// Keep metro, @expo/cli, @expo/metro, and expo in root - they're needed

function removeIfExists(dirPath) {
  if (fs.existsSync(dirPath)) {
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
      console.log(`Removed ${path.basename(dirPath)} from root node_modules`);
    } catch (error) {
      console.warn(`Warning: Could not remove ${path.basename(dirPath)}:`, error.message);
    }
  }
}

// Only remove metro-react-native-babel-preset, keep everything else
removeIfExists(metroBabelPresetPath);
// Keep metro, expo, @expo/cli, and @expo/metro in root for Expo CLI resolution
