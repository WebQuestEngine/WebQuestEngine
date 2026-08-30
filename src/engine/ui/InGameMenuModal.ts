import { ProjectData, SaveGameData, UIPresetType } from '../types';
import { EventBus } from '../core/EventBus';
import { SaveSystem } from '../systems/SaveSystem';
import { AudioSystem } from '../systems/AudioSystem';
import { UISystem } from '../systems/UISystem';
import { StoryGraphSystem } from '../systems/StoryGraphSystem';

type MenuViewType = 'main' | 'save' | 'load' | 'settings' | 'restart';

export class InGameMenuModal {
  private element: HTMLElement;
  private project: ProjectData | null = null;
  private currentView: MenuViewType = 'main';
  private isOpen: boolean = false;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'in-game-menu-overlay hidden';
    this.element.id = 'in-game-menu-modal';
    this.element.style.cssText = `
      position: absolute;
      inset: 0;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      font-family: inherit;
    `;

    document.body.appendChild(this.element);

    // Global ESC handler when menu is open
    // window.addEventListener('keydown', (e) => {
    //   if (e.key === 'Escape' && this.isOpen) {
    //     e.preventDefault();
    //     e.stopPropagation();
    //     if (this.currentView === 'main') {
    //       this.close();
    //     } else {
    //       this.switchView('main');
    //     }
    //   }
    // });

