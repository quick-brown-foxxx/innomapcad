import path from 'node:path';

import { build } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { defineConfig } from 'vitest/config';

import type { Plugin } from 'vite';

/**
 * Vite plugin that builds injected.ts as a separate IIFE bundle
 * after the main build completes. This is necessary because Rollup
 * does not support multiple IIFE entry points with inlineDynamicImports.
 */
function buildInjectedScript(): Plugin {
  return {
    name: 'build-injected-script',
    closeBundle: async () => {
      await build({
        configFile: false,
        build: {
          outDir: 'dist',
          emptyOutDir: false,
          rollupOptions: {
            input: {
              injected: path.resolve(__dirname, 'src/bridge/injected.ts'),
            },
            output: {
              entryFileNames: '[name].js',
              format: 'iife',
              inlineDynamicImports: true,
            },
          },
        },
      });
    },
  };
}

/**
 * Vite plugin that builds the background service worker as a separate IIFE
 * bundle. The service worker proxies fetch requests from content scripts to
 * localhost, bypassing Chrome's Private Network Access restrictions.
 */
function buildServiceWorker(): Plugin {
  return {
    name: 'build-service-worker',
    closeBundle: async () => {
      await build({
        configFile: false,
        build: {
          outDir: 'dist',
          emptyOutDir: false,
          rollupOptions: {
            input: {
              'service-worker': path.resolve(
                __dirname,
                'src/background/service-worker.ts',
              ),
            },
            output: {
              entryFileNames: '[name].js',
              format: 'iife',
              inlineDynamicImports: true,
            },
          },
        },
      });
    },
  };
}

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        content: path.resolve(__dirname, 'src/content.tsx'),
      },
      output: {
        entryFileNames: '[name].js',
        format: 'iife',
        inlineDynamicImports: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: 'manifest.json',
          dest: '.',
        },
      ],
    }),
    buildInjectedScript(),
    buildServiceWorker(),
  ],
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    passWithNoTests: true,
  },
});
