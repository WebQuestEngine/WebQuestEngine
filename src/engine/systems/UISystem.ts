import { UIConfig, VerbType, InventoryItemData, UIPresetType } from '../types';
import { EventBus } from '../core/EventBus';
import { InventorySystem } from './InventorySystem';
import { AssetManager } from '../core/AssetManager';

export const DEFAULT_ARROW_CURSOR_URL =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">` +
      `<defs>` +
        `<filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">` +
          `<feDropShadow dx="1" dy="2" stdDeviation="1.5" flood-color="#000000" flood-opacity="0.8"/>` +
        `</filter>` +
      `</defs>` +
      `<g filter="url(#shadow)">` +
        `<path d="M4 2 L22 16 L13.5 17 L18.5 28 L14.5 30 L9.5 19 L4 24 Z" fill="#ffffff" stroke="#0f172a" stroke-width="2" stroke-linejoin="round"/>` +
        `<path d="M6.5 5.5 L18 14.5 L12 15.2 L16.2 24.5 L14.2 25.5 L10 16.5 L6.5 19.5 Z" fill="#fbbf24"/>` +
      `</g>` +
    `</svg>`
  );

export class UISystem {
  private static instance: UISystem;
  public config: UIConfig = {
    preset: 'lucasarts',
    primaryColor: '#1e1b4b',
    accentColor: '#fbbf24',
    fontFamily: 'Inter, sans-serif',
    inventoryPosition: 'bottom',
    autoHideBars: false,
    showVerbText: true
  };

  public activeVerb: VerbType = 'walk';
  public containerElement: HTMLElement | null = null;
  public isHoveringUI = false;

  public constructor() {}

  public static getInstance(): UISystem {
    if (!UISystem.instance) {
      UISystem.instance = new UISystem();
    }
    return UISystem.instance;
  }

  public static setInstance(inst: UISystem | null): void {
    UISystem.instance = inst as any;
  }

  private cursorFollowerElement: HTMLElement | null = null;
  private currentCursorHotspotX = 0;
  private currentCursorHotspotY = 0;
  private lastClientX = window.innerWidth / 2;
  private lastClientY = window.innerHeight / 2;
  private currentCursorUrl: string | null = null;
  private currentRawHotspotX = 0;
  private currentRawHotspotY = 0;
  private imageDimensionsCache = new Map<string, { width: number; height: number }>();
  private globalMouseMoveHandler: ((e: MouseEvent) => void) | null = null;

  public getPointerCursorConfig(): { url: string; hotspotX: number; hotspotY: number } {
    const custom = this.config?.customCursors?.['pointer'] || (this.config?.customCursors as any)?.['arrow'];
    if (custom?.url) {
      return {
        url: custom.url,
        hotspotX: custom.hotspotX ?? 0,
        hotspotY: custom.hotspotY ?? 0
      };
    }
    return {
      url: DEFAULT_ARROW_CURSOR_URL,
      hotspotX: 4,
      hotspotY: 2
    };
  }

  public showPointerCursor(): void {
    const ptr = this.getPointerCursorConfig();
    this.updateCustomCursor(ptr.url, ptr.hotspotX, ptr.hotspotY);
  }

