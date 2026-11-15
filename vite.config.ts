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
      target: 'es2020',
      cssCodeSplit: true,
      assetsInlineLimit: 4096,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('react-dom') || id.includes('/react/')) {
              return 'react-vendor';
            }
            if (id.includes('motion') || id.includes('framer-motion')) {
              return 'motion-vendor';
            }
            if (id.includes('lucide-react')) {
              return 'icons-vendor';
            }
            if (id.includes('qrcode') || id.includes('pngjs')) {
              return 'qr-vendor';
            }
            if (
              id.includes('recharts') ||
              id.includes('d3-') ||
              id.includes('victory-vendor')
            ) {
              return 'charts-vendor';
            }
            return undefined;
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
