import type { MapConfig } from '@core/map/types';

export class GeneratorToolbar {
  private element: HTMLDivElement;
  private sizeSelect: HTMLSelectElement;
  private geoSelect: HTMLSelectElement;
  private infraSelect: HTMLSelectElement;
  private seedInput: HTMLInputElement;
  private onGenerate: (config: MapConfig) => void;

  constructor(
    parent: HTMLElement,
    initialConfig: MapConfig,
    onGenerate: (config: MapConfig) => void,
  ) {
    this.onGenerate = onGenerate;

    this.element = document.createElement('div');
    Object.assign(this.element.style, {
      position: 'absolute',
      bottom: '0',
      left: '0',
      right: '0',
      height: '48px',
      background: 'rgba(0, 0, 0, 0.85)',
      borderTop: '1px solid rgba(255, 255, 255, 0.1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px',
      padding: '0 16px',
      zIndex: '10',
      userSelect: 'none',
    });

    this.sizeSelect = this.createSelect(
      'Size',
      ['small', 'medium', 'large'],
      initialConfig.mapSize,
    );

    this.geoSelect = this.createSelect(
      'Geography',
      ['plains', 'mixed', 'mountainous'],
      initialConfig.geography,
    );

    this.infraSelect = this.createSelect(
      'Infrastructure',
      ['none', 'basic', 'developed'],
      initialConfig.initialInfrastructure,
    );

    // Seed group
    const seedGroup = this.createGroup('Seed');
    this.seedInput = document.createElement('input');
    this.seedInput.type = 'number';
    this.seedInput.value = String(initialConfig.seed);
    Object.assign(this.seedInput.style, {
      width: '110px',
      background: '#2a2a3e',
      color: '#eee',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      borderRadius: '3px',
      padding: '4px 6px',
      fontSize: '12px',
      fontFamily: 'monospace',
    });
    seedGroup.appendChild(this.seedInput);

    const randomBtn = document.createElement('button');
    randomBtn.textContent = '\u{1F3B2}';
    randomBtn.title = 'Random seed';
    Object.assign(randomBtn.style, {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      fontSize: '16px',
      padding: '2px 4px',
    });
    randomBtn.addEventListener('click', () => {
      this.seedInput.value = String(Date.now());
    });
    seedGroup.appendChild(randomBtn);
    this.element.appendChild(seedGroup);

    // Generate button
    const generateBtn = document.createElement('button');
    generateBtn.textContent = 'Generate';
    Object.assign(generateBtn.style, {
      background: '#4a7a9a',
      color: '#fff',
      border: 'none',
      borderRadius: '3px',
      padding: '6px 16px',
      fontSize: '13px',
      fontWeight: '600',
      cursor: 'pointer',
      letterSpacing: '0.5px',
    });
    generateBtn.addEventListener('click', () => this.handleGenerate());
    generateBtn.addEventListener('mouseenter', () => {
      generateBtn.style.background = '#5a8aaa';
    });
    generateBtn.addEventListener('mouseleave', () => {
      generateBtn.style.background = '#4a7a9a';
    });
    this.element.appendChild(generateBtn);

    parent.appendChild(this.element);
  }

  private createGroup(label: string): HTMLDivElement {
    const group = document.createElement('div');
    Object.assign(group.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
    });
    const lbl = document.createElement('span');
    lbl.textContent = label;
    Object.assign(lbl.style, {
      color: '#999',
      fontSize: '12px',
    });
    group.appendChild(lbl);
    this.element.appendChild(group);
    return group;
  }

  private createSelect(label: string, options: string[], value: string): HTMLSelectElement {
    const group = this.createGroup(label);
    const select = document.createElement('select');
    Object.assign(select.style, {
      background: '#2a2a3e',
      color: '#eee',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      borderRadius: '3px',
      padding: '4px 6px',
      fontSize: '12px',
      cursor: 'pointer',
    });
    for (const opt of options) {
      const el = document.createElement('option');
      el.value = opt;
      el.textContent = opt;
      if (opt === value) el.selected = true;
      select.appendChild(el);
    }
    group.appendChild(select);
    return select;
  }

  private handleGenerate(): void {
    const config: MapConfig = {
      mapSize: this.sizeSelect.value as MapConfig['mapSize'],
      geography: this.geoSelect.value as MapConfig['geography'],
      initialInfrastructure: this.infraSelect.value as MapConfig['initialInfrastructure'],
      seed: Number(this.seedInput.value) || Date.now(),
    };
    this.onGenerate(config);
  }

  destroy(): void {
    this.element.remove();
  }
}
