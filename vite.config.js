import { defineConfig } from 'vite';

export default defineConfig({
  base: '/Vlindertuin_3D/', // GitHub Pages subdirectory path
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  },
  assetsInclude: ['**/*.glb', '**/*.gltf']
});

