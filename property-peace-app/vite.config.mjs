import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import jsconfigPaths from 'vite-jsconfig-paths';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Base path should be '/' for root domain or the subdirectory path
  // For Azure Static Web Apps, typically use '/' unless deploying to a subdirectory
  // Handle empty string, undefined, null, or '/' - all should default to '/'
  const baseName = env.VITE_APP_BASE_NAME?.trim();
  const BASE_PATH = baseName && baseName !== '' && baseName !== '/' ? baseName : '/';
  const PORT = 3000;

  return {
    base: BASE_PATH,
    server: {
      open: true,
      port: PORT,
      host: true,
      // Allow OAuth popup to communicate with opener (postMessage, window.closed)
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups'
      }
    },
    preview: {
      open: true,
      host: true,
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups'
      }
    },
    define: {
      global: 'window' // Only if you need it for legacy packages
    },
    resolve: {
      alias: {
        '@ant-design/icons': path.resolve(__dirname, 'node_modules/@ant-design/icons'),
        '@property-peace/shared': path.resolve(__dirname, '../shared')
      }
    },
    plugins: [react(), jsconfigPaths()],
    build: {
      chunkSizeWarningLimit: 1000,
      sourcemap: true,
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          chunkFileNames: 'js/[name]-[hash].js',
          entryFileNames: 'js/[name]-[hash].js',
          assetFileNames: (assetInfo) => {
            const name = assetInfo.name || '';
            const ext = name.split('.').pop();
            if (/\.css$/.test(name)) return `css/[name]-[hash].${ext}`;
            if (/\.(png|jpe?g|gif|svg|webp|ico)$/.test(name)) return `images/[name]-[hash].${ext}`;
            if (/\.(woff2?|eot|ttf|otf)$/.test(name)) return `fonts/[name]-[hash].${ext}`;
            return `assets/[name]-[hash].${ext}`;
          },
          // Ensure chunks use absolute paths from base
          format: 'es'
          // manualChunks: { ... } // Add if you want custom chunk splitting
        }
      },
      // Only drop console/debugger in production
      ...(mode === 'production' && {
        esbuild: {
          drop: ['console', 'debugger'],
          pure: ['console.log', 'console.info', 'console.debug', 'console.warn']
        }
      })
      // No need to set build.target unless you need to support older browsers
      // target: 'baseline-widely-available', // This is now the default
    },
    optimizeDeps: {
      include: [
        '@mui/material/Tooltip',
        '@mui/x-date-pickers',
        '@mui/x-date-pickers/DatePicker',
        '@mui/x-date-pickers/AdapterDateFns',
        '@ant-design/icons',
        'react',
        'react-dom',
        'react-router-dom',
        'ua-parser-js',
        'react-device-detect'
      ]
    },
    commonjsOptions: {
      include: [/ua-parser-js/, /react-device-detect/],
      transformMixedEsModules: true
    }
  };
});
