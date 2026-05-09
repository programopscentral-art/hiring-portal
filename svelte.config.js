import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// GitHub Pages serves the site at https://USER.github.io/REPO-NAME/.
// All asset URLs need to be prefixed with /REPO-NAME, otherwise they 404.
// Set BASE_PATH at build time to handle this:
//   BASE_PATH=/hiring-portal npm run build
// The included GitHub Actions workflow does this automatically.
const base = process.env.BASE_PATH || '';

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: '404.html',     // SPA fallback — GH Pages serves this for unknown routes
      precompress: false,
      strict: false
    }),
    paths: { base },
    alias: {
      $lib: 'src/lib'
    }
  }
};
