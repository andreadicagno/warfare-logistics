import { TICKS_PER_DAY } from '@core/simulation/types';

export type TimeAction = 'step' | 'play' | 'pause';
export type TimeSpeed = 1 | 2 | 4;

export class TimeControls {
  private container: HTMLDivElement;
  private tickDisplay: HTMLSpanElement;
  private playPauseBtn: HTMLButtonElement;
  private speedBtns: Map<TimeSpeed, HTMLButtonElement> = new Map();
  private _isPlaying = false;
  private _speed: TimeSpeed = 1;
  private onAction: (action: TimeAction) => void;
  private onSpeedChange: (speed: TimeSpeed) => void;

  constructor(
    parent: HTMLElement,
    onAction: (action: TimeAction) => void,
    onSpeedChange: (speed: TimeSpeed) => void,
  ) {
    this.onAction = onAction;
    this.onSpeedChange = onSpeedChange;

    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: absolute; right: 12px; top: 12px;
      display: flex; align-items: center; gap: 6px;
      background: rgba(20, 20, 35, 0.85); border-radius: 6px;
      padding: 6px 10px; z-index: 10; border: 1px solid rgba(255,255,255,0.1);
      font-family: monospace; font-size: 13px; color: #ccc;
    `;

    // Step button
    const stepBtn = this.makeButton('⏭', 'Step forward 1 tick');
    stepBtn.addEventListener('click', () => this.onAction('step'));

    // Play/Pause button
    this.playPauseBtn = this.makeButton('▶', 'Play');
    this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());

    // Speed buttons
    for (const speed of [1, 2, 4] as TimeSpeed[]) {
      const btn = this.makeButton(`${speed}x`, `Speed ${speed}x`);
      btn.addEventListener('click', () => this.setSpeed(speed));
      this.speedBtns.set(speed, btn);
    }

    // Tick display
    this.tickDisplay = document.createElement('span');
    this.tickDisplay.style.cssText = 'margin-left: 8px; color: #aaa;';
    this.tickDisplay.textContent = 'Day 1 — Tick 0';

    this.container.append(stepBtn, this.playPauseBtn);
    for (const btn of this.speedBtns.values()) {
      this.container.appendChild(btn);
    }
    this.container.appendChild(this.tickDisplay);

    this.highlightSpeed();
    parent.appendChild(this.container);
  }

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  get speed(): TimeSpeed {
    return this._speed;
  }

  updateTick(tick: number): void {
    const day = Math.floor(tick / TICKS_PER_DAY) + 1;
    const tickInDay = tick % TICKS_PER_DAY;
    this.tickDisplay.textContent = `Day ${day} — Tick ${tickInDay}`;
  }

  private togglePlayPause(): void {
    this._isPlaying = !this._isPlaying;
    this.playPauseBtn.textContent = this._isPlaying ? '⏸' : '▶';
    this.playPauseBtn.title = this._isPlaying ? 'Pause' : 'Play';
    this.onAction(this._isPlaying ? 'play' : 'pause');
  }

  private setSpeed(speed: TimeSpeed): void {
    this._speed = speed;
    this.highlightSpeed();
    this.onSpeedChange(speed);
  }

  private highlightSpeed(): void {
    for (const [speed, btn] of this.speedBtns) {
      btn.style.background =
        speed === this._speed ? 'rgba(200, 160, 64, 0.4)' : 'rgba(40, 40, 60, 0.8)';
      btn.style.borderColor =
        speed === this._speed ? 'rgba(200, 160, 64, 0.6)' : 'rgba(255,255,255,0.15)';
    }
  }

  private makeButton(text: string, title: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.title = title;
    btn.style.cssText = `
      width: 32px; height: 28px; border: 1px solid rgba(255,255,255,0.15);
      background: rgba(40, 40, 60, 0.8); color: #ccc; font-size: 13px;
      border-radius: 4px; cursor: pointer; padding: 0;
      font-family: monospace;
    `;
    return btn;
  }

  destroy(): void {
    this.container.remove();
  }
}
