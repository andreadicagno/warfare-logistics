import { Game } from '@game/Game';
import { Application } from 'pixi.js';

async function init() {
  const app = new Application();

  await app.init({
    background: '#1a1a2e',
    resizeTo: window,
    antialias: true,
  });

  const container = document.getElementById('game-container');
  if (!container) {
    throw new Error('Game container not found');
  }
  container.appendChild(app.canvas);

  const route = location.hash.replace('#', '') || '/';

  if (route === '/playground') {
    const { PlaygroundPage } = await import('@ui/playground/PlaygroundPage');
    const page = new PlaygroundPage(app);
    await page.init();
    console.log('Playground initialized');
  } else {
    const game = new Game(app);
    await game.init();
    console.log('Supply Line initialized');
  }
}

init().catch(console.error);
