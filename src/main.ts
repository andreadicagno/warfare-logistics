import { Application } from 'pixi.js';
import { Game } from '@game/Game';

async function init() {
  // Create PixiJS application
  const app = new Application();

  await app.init({
    background: '#1a1a2e',
    resizeTo: window,
    antialias: true,
  });

  // Add canvas to DOM
  const container = document.getElementById('game-container');
  if (!container) {
    throw new Error('Game container not found');
  }
  container.appendChild(app.canvas);

  // Initialize game
  const game = new Game(app);
  await game.init();

  console.log('Supply Line initialized');
}

init().catch(console.error);
