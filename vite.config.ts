import tailwindcss from '@tailwindcss/postcss';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === 'seatbelt';

// Keep the GitHub Pages build portable and make direct file previews work for
// non-technical handoff: the final HTML contains its generated CSS and JS.
function singleFileBuild(): Plugin {
  return {
    name: 'life-os-single-file',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const htmlAsset = bundle['index.html'];
      if (!htmlAsset || htmlAsset.type !== 'asset' || typeof htmlAsset.source !== 'string') return;
      let html = htmlAsset.source;
      for (const [fileName, item] of Object.entries(bundle)) {
        if (item.type === 'chunk' && item.isEntry) {
          const escapedCode = item.code.replaceAll('</script', '<\\/script');
          html = html.replace(
            new RegExp(`<script[^>]+src=["']\\.?/?${fileName.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}["'][^>]*></script>`),
            () => `<script type="module">${escapedCode}</script>`,
          );
          delete bundle[fileName];
        }
        if (item.type === 'asset' && fileName.endsWith('.css')) {
          const compiledCss = typeof item.source === 'string' ? item.source : new TextDecoder().decode(item.source);
          // CSS normally lives in an assets folder. Once it is inlined into index.html,
          // public-file URLs need to be relative to the page instead.
          const css = compiledCss.replaceAll('url(../life-os-background.svg)', 'url(./life-os-background.svg)');
          html = html.replace(
            new RegExp(`<link[^>]+href=["']\\.?/?${fileName.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}["'][^>]*>`),
            () => `<style>${css}</style>`,
          );
          delete bundle[fileName];
        }
      }
      htmlAsset.source = html;
    },
  };
}

export default defineConfig(() => {
  return {
    base: './',
    css: { postcss: { plugins: [tailwindcss()] } },
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [react(), singleFileBuild()],
    resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  };
});