  public updateCustomCursor(iconUrl?: string | null, hotspotX?: number, hotspotY?: number): void {
    const rawHX = hotspotX ?? 0;
    const rawHY = hotspotY ?? 0;

    if (!this.cursorFollowerElement) {
      this.cursorFollowerElement = document.createElement('div');
      this.cursorFollowerElement.id = 'custom-cursor-follower';
      this.cursorFollowerElement.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        pointer-events: none;
        z-index: 99999;
        display: none;
      `;
      document.body.appendChild(this.cursorFollowerElement);

      this.globalMouseMoveHandler = (e: MouseEvent) => {
        this.lastClientX = e.clientX;
        this.lastClientY = e.clientY;
        if (this.cursorFollowerElement && this.currentCursorUrl) {
          this.cursorFollowerElement.style.left = `${e.clientX - this.currentCursorHotspotX}px`;
          this.cursorFollowerElement.style.top = `${e.clientY - this.currentCursorHotspotY}px`;
        }

        const target = e.target as Element | null;
        const inUI = target
          ? !!target.closest(
              '.quest-ui-overlay, .play-mode-exit-bar, .dialog-box-overlay, .inventory-modal, .inventory-drawer, .context-coin, .tree-context-menu'
            )
          : false;

        if (inUI !== this.isHoveringUI) {
          this.isHoveringUI = inUI;
          if (inUI) {
            this.showPointerCursor();
          }
        }
      };

      window.addEventListener('mousemove', this.globalMouseMoveHandler);
    }

    if (!iconUrl) {
      this.currentCursorUrl = null;
      this.currentRawHotspotX = 0;
      this.currentRawHotspotY = 0;
      this.currentCursorHotspotX = 0;
      this.currentCursorHotspotY = 0;
      if (this.cursorFollowerElement) {
        this.cursorFollowerElement.style.display = 'none';
      }
      document.body.classList.remove('custom-cursor-active');
      return;
    }

    // If identical cursor and hotspot is already active, just maintain smooth tracking
    if (
      iconUrl === this.currentCursorUrl &&
      rawHX === this.currentRawHotspotX &&
      rawHY === this.currentRawHotspotY &&
      this.cursorFollowerElement.style.display === 'block'
    ) {
      return;
    }

    this.currentCursorUrl = iconUrl;
    this.currentRawHotspotX = rawHX;
    this.currentRawHotspotY = rawHY;

    const resolved = AssetManager.getInstance().resolveImageSrc(iconUrl);

    const applyLayout = (natW: number, natH: number) => {
      if (this.currentCursorUrl !== iconUrl) return;
      const scale = Math.min(48 / (natW || 48), 48 / (natH || 48), 1);
      const actualW = Math.round(natW * scale);
      const actualH = Math.round(natH * scale);
      this.currentCursorHotspotX = Math.round(rawHX * scale);
      this.currentCursorHotspotY = Math.round(rawHY * scale);

      if (this.cursorFollowerElement) {
        this.cursorFollowerElement.innerHTML = `<img src="${resolved}" style="width:${actualW}px; height:${actualH}px; object-fit:contain; filter:drop-shadow(0 2px 8px rgba(0,0,0,0.7)); display:block;" />`;
        this.cursorFollowerElement.style.left = `${this.lastClientX - this.currentCursorHotspotX}px`;
        this.cursorFollowerElement.style.top = `${this.lastClientY - this.currentCursorHotspotY}px`;
        this.cursorFollowerElement.style.display = 'block';
        document.body.classList.add('custom-cursor-active');
      }
    };

    if (this.imageDimensionsCache.has(resolved)) {
      const cached = this.imageDimensionsCache.get(resolved)!;
      applyLayout(cached.width, cached.height);
    } else {
      const img = new Image();
      img.onload = () => {
        const natW = img.naturalWidth || 48;
        const natH = img.naturalHeight || 48;
        this.imageDimensionsCache.set(resolved, { width: natW, height: natH });
        applyLayout(natW, natH);
      };
      img.onerror = () => {
        this.imageDimensionsCache.set(resolved, { width: 48, height: 48 });
        applyLayout(48, 48);
      };
      img.src = resolved;
    }
  }

  private unsubscribers: (() => void)[] = [];

  public init(container: HTMLElement, config?: UIConfig): void {
    this.containerElement = container;
    if (config) {
      this.config = { ...this.config, ...config };
    }
    this.renderUI();

    // Clean up previous event subscriptions if re-initialized
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];

    this.unsubscribers.push(
      EventBus.getInstance().on('inventory:selected', (item: any) => {
        this.updateCustomCursor(item ? item.iconUrl : null);
      })
    );
    this.unsubscribers.push(
      EventBus.getInstance().on('inventory:updated', (items: any) => {
        this.renderInventoryItems(items || InventorySystem.getInstance().getItems());
      })
    );
  }

  public setPreset(preset: UIPresetType): void {
    this.config.preset = preset;
    if (preset === 'lucasarts') {
      this.config.inventoryPosition = 'bottom';
      this.config.autoHideBars = false;
    } else if (preset === 'sierra') {
      this.config.inventoryPosition = 'top';
      this.config.autoHideBars = false;
    } else if (preset === 'context_coin') {
      this.config.inventoryPosition = 'drawer';
      this.config.autoHideBars = true;
    } else if (preset === 'direct_cursor') {
      this.config.inventoryPosition = 'drawer';
      this.config.autoHideBars = true;
    }
    this.renderUI();
    EventBus.getInstance().emit('ui:preset_changed', preset);
  }

  public setActiveVerb(verb: VerbType): void {
    this.activeVerb = verb;
    EventBus.getInstance().emit('ui:verb_changed', verb);
    this.updateVerbHighlights();
  }

  public renderUI(): void {
    if (!this.containerElement) return;

    // Clear previous UI overlays
    const existing = this.containerElement.querySelector('.quest-ui-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = `quest-ui-overlay preset-${this.config.preset}`;

    if (this.config.preset === 'lucasarts') {
      overlay.innerHTML = this.getLucasArtsHTML();
    } else if (this.config.preset === 'sierra') {
      overlay.innerHTML = this.getSierraHTML();
    } else if (this.config.preset === 'context_coin') {
      overlay.innerHTML = this.getContextCoinHTML();
    } else {
      overlay.innerHTML = this.getDirectCursorHTML();
    }

    this.containerElement.appendChild(overlay);
    this.attachEvents(overlay);
    this.renderInventoryItems(InventorySystem.getInstance().getItems());
  }

  private getLucasArtsHTML(): string {
    return `
      <div class="lucas-bottom-bar">
        <div class="verb-grid">
          <button class="verb-btn active" data-verb="walk">Walk to</button>
          <button class="verb-btn" data-verb="look">Look at</button>
          <button class="verb-btn" data-verb="interact">Use</button>

          <button class="verb-btn" data-verb="talk">Talk to</button>
          <button class="verb-btn" data-verb="pick_up">Pick up</button>
          <button class="verb-btn" data-verb="open">Open</button>

          <button class="verb-btn" data-verb="close">Close</button>
          <button class="verb-btn" data-verb="push">Push</button>
          <button class="verb-btn" data-verb="pull">Pull</button>
        </div>
        <div class="inventory-box">
          <div class="inventory-header">Inventory</div>
          <div class="inventory-grid" id="ui-inventory-slots"></div>
        </div>
      </div>
      <div class="action-sentence" id="ui-action-sentence">Walk to</div>
    `;
  }

  private getSierraHTML(): string {
    return `
      <div class="sierra-top-bar">
        <div class="sierra-buttons">
          <button class="sierra-btn active" data-verb="walk" title="Walk">🥾 Walk</button>
          <button class="sierra-btn" data-verb="look" title="Look">👁️ Look</button>
          <button class="sierra-btn" data-verb="interact" title="Interact">✋ Touch</button>
          <button class="sierra-btn" data-verb="talk" title="Talk">💬 Talk</button>
          <button class="sierra-btn" id="sierra-inv-toggle" title="Inventory">🎒 Inventory</button>
        </div>
        <div class="action-sentence" id="ui-action-sentence">Walk to</div>
      </div>
      <div class="inventory-modal hidden" id="ui-inventory-modal">
        <div class="inventory-modal-content">
          <h3>Items</h3>
          <div class="inventory-grid" id="ui-inventory-slots"></div>
          <button class="close-modal-btn" id="ui-close-inv">Close</button>
        </div>
      </div>
    `;
  }

  private getContextCoinHTML(): string {
    return `
      <div class="context-coin hidden" id="ui-context-coin">
        <button class="coin-btn" data-verb="look" title="Look">👁️</button>
        <button class="coin-btn" data-verb="interact" title="Use/Touch">✋</button>
        <button class="coin-btn" data-verb="talk" title="Talk">💬</button>
      </div>
      <button class="floating-inv-btn" id="ui-floating-inv">🎒 Inventory</button>
      <div class="action-sentence floating" id="ui-action-sentence">Walk to</div>
      <div class="inventory-drawer hidden" id="ui-inventory-modal">
        <div class="inventory-drawer-header">
          <span>Inventory</span>
          <button id="ui-close-inv">✕</button>
        </div>
        <div class="inventory-grid" id="ui-inventory-slots"></div>
      </div>
    `;
  }

  private getDirectCursorHTML(): string {
    return `
      <div class="direct-verb-bar">
        <button class="verb-btn active" data-verb="walk" title="Walk">🥾 Walk</button>
        <button class="verb-btn" data-verb="look" title="Look">👁️ Look</button>
        <button class="verb-btn" data-verb="interact" title="Interact/Use">✋ Use</button>
        <button class="verb-btn" data-verb="talk" title="Talk">💬 Talk</button>
      </div>

      <div class="direct-inv-dock">
        <div class="direct-inv-header">
          <span>🎒 INVENTORY</span>
          <button class="floating-inv-btn" id="ui-floating-inv" style="padding:2px 8px; font-size:0.7rem;">Modal ⤢</button>
        </div>
        <div class="inventory-grid" id="ui-inventory-slots"></div>
      </div>

      <div class="action-sentence floating" id="ui-action-sentence">Walk to</div>

      <div class="inventory-drawer hidden" id="ui-inventory-modal">
        <div class="inventory-drawer-header">
          <span>Inventory Drawer</span>
          <button id="ui-close-inv">✕</button>
        </div>
        <div class="inventory-grid" id="ui-inventory-slots-drawer"></div>
      </div>
    `;
  }

  private attachEvents(overlay: HTMLElement): void {
    // Verb buttons
    overlay.querySelectorAll('.verb-btn, .sierra-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const verb = (e.currentTarget as HTMLElement).dataset.verb as VerbType;
        if (verb) {
          InventorySystem.getInstance().selectItem(null);
          this.setActiveVerb(verb);
        }
      });
    });

    // Coin buttons
    overlay.querySelectorAll('.coin-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const verb = (e.currentTarget as HTMLElement).dataset.verb as VerbType;
        if (verb) {
          this.setActiveVerb(verb);
          EventBus.getInstance().emit('ui:coin_verb', verb);
          this.hideContextCoin();
        }
      });
    });

    // Inventory toggles
    const invToggle = overlay.querySelector('#sierra-inv-toggle, #ui-floating-inv');
    const invModal = overlay.querySelector('#ui-inventory-modal');
    const closeInv = overlay.querySelector('#ui-close-inv');

    if (invToggle && invModal) {
      invToggle.addEventListener('click', () => {
        invModal.classList.toggle('hidden');
      });
    }
    if (closeInv && invModal) {
      closeInv.addEventListener('click', () => {
        invModal.classList.add('hidden');
      });
    }
  }

  public showContextCoin(x: number, y: number): void {
    if (!this.containerElement) return;
    const coin = this.containerElement.querySelector('#ui-context-coin') as HTMLElement;
    if (coin) {
      coin.style.left = `${x}px`;
      coin.style.top = `${y}px`;
      coin.classList.remove('hidden');
    }
  }

  public hideContextCoin(): void {
    if (!this.containerElement) return;
    const coin = this.containerElement.querySelector('#ui-context-coin') as HTMLElement;
    if (coin) {
      coin.classList.add('hidden');
    }
  }

  private updateVerbHighlights(): void {
    if (!this.containerElement) return;
    const active = this.activeVerb;
    this.containerElement.querySelectorAll('.verb-btn, .sierra-btn, .coin-btn').forEach(btn => {
      const verb = (btn as HTMLElement).dataset.verb;
      if (verb === active || (verb === 'interact' && active === 'use') || (verb === 'use' && active === 'interact')) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    const sentence = this.containerElement.querySelector('#ui-action-sentence');
    if (sentence) {
      const selectedItem = InventorySystem.getInstance().getSelectedItem();
      if (selectedItem) {
        sentence.textContent = `Use ${selectedItem.name} with`;
      } else {
        const labelMap: Record<VerbType, string> = {
          walk: 'Walk to',
          look: 'Look at',
          interact: 'Use',
          talk: 'Talk to',
          pick_up: 'Pick up',
          use: 'Use',
          open: 'Open',
          close: 'Close',
          push: 'Push',
          pull: 'Pull',
          pointer: ''
        };
        sentence.textContent = labelMap[this.activeVerb] || 'Walk to';
      }
    }
  }

  public showSubtitle(text: string): void {
    if (!this.containerElement) return;
    const existing = this.containerElement.querySelector('.speech-subtitle-box');
    if (existing) existing.remove();

    const box = document.createElement('div');
    box.className = 'speech-subtitle-box';
    box.textContent = `"${text}"`;
    this.containerElement.appendChild(box);

    setTimeout(() => {
      box.remove();
    }, 4000);
  }

  private getItemIconHTML(item: InventoryItemData): string {
    const rawUrl = item.iconUrl || '';
    const resolvedUrl = AssetManager.getInstance().resolveImageSrc(rawUrl);

    if (resolvedUrl) {
      return `<img src="${resolvedUrl}" alt="${item.name}" style="width:100%; height:100%; object-fit:contain;" onError="this.style.display='none'; this.nextElementSibling.style.display='block';" />
              <div style="display:none; width:100%; height:100%;">${this.getProceduralSVG(item.id, item.name)}</div>`;
    }
    return this.getProceduralSVG(item.id, item.name);
  }

  private getProceduralSVG(id: string, name: string): string {
    const keyStr = (id + ' ' + name).toLowerCase();
    if (keyStr.includes('key')) {
      return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5"><circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3L19 4M15 4l2 2M18 7l2 2"/></svg>`;
    }
    if (keyStr.includes('crystal')) {
      return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#c084fc" stroke-width="2.5"><path d="M12 2L5 9v6l7 7 7-7V9l-7-7z"/><path d="M12 2v20M5 9h14M5 15h14"/></svg>`;
    }
    if (keyStr.includes('potion') || keyStr.includes('elixir')) {
      return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5"><path d="M9 3h6M10 3v4L5 16a3 3 0 003 4h8a3 3 0 003-4L14 7V3"/></svg>`;
    }
    if (keyStr.includes('scroll') || keyStr.includes('note') || keyStr.includes('paper')) {
      return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2.5"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-.7-2.7-1.1-4.5C14.7 4.7 13.9 4 13 4H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-1z"/></svg>`;
    }
    return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2M12 12v3"/></svg>`;
  }

  public renderInventoryItems(items: InventoryItemData[]): void {
    if (!this.containerElement) return;
    const grids = Array.from(this.containerElement.querySelectorAll('#ui-inventory-slots, #ui-inventory-slots-drawer'));
    if (grids.length === 0) return;

    const selectedItem = InventorySystem.getInstance().getSelectedItem();

    for (const grid of grids) {
      grid.innerHTML = '';
      for (const item of items) {
        const slot = document.createElement('div');
        slot.className = `inv-item-slot ${selectedItem && selectedItem.id === item.id ? 'selected' : ''}`;
        slot.dataset.id = item.id;
        slot.title = `${item.name} (Click to select, or drag onto scene)`;
        slot.draggable = true;

        slot.innerHTML = `
          ${this.getItemIconHTML(item)}
          <span class="inv-item-label">${item.name}</span>
        `;

        // Drag & Drop
        slot.addEventListener('dragstart', (e) => {
          InventorySystem.getInstance().selectItem(item.id);
          this.setActiveVerb('use');
          if (e.dataTransfer) {
            e.dataTransfer.setData('text/plain', item.id);
            e.dataTransfer.effectAllowed = 'copyMove';
          }
        });

        slot.addEventListener('dragover', (e) => e.preventDefault());

        slot.addEventListener('drop', (e) => {
          e.preventDefault();
          const draggedId = e.dataTransfer?.getData('text/plain');
          if (draggedId && draggedId !== item.id) {
            InventorySystem.getInstance().combineItems(draggedId, item.id);
          }
        });

        // Click select
        slot.addEventListener('click', (e) => {
          e.stopPropagation();
          const currentSelected = InventorySystem.getInstance().getSelectedItem();
          if (currentSelected && currentSelected.id === item.id) {
            InventorySystem.getInstance().selectItem(null);
            this.setActiveVerb('walk');
          } else {
            InventorySystem.getInstance().selectItem(item.id);
            this.setActiveVerb('use');
          }
          this.renderInventoryItems(items);
        });

        grid.appendChild(slot);
      }
    }
  }

  public updateHoverTitle(name: string, verb?: string): void {
    if (!this.containerElement) return;
    const titleEl = this.containerElement.querySelector('#ui-action-sentence, #ui-hover-title, .action-sentence, .ui-hover-title');
    if (titleEl) {
      titleEl.textContent = verb ? `${verb.toUpperCase()} ${name}` : name;
    }
  }

  public clearHoverTitle(): void {
    if (!this.containerElement) return;
    const titleEl = this.containerElement.querySelector('#ui-action-sentence, #ui-hover-title, .action-sentence, .ui-hover-title');
    if (titleEl) {
      const verbLabel = this.activeVerb === 'walk' ? 'Walk to' : this.activeVerb ? this.activeVerb.toUpperCase() : '';
      titleEl.textContent = verbLabel;
    }
  }

  public destroy(): void {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];

    if (this.globalMouseMoveHandler) {
      window.removeEventListener('mousemove', this.globalMouseMoveHandler);
      this.globalMouseMoveHandler = null;
    }

    this.isHoveringUI = false;

    if (this.containerElement) {
      const overlays = this.containerElement.querySelectorAll('.quest-ui-overlay, .speech-subtitle-box, .ui-subtitle-bar');
      overlays.forEach(el => el.remove());
      this.containerElement = null;
    }
    if (this.cursorFollowerElement) {
      this.cursorFollowerElement.remove();
      this.cursorFollowerElement = null;
      document.body.classList.remove('custom-cursor-active');
    }
  }
}
