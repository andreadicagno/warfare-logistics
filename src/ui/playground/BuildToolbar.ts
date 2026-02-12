import type { BuildTool } from '@core/simulation/types';

const TOOLS: Array<{ tool: BuildTool; label: string; shortcut: string; icon: string }> = [
  { tool: 'select', label: 'Select', shortcut: '1', icon: '⊙' },
  { tool: 'fuel-factory', label: 'Fuel Factory', shortcut: '2', icon: '🛢' },
  { tool: 'ammo-factory', label: 'Ammo Factory', shortcut: '3', icon: '💣' },
  { tool: 'food-factory', label: 'Food Factory', shortcut: '4', icon: '🍞' },
  { tool: 'parts-factory', label: 'Parts Factory', shortcut: '5', icon: '⚙' },
  { tool: 'depot', label: 'Depot', shortcut: '6', icon: '📦' },
  { tool: 'supply-line', label: 'Supply Line', shortcut: '7', icon: '╱' },
  { tool: 'demolish', label: 'Demolish', shortcut: '8', icon: '✕' },
];

export class BuildToolbar {
  private container: HTMLDivElement;
  private activeTool: BuildTool = 'select';
  private buttons: Map<BuildTool, HTMLButtonElement> = new Map();
  private onToolChange: (tool: BuildTool) => void;
  private boundKeyDown: (e: KeyboardEvent) => void;

  constructor(parent: HTMLElement, onToolChange: (tool: BuildTool) => void) {
    this.onToolChange = onToolChange;

    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: absolute; left: 8px; top: 50%; transform: translateY(-50%);
      display: flex; flex-direction: column; gap: 2px;
      background: rgba(20, 20, 35, 0.85); border-radius: 6px;
      padding: 6px; z-index: 10; border: 1px solid rgba(255,255,255,0.1);
    `;

    for (const { tool, label, shortcut, icon } of TOOLS) {
      const btn = document.createElement('button');
      btn.title = `${label} (${shortcut})`;
      btn.textContent = icon;
      btn.style.cssText = `
        width: 36px; height: 36px; border: 1px solid rgba(255,255,255,0.15);
        background: rgba(40, 40, 60, 0.8); color: #ccc; font-size: 16px;
        border-radius: 4px; cursor: pointer; display: flex;
        align-items: center; justify-content: center; padding: 0;
      `;
      btn.addEventListener('click', () => this.setTool(tool));
      this.buttons.set(tool, btn);
      this.container.appendChild(btn);
    }

    this.highlightActive();
    parent.appendChild(this.container);

    this.boundKeyDown = this.onKeyDown.bind(this);
    window.addEventListener('keydown', this.boundKeyDown);
  }

  get tool(): BuildTool {
    return this.activeTool;
  }

  setTool(tool: BuildTool): void {
    this.activeTool = tool;
    this.highlightActive();
    this.onToolChange(tool);
  }

  private highlightActive(): void {
    for (const [tool, btn] of this.buttons) {
      btn.style.background =
        tool === this.activeTool ? 'rgba(200, 160, 64, 0.4)' : 'rgba(40, 40, 60, 0.8)';
      btn.style.borderColor =
        tool === this.activeTool ? 'rgba(200, 160, 64, 0.6)' : 'rgba(255,255,255,0.15)';
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    if (e.key === 'Escape') {
      this.setTool('select');
      return;
    }

    const toolDef = TOOLS.find((t) => t.shortcut === e.key);
    if (toolDef) {
      this.setTool(toolDef.tool);
    }
  }

  destroy(): void {
    window.removeEventListener('keydown', this.boundKeyDown);
    this.container.remove();
  }
}
