import type { FacilityEntity, PlacedDepot, PlacedFactory } from '@core/simulation/types';
import { isFactory, RESOURCE_COLORS } from '@core/simulation/types';
import { ResourceType } from '@data/types';

export class InfoPanel {
  private container: HTMLDivElement;
  private contentEl: HTMLDivElement;
  private onUpgrade: (id: string) => void;
  private onDemolish: (id: string) => void;
  private currentEntityId: string | null = null;

  constructor(
    parent: HTMLElement,
    onUpgrade: (id: string) => void,
    onDemolish: (id: string) => void,
  ) {
    this.onUpgrade = onUpgrade;
    this.onDemolish = onDemolish;

    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: absolute; right: 12px; bottom: 12px;
      width: 280px; min-height: 100px;
      background: rgba(20, 20, 35, 0.9); border-radius: 6px;
      padding: 12px; z-index: 10; border: 1px solid rgba(255,255,255,0.1);
      font-family: monospace; font-size: 12px; color: #ccc;
      display: none;
    `;

    this.contentEl = document.createElement('div');
    this.container.appendChild(this.contentEl);
    parent.appendChild(this.container);
  }

  show(entity: FacilityEntity): void {
    this.currentEntityId = entity.id;
    this.container.style.display = 'block';

    if (isFactory(entity)) {
      this.renderFactory(entity);
    } else {
      this.renderDepot(entity);
    }
  }

  hide(): void {
    this.currentEntityId = null;
    this.container.style.display = 'none';
  }

  update(entity: FacilityEntity | null): void {
    if (!entity) {
      this.hide();
      return;
    }
    if (entity.id === this.currentEntityId) {
      this.show(entity);
    }
  }

  private renderFactory(factory: PlacedFactory): void {
    const typeName = this.factoryTypeName(factory.resourceType);
    const colorHex = `#${RESOURCE_COLORS[factory.resourceType].toString(16).padStart(6, '0')}`;
    const fillPct =
      factory.bufferCapacity > 0 ? Math.round((factory.buffer / factory.bufferCapacity) * 100) : 0;
    const canUpgrade = factory.level < 5;

    this.contentEl.innerHTML = `
      <div style="font-size: 14px; font-weight: bold; margin-bottom: 8px; color: ${colorHex}">
        ${typeName} — Lv.${factory.level}
      </div>
      <div style="margin-bottom: 4px;">
        Buffer: ${this.bar(fillPct, colorHex)} ${Math.round(factory.buffer)}/${factory.bufferCapacity}
      </div>
      <div style="margin-bottom: 8px;">Production: ${factory.productionPerDay}/day</div>
      <div style="margin-bottom: 4px; color: #888;">
        Connected: ${factory.connectedLineIds.length} line(s)
      </div>
      <div style="margin-top: 8px; display: flex; gap: 6px;">
        ${canUpgrade ? `<button id="pg-upgrade" style="${this.btnStyle()}">Upgrade to Lv.${factory.level + 1}</button>` : ''}
        <button id="pg-demolish" style="${this.btnStyle('#993333')}">Demolish</button>
      </div>
    `;

    this.attachButtons(factory.id);
  }

  private renderDepot(depot: PlacedDepot): void {
    const resources = [ResourceType.Fuel, ResourceType.Ammo, ResourceType.Food, ResourceType.Parts];
    const canUpgrade = depot.level < 5;

    const barsHtml = resources
      .map((res) => {
        const current = Math.round(depot.storage[res]);
        const max = depot.maxStoragePerResource;
        const pct = max > 0 ? Math.round((current / max) * 100) : 0;
        const colorHex = `#${RESOURCE_COLORS[res].toString(16).padStart(6, '0')}`;
        const name = res.charAt(0).toUpperCase() + res.slice(1);
        return `<div>${name}: ${this.bar(pct, colorHex)} ${current}/${max}</div>`;
      })
      .join('');

    this.contentEl.innerHTML = `
      <div style="font-size: 14px; font-weight: bold; margin-bottom: 8px; color: #ccc">
        Depot — Lv.${depot.level}
      </div>
      <div style="margin-bottom: 8px; line-height: 1.6;">${barsHtml}</div>
      <div style="margin-bottom: 4px;">Throughput: ${depot.throughputPerDay}/day</div>
      <div style="margin-bottom: 4px; color: #888;">
        Connected: ${depot.connectedLineIds.length} line(s)
      </div>
      <div style="margin-top: 8px; display: flex; gap: 6px;">
        ${canUpgrade ? `<button id="pg-upgrade" style="${this.btnStyle()}">Upgrade to Lv.${depot.level + 1}</button>` : ''}
        <button id="pg-demolish" style="${this.btnStyle('#993333')}">Demolish</button>
      </div>
    `;

    this.attachButtons(depot.id);
  }

  private attachButtons(entityId: string): void {
    const upgradeBtn = document.getElementById('pg-upgrade');
    if (upgradeBtn) {
      upgradeBtn.addEventListener('click', () => this.onUpgrade(entityId));
    }
    const demolishBtn = document.getElementById('pg-demolish');
    if (demolishBtn) {
      demolishBtn.addEventListener('click', () => this.onDemolish(entityId));
    }
  }

  private bar(pct: number, color: string): string {
    const filled = Math.round(pct / 10);
    const empty = 10 - filled;
    return `<span style="color: ${color}">${'\u2588'.repeat(filled)}</span><span style="color: #333">${'\u2591'.repeat(empty)}</span>`;
  }

  private factoryTypeName(type: ResourceType): string {
    const names: Record<ResourceType, string> = {
      [ResourceType.Fuel]: 'Fuel Factory',
      [ResourceType.Ammo]: 'Ammo Factory',
      [ResourceType.Food]: 'Food Factory',
      [ResourceType.Parts]: 'Parts Factory',
    };
    return names[type];
  }

  private btnStyle(bg = '#334'): string {
    return `
      padding: 4px 10px; border: 1px solid rgba(255,255,255,0.2);
      background: ${bg}; color: #ccc; font-size: 11px; font-family: monospace;
      border-radius: 3px; cursor: pointer;
    `;
  }

  destroy(): void {
    this.container.remove();
  }
}
