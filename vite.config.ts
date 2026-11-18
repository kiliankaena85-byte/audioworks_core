import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {ensureWebpSiblingsInDirs} from './scripts/generate-webp.mjs';

function webpAssetGeneratorPlugin() {
  return {
    name: 'fmworks-webp-generator',
    buildStart() {
      ensureWebpSiblingsInDirs([
        path.resolve(__dirname, 'src', 'assets', 'images'),
        path.resolve(__dirname, 'public', 'assets', 'cms'),
      ]);
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), webpAssetGeneratorPlugin()],
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      sourcemap: false,
      target: 'es2022',
      cssCodeSplit: true,
      assetsInlineLimit: 4096,
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'react-vendor',
                priority: 40,
                test: /[\\/]node_modules[\\/](react|react-dom|scheduler|react-is|@babel[\\/]runtime)[\\/]/,
              },
              {
                name: 'motion-vendor',
                priority: 30,
                test: /[\\/]node_modules[\\/](motion|framer-motion)[\\/]/,
              },
              {
                name: 'icons-vendor',
                priority: 25,
                test: /[\\/]node_modules[\\/]lucide-react[\\/]/,
              },
              {
                name: 'qr-vendor',
                priority: 25,
                test: /[\\/]node_modules[\\/](qrcode|pngjs)[\\/]/,
              },
              {
                name: 'charts-vendor',
                priority: 20,
                test: /[\\/]node_modules[\\/](recharts|d3-[^\\/]+|victory-vendor|react-redux)[\\/]/,
              },
              {
                name: 'studio-legal-core',
                priority: 15,
                test: /[\\/]src[\\/](data[\\/]studioDocumentsCore|security[\\/]legalDocumentBuilder|context[\\/]StudioLegalConfigContext)\.tsx?$/,
              },
            ],
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
