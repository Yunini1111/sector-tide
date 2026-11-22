import { defineConfig } from 'vite';

// Relative base so the same build works locally and under /<repo>/ on GitHub Pages.
export default defineConfig({ base: './' });