    // Listen for external open/toggle events
    EventBus.getInstance().on('menu:open', () => this.open());
    EventBus.getInstance().on('menu:toggle', () => this.toggle());
    EventBus.getInstance().on('menu:close', () => this.close());
  }

  public setProject(project: ProjectData): void {
    this.project = project;
  }

  public open(view: MenuViewType = 'main'): void {
    this.isOpen = true;
    this.currentView = view;
    this.element.classList.remove('hidden');
    this.element.style.pointerEvents = 'auto';
    requestAnimationFrame(() => {
      this.element.style.opacity = '1';
    });

    EventBus.getInstance().emit('game:pause');
    this.render();
  }

  public close(): void {
    this.isOpen = false;
    this.element.style.opacity = '0';
    this.element.style.pointerEvents = 'none';
    setTimeout(() => {
      if (!this.isOpen) {
        this.element.classList.add('hidden');
      }
    }, 200);

    EventBus.getInstance().emit('game:resume');
  }

  public toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  public isMenuOpen(): boolean {
    return this.isOpen;
  }

  public switchView(view: MenuViewType): void {
    this.currentView = view;
    this.render();
  }

  public render(): void {
    const title = this.project?.title || 'Quest Adventure';
    const author = this.project?.author || 'QuestEngine';

    let contentHTML = '';
    let headerTitle = '⏸️ GAME PAUSED';

    switch (this.currentView) {
      case 'save':
        headerTitle = '💾 SAVE GAME';
        contentHTML = this.renderSaveView();
        break;
      case 'load':
        headerTitle = '📂 LOAD GAME';
        contentHTML = this.renderLoadView();
        break;
      case 'settings':
        headerTitle = '⚙️ AUDIO & DISPLAY SETTINGS';
        contentHTML = this.renderSettingsView();
        break;
      case 'restart':
        headerTitle = '🔄 RESTART QUEST';
        contentHTML = this.renderRestartView();
        break;
      case 'main':
      default:
        headerTitle = '⏸️ GAME PAUSED';
        contentHTML = this.renderMainView();
        break;
    }

    this.element.innerHTML = `
      <div class="in-game-menu-card" style="
        width: 90%;
        max-width: 620px;
        max-height: 90vh;
        background: linear-gradient(145deg, rgba(30, 41, 59, 0.98), rgba(15, 23, 42, 0.98));
        border: 1px solid rgba(251, 191, 36, 0.35);
        border-radius: 12px;
        box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 30px rgba(251, 191, 36, 0.15);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: menuScaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      ">
        <!-- Menu Header -->
        <div style="
          padding: 16px 20px;
          background: rgba(15, 23, 42, 0.8);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: space-between;
        ">
          <div>
            <h2 style="margin: 0; font-size: 1.1rem; color: #fbbf24; font-weight: 800; letter-spacing: 0.05em; display: flex; align-items: center; gap: 8px;">
              ${headerTitle}
            </h2>
            <div style="font-size: 0.72rem; color: #94a3b8; margin-top: 2px;">
              ${title} <span style="opacity:0.6;">by ${author}</span>
            </div>
          </div>
          <button id="btn-menu-close" style="
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.15);
            color: #e2e8f0;
            width: 32px;
            height: 32px;
            border-radius: 6px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1rem;
            transition: all 0.15s ease;
          " title="Resume Game (Esc)">✕</button>
        </div>

        <!-- Menu Body -->
        <div style="padding: 20px; overflow-y: auto; flex: 1; display: flex; flex-direction: column;">
          ${contentHTML}
        </div>

        <!-- Menu Footer / Navigation -->
        <div style="
          padding: 12px 20px;
          background: rgba(15, 23, 42, 0.6);
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.75rem;
          color: #64748b;
        ">
          <div>
            ${this.currentView !== 'main' ? `
              <button id="btn-menu-back" style="
                background: transparent;
                border: 1px solid rgba(255, 255, 255, 0.15);
                color: #fbbf24;
                padding: 4px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-weight: 600;
                font-size: 0.75rem;
              ">⬅️ Back to Main Menu</button>
            ` : '<span>Press <b>ESC</b> anytime to resume</span>'}
          </div>
          <div style="display:flex; gap:12px; align-items:center;">
            <span style="opacity: 0.6;">Quest Engine v1.0</span>
          </div>
        </div>
      </div>
    `;

    this.attachEvents();
  }

  private renderMainView(): string {
    return `
      <div style="display: flex; flex-direction: column; gap: 10px; padding: 6px 0;">
        <button class="menu-action-btn" id="btn-action-resume" style="${this.getMainBtnStyle('#22c55e')}">
          <span style="font-size: 1.25rem;">▶️</span>
          <div style="text-align: left; flex: 1;">
            <div style="font-weight: 700; font-size: 0.95rem; color: #f8fafc;">Resume Game</div>
            <div style="font-size: 0.7rem; color: #94a3b8;">Continue your adventure where you left off</div>
          </div>
          <span style="font-size: 0.7rem; color: #64748b; font-weight: 600;">(ESC)</span>
        </button>

        <button class="menu-action-btn" id="btn-action-save" style="${this.getMainBtnStyle('#38bdf8')}">
          <span style="font-size: 1.25rem;">💾</span>
          <div style="text-align: left; flex: 1;">
            <div style="font-weight: 700; font-size: 0.95rem; color: #f8fafc;">Save Game</div>
            <div style="font-size: 0.7rem; color: #94a3b8;">Store your quest state in a designated slot or file</div>
          </div>
          <span style="font-size: 0.8rem; color: #38bdf8;">➔</span>
        </button>

        <button class="menu-action-btn" id="btn-action-load" style="${this.getMainBtnStyle('#a855f7')}">
          <span style="font-size: 1.25rem;">📂</span>
          <div style="text-align: left; flex: 1;">
            <div style="font-weight: 700; font-size: 0.95rem; color: #f8fafc;">Load Game</div>
            <div style="font-size: 0.7rem; color: #94a3b8;">Restore a previously saved adventure or import save file</div>
          </div>
          <span style="font-size: 0.8rem; color: #a855f7;">➔</span>
        </button>

        <button class="menu-action-btn" id="btn-action-settings" style="${this.getMainBtnStyle('#fbbf24')}">
          <span style="font-size: 1.25rem;">⚙️</span>
          <div style="text-align: left; flex: 1;">
            <div style="font-weight: 700; font-size: 0.95rem; color: #f8fafc;">Settings & Audio</div>
            <div style="font-size: 0.7rem; color: #94a3b8;">Adjust sound volumes, UI preset themes, and text pacing</div>
          </div>
          <span style="font-size: 0.8rem; color: #fbbf24;">➔</span>
        </button>

        <button class="menu-action-btn" id="btn-action-restart" style="${this.getMainBtnStyle('#f97316')}">
          <span style="font-size: 1.25rem;">🔄</span>
          <div style="text-align: left; flex: 1;">
            <div style="font-weight: 700; font-size: 0.95rem; color: #f8fafc;">Restart Quest / Chapter</div>
            <div style="font-size: 0.7rem; color: #94a3b8;">Replay the current chapter or restart from the beginning</div>
          </div>
          <span style="font-size: 0.8rem; color: #f97316;">➔</span>
        </button>
      </div>
    `;
  }

  private getMainBtnStyle(accentColor: string): string {
    return `
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 12px 16px;
      background: rgba(30, 41, 59, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-left: 4px solid ${accentColor};
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.15s ease;
      color: inherit;
    `;
  }

  private renderSaveView(): string {
    const slots = SaveSystem.getInstance().getSavedSlots();

    return `
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <div style="font-size: 0.78rem; color: #94a3b8; margin-bottom: 4px;">
          Select a slot below to save your current progress:
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          ${slots.map((save, idx) => {
      const slotNum = idx + 1;
      return `
              <div class="save-slot-card" data-slot="${slotNum}" style="
                background: rgba(30, 41, 59, 0.8);
                border: 1px solid ${save ? 'rgba(56, 189, 248, 0.4)' : 'rgba(255, 255, 255, 0.08)'};
                border-radius: 8px;
                padding: 10px;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                min-height: 100px;
                position: relative;
              ">
                <div>
                  <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size: 0.75rem; font-weight: 800; color: #38bdf8;">SLOT ${slotNum}</span>
                    ${save ? `<span style="font-size: 0.65rem; color: #94a3b8;">${save.dateFormatted}</span>` : '<span style="font-size: 0.65rem; color: #64748b;">(Empty Slot)</span>'}
                  </div>

                  <div style="font-size: 0.82rem; font-weight: 700; color: #f8fafc; margin-top: 4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    ${save ? save.sceneName : 'Empty Save Slot'}
                  </div>

                  ${save ? `
                    <div style="font-size: 0.68rem; color: #94a3b8; margin-top: 2px;">
                      📍 ${save.chapterTitle} | 🎒 ${save.inventoryItemIds.length} items
                    </div>
                  ` : `
                    <div style="font-size: 0.68rem; color: #64748b; margin-top: 2px;">
                      No save data recorded
                    </div>
                  `}
                </div>

                <div style="display:flex; gap:6px; margin-top: 8px;">
                  <button class="btn-slot-save" data-slot="${slotNum}" style="
                    flex: 1;
                    background: #0284c7;
                    border: none;
                    color: white;
                    padding: 5px;
                    border-radius: 4px;
                    font-size: 0.72rem;
                    font-weight: 700;
                    cursor: pointer;
                  ">💾 ${save ? 'Overwrite' : 'Save Slot'}</button>
                  ${save ? `
                    <button class="btn-slot-export" data-slot="${slotNum}" style="
                      background: rgba(255,255,255,0.08);
                      border: 1px solid rgba(255,255,255,0.15);
                      color: #e2e8f0;
                      padding: 5px 8px;
                      border-radius: 4px;
                      font-size: 0.7rem;
                      cursor: pointer;
                    " title="Export .questsave file">📥</button>
                  ` : ''}
                </div>
              </div>
            `;
    }).join('')}
        </div>
      </div>
    `;
  }

  private renderLoadView(): string {
    const slots = SaveSystem.getInstance().getSavedSlots();
    const hasAnySave = slots.some(s => s !== null);

    return `
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 4px;">
          <span style="font-size: 0.78rem; color: #94a3b8;">Choose a saved game to restore:</span>
          <label style="
            background: rgba(168, 85, 247, 0.2);
            border: 1px solid #a855f7;
            color: #e9d5ff;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 0.7rem;
            font-weight: 700;
            cursor: pointer;
          ">
            📤 Import File...
            <input type="file" id="input-import-save" accept=".questsave,.json" style="display:none;" />
          </label>
        </div>

        ${!hasAnySave ? `
          <div style="padding: 30px; text-align: center; color: #64748b; font-size: 0.85rem; background: rgba(0,0,0,0.2); border-radius: 8px;">
            📭 No saved games found. Use <b>Save Game</b> to create your first save slot!
          </div>
        ` : `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            ${slots.map((save, idx) => {
      const slotNum = idx + 1;
      if (!save) {
        return `
                  <div style="
                    background: rgba(30, 41, 59, 0.4);
                    border: 1px dashed rgba(255, 255, 255, 0.08);
                    border-radius: 8px;
                    padding: 10px;
                    min-height: 100px;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    color: #64748b;
                    font-size: 0.75rem;
                  ">
                    <span>Slot ${slotNum} (Empty)</span>
                  </div>
                `;
      }

      return `
                <div class="load-slot-card" style="
                  background: rgba(30, 41, 59, 0.85);
                  border: 1px solid rgba(168, 85, 247, 0.4);
                  border-radius: 8px;
                  padding: 10px;
                  display: flex;
                  flex-direction: column;
                  justify-content: space-between;
                  min-height: 100px;
                ">
                  <div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                      <span style="font-size: 0.75rem; font-weight: 800; color: #c084fc;">SLOT ${slotNum}</span>
                      <span style="font-size: 0.65rem; color: #94a3b8;">${save.dateFormatted}</span>
                    </div>

                    <div style="font-size: 0.82rem; font-weight: 700; color: #f8fafc; margin-top: 4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                      ${save.sceneName}
                    </div>

                    <div style="font-size: 0.68rem; color: #94a3b8; margin-top: 2px;">
                      📍 ${save.chapterTitle} | 🎒 ${save.inventoryItemIds.length} items
                    </div>
                  </div>

                  <div style="display:flex; gap:6px; margin-top: 8px;">
                    <button class="btn-slot-load" data-slot="${slotNum}" style="
                      flex: 1;
                      background: #9333ea;
                      border: none;
                      color: white;
                      padding: 5px;
                      border-radius: 4px;
                      font-size: 0.72rem;
                      font-weight: 700;
                      cursor: pointer;
                    ">📂 Load Slot</button>
                    <button class="btn-slot-delete" data-slot="${slotNum}" style="
                      background: rgba(239, 68, 68, 0.15);
                      border: 1px solid rgba(239, 68, 68, 0.3);
                      color: #ef4444;
                      padding: 5px 8px;
                      border-radius: 4px;
                      font-size: 0.7rem;
                      cursor: pointer;
                    " title="Delete Save">🗑️</button>
                  </div>
                </div>
              `;
    }).join('')}
          </div>
        `}
      </div>
    `;
  }

  private renderSettingsView(): string {
    const audio = AudioSystem.getInstance();
    const config = audio.getConfig();
    const uiConfig = UISystem.getInstance().getConfig();

    return `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <!-- Audio Volume Controls -->
        <div style="background: rgba(0,0,0,0.25); padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06);">
          <div style="font-size: 0.8rem; font-weight: 800; color: #fbbf24; margin-bottom: 10px;">🔊 Audio Volumes</div>
          
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <div>
              <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:#e2e8f0; margin-bottom:2px;">
                <span>Master Volume:</span>
                <span id="label-vol-master">${Math.round(config.masterVolume * 100)}%</span>
              </div>
              <input type="range" id="slider-vol-master" min="0" max="1" step="0.05" value="${config.masterVolume}" style="width:100%; accent-color:#fbbf24; cursor:pointer;" />
            </div>

            <div>
              <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:#e2e8f0; margin-bottom:2px;">
                <span>Music Volume:</span>
                <span id="label-vol-music">${Math.round(config.musicVolume * 100)}%</span>
              </div>
              <input type="range" id="slider-vol-music" min="0" max="1" step="0.05" value="${config.musicVolume}" style="width:100%; accent-color:#38bdf8; cursor:pointer;" />
            </div>

            <div>
              <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:#e2e8f0; margin-bottom:2px;">
                <span>Sound Effects (SFX):</span>
                <span id="label-vol-sfx">${Math.round(config.sfxVolume * 100)}%</span>
              </div>
              <input type="range" id="slider-vol-sfx" min="0" max="1" step="0.05" value="${config.sfxVolume}" style="width:100%; accent-color:#22c55e; cursor:pointer;" />
            </div>

            <div>
              <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:#e2e8f0; margin-bottom:2px;">
                <span>Voiceovers:</span>
                <span id="label-vol-voice">${Math.round(config.voiceVolume * 100)}%</span>
              </div>
              <input type="range" id="slider-vol-voice" min="0" max="1" step="0.05" value="${config.voiceVolume}" style="width:100%; accent-color:#c084fc; cursor:pointer;" />
            </div>
          </div>
        </div>

        <!-- UI & Display Controls -->
        <div style="background: rgba(0,0,0,0.25); padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06);">
          <div style="font-size: 0.8rem; font-weight: 800; color: #fbbf24; margin-bottom: 10px;">🖥️ Interface & Display</div>

          <div style="display: flex; flex-direction: column; gap: 10px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <label style="font-size:0.75rem; color:#e2e8f0;">UI Interaction Preset:</label>
              <select id="select-ui-preset" style="
                background: #0f172a;
                border: 1px solid rgba(255,255,255,0.2);
                color: #f8fafc;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 0.75rem;
                outline: none;
                cursor: pointer;
              ">
                <option value="direct_cursor" ${uiConfig.preset === 'direct_cursor' ? 'selected' : ''}>🎯 Direct Cursor (Modern)</option>
                <option value="lucasarts" ${uiConfig.preset === 'lucasarts' ? 'selected' : ''}>📜 LucasArts 9-Verb Classic</option>
                <option value="sierra" ${uiConfig.preset === 'sierra' ? 'selected' : ''}>👑 Sierra Top-Bar Icon Style</option>
                <option value="context_coin" ${uiConfig.preset === 'context_coin' ? 'selected' : ''}>🪙 Context Coin Radial</option>
              </select>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center;">
              <label style="font-size:0.75rem; color:#e2e8f0;">Show Action Sentence Banner:</label>
              <input type="checkbox" id="chk-show-verb-text" ${uiConfig.showVerbText !== false ? 'checked' : ''} style="accent-color:#fbbf24; cursor:pointer; width:16px; height:16px;" />
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private renderRestartView(): string {
    const currentChapter = StoryGraphSystem.getInstance().getCurrentChapter();

    return `
      <div style="display: flex; flex-direction: column; gap: 14px; padding: 10px 0;">
        <div style="background: rgba(249, 115, 22, 0.12); border: 1px solid rgba(249, 115, 22, 0.4); border-radius: 8px; padding: 12px; font-size: 0.78rem; color: #fed7aa;">
          ⚠️ <b>Restarting</b> will reset story flags, inventory items, and character positions back to the initial state.
        </div>

        <button class="menu-action-btn" id="btn-restart-chapter" style="${this.getMainBtnStyle('#f59e0b')}">
          <span style="font-size: 1.25rem;">🔄</span>
          <div style="text-align: left; flex: 1;">
            <div style="font-weight: 700; font-size: 0.95rem; color: #f8fafc;">Restart Current Chapter</div>
            <div style="font-size: 0.7rem; color: #94a3b8;">Re-enter "${currentChapter?.title || 'Chapter 1'}" from its starting scene</div>
          </div>
        </button>

        <button class="menu-action-btn" id="btn-restart-all" style="${this.getMainBtnStyle('#ef4444')}">
          <span style="font-size: 1.25rem;">🏁</span>
          <div style="text-align: left; flex: 1;">
            <div style="font-weight: 700; font-size: 0.95rem; color: #f8fafc;">Restart Entire Quest from Beginning</div>
            <div style="font-size: 0.7rem; color: #94a3b8;">Reset all game progress and load the first chapter</div>
          </div>
        </button>
      </div>
    `;
  }

  private attachEvents(): void {
    // Close / Resume button
    this.element.querySelector('#btn-menu-close')?.addEventListener('click', () => {
      this.close();
    });

    // Back to main menu
    this.element.querySelector('#btn-menu-back')?.addEventListener('click', () => {
      this.switchView('main');
    });

    // --- MAIN VIEW ACTIONS ---
    this.element.querySelector('#btn-action-resume')?.addEventListener('click', () => {
      this.close();
    });

    this.element.querySelector('#btn-action-save')?.addEventListener('click', () => {
      this.switchView('save');
    });

    this.element.querySelector('#btn-action-load')?.addEventListener('click', () => {
      this.switchView('load');
    });

    this.element.querySelector('#btn-action-settings')?.addEventListener('click', () => {
      this.switchView('settings');
    });

    this.element.querySelector('#btn-action-restart')?.addEventListener('click', () => {
      this.switchView('restart');
    });

    // --- SAVE VIEW ACTIONS ---
    this.element.querySelectorAll('.btn-slot-save').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const slot = (e.currentTarget as HTMLElement).dataset.slot!;
        EventBus.getInstance().emit('game:request_save', { slotId: parseInt(slot, 10) });
        this.render();
      });
    });

    this.element.querySelectorAll('.btn-slot-export').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const slot = (e.currentTarget as HTMLElement).dataset.slot!;
        SaveSystem.getInstance().exportSaveFile(parseInt(slot, 10));
      });
    });

    // --- LOAD VIEW ACTIONS ---
    this.element.querySelectorAll('.btn-slot-load').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const slot = (e.currentTarget as HTMLElement).dataset.slot!;
        const save = SaveSystem.getInstance().getSaveBySlot(parseInt(slot, 10));
        if (save) {
          this.close();
          EventBus.getInstance().emit('game:request_load', save);
        }
      });
    });

    this.element.querySelectorAll('.btn-slot-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const slot = (e.currentTarget as HTMLElement).dataset.slot!;
        if (confirm(`Delete Save Slot ${slot}?`)) {
          SaveSystem.getInstance().deleteSave(parseInt(slot, 10));
          this.render();
        }
      });
    });

    // Import save file
    const fileInput = this.element.querySelector('#input-import-save') as HTMLInputElement;
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (re) => {
            const text = re.target?.result as string;
            const imported = SaveSystem.getInstance().importSaveFromJSON(text);
            if (imported) {
              this.close();
              EventBus.getInstance().emit('game:request_load', imported);
            }
          };
          reader.readAsText(file);
        }
      });
    }

    // --- SETTINGS VIEW ACTIONS ---
    const audio = AudioSystem.getInstance();

    const sliderMaster = this.element.querySelector('#slider-vol-master') as HTMLInputElement;
    const labelMaster = this.element.querySelector('#label-vol-master');
    if (sliderMaster) {
      sliderMaster.addEventListener('input', () => {
        const val = parseFloat(sliderMaster.value);
        audio.setMasterVolume(val);
        if (labelMaster) labelMaster.textContent = `${Math.round(val * 100)}%`;
      });
    }

    const sliderMusic = this.element.querySelector('#slider-vol-music') as HTMLInputElement;
    const labelMusic = this.element.querySelector('#label-vol-music');
    if (sliderMusic) {
      sliderMusic.addEventListener('input', () => {
        const val = parseFloat(sliderMusic.value);
        audio.setMusicVolume(val);
        if (labelMusic) labelMusic.textContent = `${Math.round(val * 100)}%`;
      });
    }

    const sliderSFX = this.element.querySelector('#slider-vol-sfx') as HTMLInputElement;
    const labelSFX = this.element.querySelector('#label-vol-sfx');
    if (sliderSFX) {
      sliderSFX.addEventListener('input', () => {
        const val = parseFloat(sliderSFX.value);
        audio.setSFXVolume(val);
        if (labelSFX) labelSFX.textContent = `${Math.round(val * 100)}%`;
      });
    }

    const sliderVoice = this.element.querySelector('#slider-vol-voice') as HTMLInputElement;
    const labelVoice = this.element.querySelector('#label-vol-voice');
    if (sliderVoice) {
      sliderVoice.addEventListener('input', () => {
        const val = parseFloat(sliderVoice.value);
        audio.setVoiceVolume(val);
        if (labelVoice) labelVoice.textContent = `${Math.round(val * 100)}%`;
      });
    }

    const selectPreset = this.element.querySelector('#select-ui-preset') as HTMLSelectElement;
    if (selectPreset) {
      selectPreset.addEventListener('change', () => {
        const preset = selectPreset.value as UIPresetType;
        UISystem.getInstance().setPreset(preset);
      });
    }

    const chkVerbText = this.element.querySelector('#chk-show-verb-text') as HTMLInputElement;
    if (chkVerbText) {
      chkVerbText.addEventListener('change', () => {
        const uiConfig = UISystem.getInstance().getConfig();
        uiConfig.showVerbText = chkVerbText.checked;
        const banner = document.querySelector('#ui-action-sentence');
        if (banner) (banner as HTMLElement).style.display = chkVerbText.checked ? '' : 'none';
      });
    }

    // --- RESTART VIEW ACTIONS ---
    this.element.querySelector('#btn-restart-chapter')?.addEventListener('click', () => {
      if (confirm('Restart current chapter? Any unsaved progress in this chapter will be reset.')) {
        this.close();
        EventBus.getInstance().emit('game:restart_chapter');
      }
    });

    this.element.querySelector('#btn-restart-all')?.addEventListener('click', () => {
      if (confirm('Restart entire quest from the beginning? All unsaved game progress will be reset.')) {
        this.close();
        EventBus.getInstance().emit('game:restart_all');
      }
    });
  }

  public destroy(): void {
    this.element.remove();
  }
}
