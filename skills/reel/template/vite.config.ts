import {defineConfig} from 'vite';
import mcPlugin from '@motion-canvas/vite-plugin';

// The plugin ships as CommonJS, so its default export can arrive wrapped.
const motionCanvas = (mcPlugin as unknown as {default?: typeof mcPlugin}).default ?? mcPlugin;

export default defineConfig({
  plugins: [motionCanvas()],
});
