import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'optional-jspdf-deps-fallback',
        enforce: 'pre',
        async resolveId(source, importer, options) {
          if (
            (source === 'canvg' || source === 'dompurify') &&
            importer &&
            importer.includes('jspdf')
          ) {
            const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
            if (resolved) return resolved;
            return `\0virtual:optional-${source}`;
          }
          return null;
        },
        load(id) {
          if (id === '\0virtual:optional-canvg' || id === '\0virtual:optional-dompurify') {
            return 'export default {}; export const Canvg = undefined;';
          }
          return null;
        },
      },
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'artifacts/pos-system/src'),
        '@workspace/api-client-react': path.resolve(__dirname, 'artifacts/pos-system/src/lib/api-client-react.tsx'),
        '@assets': path.resolve(__dirname, 'attached_assets'),
      },
    },
    optimizeDeps: {
      entries: ['index.html', 'artifacts/pos-system/src/main.tsx'],
      esbuildOptions: {
        plugins: [
          {
            name: 'esbuild-optional-jspdf-deps',
            setup(build) {
              build.onResolve({filter: /^(canvg|dompurify)$/}, (args) => {
                if (args.importer && args.importer.toLowerCase().includes('jspdf')) {
                  const candidate = path.resolve(__dirname, 'node_modules', args.path, 'package.json');
                  const nestedCandidate = path.resolve(
                    path.dirname(args.importer),
                    '..',
                    'node_modules',
                    args.path,
                    'package.json',
                  );
                  if (!fs.existsSync(candidate) && !fs.existsSync(nestedCandidate)) {
                    return {path: args.path, namespace: 'optional-jspdf-stub'};
                  }
                }
                return undefined;
              });
              build.onLoad({filter: /.*/, namespace: 'optional-jspdf-stub'}, () => ({
                contents: 'export default {}; export const Canvg = undefined;',
                loader: 'js',
              }));
            },
          },
        ],
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
