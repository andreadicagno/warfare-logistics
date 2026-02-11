import { Application, Graphics, Text, TextStyle } from 'pixi.js';

/**
 * Main game class - orchestrates all game systems
 */
export class Game {
  private app: Application;
  private isPaused: boolean = false;

  constructor(app: Application) {
    this.app = app;
  }

  async init(): Promise<void> {
    // Placeholder: draw a simple test screen
    this.drawTestScreen();

    // Set up game loop
    this.app.ticker.add(this.update.bind(this));

    // Set up keyboard controls
    this.setupControls();
  }

  private drawTestScreen(): void {
    // Background grid (placeholder for map)
    const grid = new Graphics();
    grid.fill({ color: 0x16213e });
    grid.rect(0, 0, this.app.screen.width, this.app.screen.height);
    grid.fill();

    // Draw grid lines
    grid.stroke({ width: 1, color: 0x1a1a2e });
    const gridSize = 50;
    for (let x = 0; x < this.app.screen.width; x += gridSize) {
      grid.moveTo(x, 0);
      grid.lineTo(x, this.app.screen.height);
    }
    for (let y = 0; y < this.app.screen.height; y += gridSize) {
      grid.moveTo(0, y);
      grid.lineTo(this.app.screen.width, y);
    }
    grid.stroke();

    this.app.stage.addChild(grid);

    // Title text
    const titleStyle = new TextStyle({
      fontFamily: 'Arial',
      fontSize: 48,
      fontWeight: 'bold',
      fill: '#e8e8e8',
    });
    const title = new Text({ text: 'SUPPLY LINE', style: titleStyle });
    title.anchor.set(0.5);
    title.x = this.app.screen.width / 2;
    title.y = 80;
    this.app.stage.addChild(title);

    // Subtitle
    const subtitleStyle = new TextStyle({
      fontFamily: 'Arial',
      fontSize: 18,
      fill: '#888888',
    });
    const subtitle = new Text({
      text: 'Logistics Strategy Game - MVP Setup Complete',
      style: subtitleStyle
    });
    subtitle.anchor.set(0.5);
    subtitle.x = this.app.screen.width / 2;
    subtitle.y = 130;
    this.app.stage.addChild(subtitle);

    // Instructions
    const instructionsStyle = new TextStyle({
      fontFamily: 'Arial',
      fontSize: 14,
      fill: '#666666',
    });
    const instructions = new Text({
      text: 'Press SPACE to pause/unpause',
      style: instructionsStyle
    });
    instructions.anchor.set(0.5);
    instructions.x = this.app.screen.width / 2;
    instructions.y = this.app.screen.height - 30;
    this.app.stage.addChild(instructions);

    // Placeholder boxes for future UI elements
    this.drawPlaceholderBox(50, 200, 300, 400, 'MAP AREA', 0x0f3460);
    this.drawPlaceholderBox(this.app.screen.width - 350, 200, 300, 400, 'DETAILS PANEL', 0x0f3460);
    this.drawPlaceholderBox(50, this.app.screen.height - 150, this.app.screen.width - 100, 100, 'NOTIFICATIONS / LOG', 0x0f3460);
  }

  private drawPlaceholderBox(x: number, y: number, width: number, height: number, label: string, color: number): void {
    const box = new Graphics();
    box.fill({ color, alpha: 0.5 });
    box.roundRect(x, y, width, height, 8);
    box.fill();
    box.stroke({ width: 2, color: 0x1a1a2e });
    box.roundRect(x, y, width, height, 8);
    box.stroke();
    this.app.stage.addChild(box);

    const labelStyle = new TextStyle({
      fontFamily: 'Arial',
      fontSize: 12,
      fill: '#666666',
    });
    const text = new Text({ text: label, style: labelStyle });
    text.anchor.set(0.5);
    text.x = x + width / 2;
    text.y = y + height / 2;
    this.app.stage.addChild(text);
  }

  private setupControls(): void {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        this.togglePause();
      }
    });
  }

  private togglePause(): void {
    this.isPaused = !this.isPaused;
    console.log(this.isPaused ? 'Game paused' : 'Game resumed');
  }

  private update(_ticker: { deltaTime: number }): void {
    if (this.isPaused) return;

    // Game update logic will go here
    // const delta = ticker.deltaTime;
  }
}
