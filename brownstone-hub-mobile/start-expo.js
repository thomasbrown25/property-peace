// Wrapper script to ensure local node_modules resolution
const path = require('path');
const { spawn } = require('child_process');

// Get the directory of this script (mobile app directory)
const appDir = __dirname;

// Set NODE_PATH to prioritize local node_modules
process.env.NODE_PATH = path.join(appDir, 'node_modules') + (process.env.NODE_PATH ? path.delimiter + process.env.NODE_PATH : '');

// Find expo in local node_modules first
const expoPath = require.resolve('expo/bin/cli', { paths: [path.join(appDir, 'node_modules')] });

// Get all arguments except node and script name
const args = process.argv.slice(2);

// Spawn expo with the correct module resolution
const child = spawn('node', [expoPath, ...args], {
  cwd: appDir,
  stdio: 'inherit',
  env: process.env,
  shell: true
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
