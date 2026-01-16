import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
    }),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'shaka-adapter': resolve(__dirname, 'src/shaka-adapter.ts'),
        'videojs-adapter': resolve(__dirname, 'src/videojs-adapter.ts'),
      },
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: ['shaka-player', 'video.js'],
      output: {
        globals: {
          'shaka-player': 'shaka',
          'video.js': 'videojs',
        },
      },
    },
    sourcemap: true,
  },
});
