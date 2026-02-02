import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import obfuscatorPlugin from 'rollup-plugin-obfuscator';

// Configuration de l'obfuscation (uniquement quand OBFUSCATE=true)
const shouldObfuscate = process.env.OBFUSCATE === 'true';
console.log(`[Build] Obfuscation: ${shouldObfuscate ? 'ENABLED' : 'disabled'}`);

const obfuscatorOptions = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal' as const,
  log: false,
  numbersToExpressions: true,
  renameGlobals: false,
  selfDefending: true,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 10,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayCallsTransformThreshold: 0.75,
  stringArrayEncoding: ['base64'] as ('none' | 'base64' | 'rc4')[],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 2,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 4,
  stringArrayWrappersType: 'function' as const,
  stringArrayThreshold: 0.75,
  transformObjectKeys: true,
  unicodeEscapeSequence: false,
};

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin(),
      // Obfuscation du code main (licence, etc.) en production
      ...(shouldObfuscate
        ? [
            obfuscatorPlugin({
              options: {
                ...obfuscatorOptions,
                // Options spécifiques pour le main process
                reservedNames: ['^machineIdSync$', '^electron$'],
              },
            }),
          ]
        : []),
    ],
    build: {
      minify: shouldObfuscate ? 'terser' : false,
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/main.ts'),
        },
      },
    },
  },
  preload: {
    plugins: [
      externalizeDepsPlugin(),
      ...(shouldObfuscate
        ? [
            obfuscatorPlugin({
              options: {
                ...obfuscatorOptions,
                // Options moins agressives pour le preload
                controlFlowFlattening: false,
                deadCodeInjection: false,
              },
            }),
          ]
        : []),
    ],
    build: {
      minify: shouldObfuscate ? 'terser' : false,
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/preload.ts'),
        },
      },
    },
  },
  renderer: {
    root: '.',
    build: {
      outDir: 'dist-react',
      minify: shouldObfuscate ? 'terser' : false,
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'index.html'),
        },
        output: {
          manualChunks: undefined,
        },
        plugins: [
          // Obfuscation du renderer (validation côté client)
          ...(shouldObfuscate
            ? [
                obfuscatorPlugin({
                  options: {
                    ...obfuscatorOptions,
                    // Options pour le renderer
                    selfDefending: false, // Peut causer des problèmes avec React
                  },
                }),
              ]
            : []),
        ],
      },
      target: 'es2015',
    },
    plugins: [react()],
    base: './',
    server: {
      fs: {
        allow: ['..'],
      },
    },
  },
});
