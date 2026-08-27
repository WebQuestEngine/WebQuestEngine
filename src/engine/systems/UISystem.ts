import { UIConfig, VerbType, InventoryItemData, UIPresetType } from '../types';
import { EventBus } from '../core/EventBus';
import { InventorySystem } from './InventorySystem';
import { AssetManager } from '../core/AssetManager';

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

  private constructor() {}

  public static getInstance(): UISystem {
    if (!UISystem.instance) {
      UISystem.instance = new UISystem();
    }
    return UISystem.instance;
  }

  private cursorFollowerElement: HTMLElement | null = null;

  public updateCustomCursor(iconUrl?: string | null): void {
    if (!this.cursorFollowerElement) {
      this.cursorFollowerElement = document.createElement('div');
      this.cursorFollowerElement.id = 'custom-cursor-follower';
      this.cursorFollowerElement.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        pointer-events: none;
        z-index: 99999;
        transform: translate(-50%, -50%);
        display: none;
      `;
      document.body.appendChild(this.cursorFollowerElement);

      window.addEventListener('mousemove', (e) => {
        if (this.cursorFollowerElement) {
          this.cursorFollowerElement.style.left = `${e.clientX}px`;
          this.cursorFollowerElement.style.top = `${e.clientY}px`;
        }
      });
    }

    if (iconUrl) {
      const resolved = AssetManager.getInstance().resolveImageSrc(iconUrl);
      this.cursorFollowerElement.innerHTML = `<img src="${resolved}" style="max-width:44px; max-height:44px; object-fit:contain; filter:drop-shadow(0 2px 8px rgba(0,0,0,0.7));" />`;
      this.cursorFollowerElement.style.display = 'block';
      document.body.classList.add('custom-cursor-active');
    } else {
      this.cursorFollowerElement.style.display = 'none';
      document.body.classList.remove('custom-cursor-active');
    }
  }

  public init(container: HTMLElement, config?: UIConfig): void {
    this.containerElement = container;
    if (config) {
      this.config = { ...this.config, ...config };
    }
    this.renderUI();
    EventBus.getInstance().on('inventory:selected', (item: any) => {
      this.updateCustomCursor(item ? item.iconUrl : null);
    });
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
          pull: 'Pull'
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
}
