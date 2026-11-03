import '@fontsource-variable/fredoka';
import './ui/styles.css';
import { GameApp } from './app/GameApp';
import { safeStorage } from './storage/repository';
import { WorldView } from './render/world';

const root = document.getElementById('app');
if (!root) throw new Error('SkyHop: missing #app root element');

const app = new GameApp(root, {
  createWorld: (container, handlers) => new WorldView(container, handlers),
  storage: safeStorage(),
  prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  devicePixelRatio: window.devicePixelRatio,
  vibrate: (pattern) => navigator.vibrate?.(pattern),
});
app.start();

if (import.meta.env.DEV) {
  (window as unknown as { __skyhop: GameApp }).__skyhop = app;
}
