import { UIConfig, VerbType, InventoryItemData, UIPresetType } from '../types';
import { EventBus } from '../core/EventBus';

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

  public init(container: HTMLElement, config?: UIConfig): void {
    this.containerElement = container;
    if (config) {
      this.config = { ...this.config, ...config };
    }
    this.renderUI();
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
      <button class="floating-inv-btn" id="ui-floating-inv">🎒</button>
      <div class="action-sentence floating" id="ui-action-sentence">Look around</div>
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
      <button class="floating-inv-btn" id="ui-floating-inv">🎒 Inventory</button>
      <div class="action-sentence floating" id="ui-action-sentence">Walk</div>
      <div class="inventory-drawer hidden" id="ui-inventory-modal">
        <div class="inventory-drawer-header">
          <span>Inventory</span>
          <button id="ui-close-inv">✕</button>
        </div>
        <div class="inventory-grid" id="ui-inventory-slots"></div>
      </div>
    `;
  }

  private attachEvents(overlay: HTMLElement): void {
    // Verb buttons
    overlay.querySelectorAll('.verb-btn, .sierra-btn, .coin-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const verb = (e.currentTarget as HTMLElement).dataset.verb as VerbType;
        if (verb) {
          this.setActiveVerb(verb);
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

  private updateVerbHighlights(): void {
    if (!this.containerElement) return;
    this.containerElement.querySelectorAll('.verb-btn, .sierra-btn').forEach(btn => {
      const verb = (btn as HTMLElement).dataset.verb;
      if (verb === this.activeVerb) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    const sentence = this.containerElement.querySelector('#ui-action-sentence');
    if (sentence) {
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

  public renderInventoryItems(items: InventoryItemData[]): void {
    if (!this.containerElement) return;
    const grid = this.containerElement.querySelector('#ui-inventory-slots');
    if (!grid) return;

    grid.innerHTML = '';
    for (const item of items) {
      const slot = document.createElement('div');
      slot.className = 'inv-item-slot';
      slot.dataset.id = item.id;
      slot.title = item.name;

      slot.innerHTML = `
        <img src="${item.iconUrl}" alt="${item.name}" onError="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'40\\' height=\\'40\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'gold\\' stroke-width=\\'2\\'><circle cx=\\'12\\' cy=\\'12\\' r=\\'10\\'/></svg>'" />
        <span class="inv-item-label">${item.name}</span>
      `;

      slot.addEventListener('click', () => {
        EventBus.getInstance().emit('inventory:item_clicked', item);
      });

      grid.appendChild(slot);
    }
  }
}
