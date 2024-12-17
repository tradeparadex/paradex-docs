import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: '../fern/dist',  // Output directory where the bundled JS will be saved
    rollupOptions: {
      input: './init-rum.js',  // Entry point where your custom JS file is located
      output: {
        entryFileNames: `dd-rum.js`,  // Output file where the bundled JS will be saved
        assetFileNames: `dd-rum.[ext]`  // Output file where the bundled JS will be saved
      },
    },
  },
});