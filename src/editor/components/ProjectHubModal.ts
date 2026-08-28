import { ProjectData, UIPresetType } from '../../engine/types';
import { EventBus } from '../../engine/core/EventBus';
import { ProjectSerializer } from '../../engine/storage/ProjectSerializer';
import { RecentProjectsManager, RecentProjectEntry } from '../../engine/storage/RecentProjectsManager';
import { FileAccessAdapter } from '../../engine/storage/FileAccessAdapter';
import alchemistSampleProject from '../../../demo/the_alchemist\'s_mystery.json';

const SUPPRESS_STARTUP_KEY = 'questforge_suppress_welcome_hub';

export class ProjectHubModal {
  private overlay: HTMLElement;
  private activeTab: 'new' | 'open' | 'recents' = 'new';
  private selectedPreset: UIPresetType = 'lucasarts';

  public static isStartupSuppressed(): boolean {
    try {
      return localStorage.getItem(SUPPRESS_STARTUP_KEY) === 'true';
    } catch {
      return false;
    }
  }

  public static setStartupSuppressed(suppressed: boolean): void {
    try {
      if (suppressed) {
        localStorage.setItem(SUPPRESS_STARTUP_KEY, 'true');
      } else {
        localStorage.removeItem(SUPPRESS_STARTUP_KEY);
      }
    } catch (err) {
      console.warn('Failed to save startup suppression preference', err);
    }
  }

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-backdrop project-hub-backdrop';
    this.overlay.style.display = 'none';
    this.overlay.style.zIndex = '10000';
    document.body.appendChild(this.overlay);

    this.attachGlobalDismiss();
  }

  public show(initialTab?: 'new' | 'open' | 'recents'): void {
    const recents = RecentProjectsManager.getRecentProjects();
    if (initialTab) {
      this.activeTab = initialTab;
    } else {
      this.activeTab = recents.length > 0 ? 'recents' : 'new';
    }

    this.render();
    this.overlay.style.display = 'flex';
    this.overlay.classList.add('active');

    const firstInput = this.overlay.querySelector('input[type="text"]') as HTMLInputElement;
    if (firstInput && this.activeTab === 'new') {
      setTimeout(() => firstInput.focus(), 80);
    }
  }

  public hide(): void {
    this.overlay.classList.remove('active');
    this.overlay.style.display = 'none';
  }

  private render(): void {
    const recents = RecentProjectsManager.getRecentProjects();
    const isSuppressed = ProjectHubModal.isStartupSuppressed();

    this.overlay.innerHTML = `
      <div class="modal-window project-hub-window" id="project-hub-window">
        <!-- Modal Header -->
        <div class="project-hub-header">
          <div class="project-hub-title-box">
            <span class="hub-logo-icon">🏰</span>
            <div>
              <div class="hub-title">QuestForge 2D Project Hub</div>
              <div class="hub-subtitle">Start a new adventure, open saved files, or resume recent quests</div>
            </div>
          </div>
          <button class="hub-close-btn" id="btn-hub-close" title="Close (Esc)">✕</button>
        </div>

        <!-- Navigation Tabs -->
        <div class="project-hub-nav">
          <button class="hub-nav-tab ${this.activeTab === 'new' ? 'active' : ''}" data-tab="new">
            ✨ Create New Quest
          </button>
          <button class="hub-nav-tab ${this.activeTab === 'open' ? 'active' : ''}" data-tab="open">
            📂 Open & Samples
          </button>
          <button class="hub-nav-tab ${this.activeTab === 'recents' ? 'active' : ''}" data-tab="recents">
            🕒 Recent Projects <span class="hub-badge">${recents.length}</span>
          </button>
        </div>

        <!-- Tab Content Area -->
        <div class="project-hub-body">
          ${this.renderTabContent(recents)}
        </div>

        <!-- Modal Footer Bar -->
        <div class="project-hub-footer">
          <label class="hub-checkbox-label">
            <input type="checkbox" id="chk-suppress-startup" ${isSuppressed ? 'checked' : ''} />
            <span>Don't show this on startup</span>
          </label>
          <div class="hub-footer-buttons">
            ${this.activeTab === 'new' ? `
              <button class="btn btn-gold btn-hub-primary" id="btn-create-quest-confirm">
                ✨ Create & Open Quest
              </button>
            ` : `
              <button class="btn" id="btn-footer-close">Close</button>
            `}
          </div>
        </div>
      </div>
    `;

    this.attachEvents(recents);
  }

  private renderTabContent(recents: RecentProjectEntry[]): string {
    if (this.activeTab === 'new') {
      return `
        <div class="hub-tab-pane">
          <div class="hub-form-grid">
            <div class="hub-form-group">
              <label class="hub-label">Quest Title</label>
              <input type="text" class="hub-input" id="input-new-quest-title" value="The Lost Relic" placeholder="e.g. Curse of Monkey Cavern" />
            </div>
            <div class="hub-form-group">
              <label class="hub-label">Author / Creator Name</label>
              <input type="text" class="hub-input" id="input-new-quest-author" value="Quest Creator" placeholder="e.g. Jane Doe" />
            </div>
          </div>

          <div class="hub-section-title">Select User Interface Preset:</div>
          <div class="hub-preset-grid">
            <div class="hub-preset-card ${this.selectedPreset === 'lucasarts' ? 'selected' : ''}" data-preset="lucasarts">
              <div class="preset-icon">📜</div>
              <div class="preset-name">LucasArts 9-Verb</div>
              <div class="preset-desc">Classic SCUMM 9-verb grid (Give, Open, Close, Pick Up, Look, Talk, Use, Push, Pull) + bottom inventory.</div>
            </div>

            <div class="hub-preset-card ${this.selectedPreset === 'sierra' ? 'selected' : ''}" data-preset="sierra">
              <div class="preset-icon">👑</div>
              <div class="preset-name">Sierra Icon Bar</div>
              <div class="preset-desc">Icon toolbar (Walk, Look, Hand, Talk) with clean fullscreen canvas and floating inventory.</div>
            </div>

            <div class="hub-preset-card ${this.selectedPreset === 'context_coin' ? 'selected' : ''}" data-preset="context_coin">
              <div class="preset-icon">🪙</div>
              <div class="preset-name">Context Coin</div>
              <div class="preset-desc">Radial action coin popping up on click/touch with primary object interactions.</div>
            </div>

            <div class="hub-preset-card ${this.selectedPreset === 'direct_cursor' ? 'selected' : ''}" data-preset="direct_cursor">
              <div class="preset-icon">🎯</div>
              <div class="preset-name">Direct Smart Cursor</div>
              <div class="preset-desc">Modern streamlined cursor with smart contextual verbs and hover highlights.</div>
            </div>
          </div>
        </div>
      `;
    }

    if (this.activeTab === 'open') {
      return `
        <div class="hub-tab-pane">
          <!-- Open File Options -->
          <div class="hub-open-row">
            <div class="hub-card-action" id="btn-trigger-file-open">
              <div class="hub-card-action-icon">📁</div>
              <div class="hub-card-action-title">Browse Local JSON File...</div>
              <div class="hub-card-action-desc">Open any exported QuestForge <code>.json</code> project file from your computer.</div>
              <button class="btn btn-primary" style="margin-top:12px; pointer-events:none;">Select File</button>
            </div>

            <div class="hub-card-action hub-dropzone" id="hub-drag-dropzone">
              <div class="hub-card-action-icon">📥</div>
              <div class="hub-card-action-title">Drag & Drop Project File</div>
              <div class="hub-card-action-desc">Drop any <code>.json</code> quest project directly into this box to load immediately.</div>
            </div>
          </div>

          <div class="hub-section-title" style="margin-top:24px;">Pre-built Sample Quests:</div>
          <div class="hub-sample-card" id="btn-load-sample-alchemist">
            <div class="sample-badge">Featured Demo</div>
            <div class="sample-header">
              <div class="sample-icon">⚗️</div>
              <div>
                <div class="sample-title">The Alchemist's Mystery</div>
                <div class="sample-author">By QuestEngine Team</div>
              </div>
            </div>
            <div class="sample-desc">
              A complete 2-chapter point & click quest featuring parallax backgrounds, interactive dialogue trees, inventory puzzles, and voice acting.
            </div>
            <div class="sample-stats">
              <span>📖 2 Chapters</span>
              <span>🏰 2 Scenes</span>
              <span>🎒 3 Items</span>
              <span>💬 Fully Voiced Dialogs</span>
            </div>
            <button class="btn btn-gold" style="align-self: flex-start; margin-top: 12px;">🏰 Load Sample Quest</button>
          </div>
        </div>
      `;
    }

    // Recent Projects Tab
    if (recents.length === 0) {
      return `
        <div class="hub-tab-pane" style="text-align: center; padding: 40px 20px;">
          <div style="font-size: 3rem; margin-bottom: 12px; opacity: 0.5;">🕒</div>
          <div style="font-size: 1.1rem; font-weight: 700; color: #f8fafc; margin-bottom: 6px;">No Recent Projects Found</div>
          <div style="font-size: 0.85rem; color: #94a3b8; max-width: 420px; margin: 0 auto 20px;">
            Projects you create, edit, or open will automatically appear here for quick access.
          </div>
          <button class="btn btn-gold" id="btn-empty-create-new">✨ Create Your First Quest</button>
        </div>
      `;
    }

    return `
      <div class="hub-tab-pane">
        <div class="recents-header-bar">
          <span style="font-size: 0.85rem; color: #94a3b8;">Recently opened and edited on this browser:</span>
          <button class="btn btn-sm" id="btn-clear-all-recents" style="font-size:0.75rem; color:#ef4444; border-color:rgba(239,68,68,0.3);">
            🗑️ Clear History
          </button>
        </div>

        <div class="recents-list">
          ${recents.map((entry) => `
            <div class="recent-item-card" data-projectid="${entry.id}">
              <div class="recent-item-info">
                <div class="recent-item-title-row">
                  <span class="recent-title">${this.escapeHtml(entry.title)}</span>
                  <span class="preset-tag">${entry.preset || 'lucasarts'}</span>
                </div>
                <div class="recent-meta">
                  <span>Author: <strong>${this.escapeHtml(entry.author || 'Creator')}</strong></span>
                  <span>•</span>
                  <span>Scenes: <strong>${entry.sceneCount}</strong></span>
                  <span>•</span>
                  <span>Items: <strong>${entry.itemCount}</strong></span>
                  <span>•</span>
                  <span>Last edited: <em>${this.formatTimeAgo(entry.lastModified)}</em></span>
                </div>
              </div>
              <div class="recent-item-actions">
                <button class="btn btn-gold btn-load-recent" data-projectid="${entry.id}">▶ Open</button>
                <button class="btn btn-del-action btn-remove-recent" data-projectid="${entry.id}" title="Remove from list">✕</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  private attachEvents(recents: RecentProjectEntry[]): void {
    // Prevent clicks inside modal window from closing the modal
    const modalWindow = this.overlay.querySelector('#project-hub-window');
    modalWindow?.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Close button
    this.overlay.querySelector('#btn-hub-close')?.addEventListener('click', () => {
      this.hide();
    });

    this.overlay.querySelector('#btn-footer-close')?.addEventListener('click', () => {
      this.hide();
    });

    // Startup suppression checkbox
    const suppressCheckbox = this.overlay.querySelector('#chk-suppress-startup') as HTMLInputElement;
    suppressCheckbox?.addEventListener('change', () => {
      ProjectHubModal.setStartupSuppressed(suppressCheckbox.checked);
    });

    // Tab navigation buttons
    this.overlay.querySelectorAll('.hub-nav-tab').forEach(tabBtn => {
      tabBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tabKey = (tabBtn as HTMLElement).dataset.tab as 'new' | 'open' | 'recents';
        if (tabKey) {
          this.activeTab = tabKey;
          this.render();
        }
      });
    });

    // Tab 1: Preset Card selection
    this.overlay.querySelectorAll('.hub-preset-card').forEach(card => {
      card.addEventListener('click', () => {
        const preset = (card as HTMLElement).dataset.preset as UIPresetType;
        if (preset) {
          this.selectedPreset = preset;
          this.overlay.querySelectorAll('.hub-preset-card').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
        }
      });
    });

    // Tab 1: Create Quest Confirm button
    this.overlay.querySelector('#btn-create-quest-confirm')?.addEventListener('click', () => {
      const titleInput = this.overlay.querySelector('#input-new-quest-title') as HTMLInputElement;
      const authorInput = this.overlay.querySelector('#input-new-quest-author') as HTMLInputElement;
      const title = titleInput?.value?.trim() || 'New Adventure Quest';
      const author = authorInput?.value?.trim() || 'Quest Creator';

      const newProject = ProjectSerializer.createStarterProject(title, author, this.selectedPreset);
      this.hide();
      EventBus.getInstance().emit('editor:load_project', newProject);
    });

    // Tab 2: Trigger file open
    this.overlay.querySelector('#btn-trigger-file-open')?.addEventListener('click', async () => {
      const res = await FileAccessAdapter.openLocalProjectFile();
      if (res) {
        try {
          const loadedProject = ProjectSerializer.deserialize(res.content);
          this.hide();
          EventBus.getInstance().emit('editor:load_project', loadedProject);
        } catch (err: any) {
          alert(`Failed to parse project file: ${err.message}`);
        }
      }
    });

    // Tab 2: Drag & Drop Zone
    const dropzone = this.overlay.querySelector('#hub-drag-dropzone') as HTMLElement;
    if (dropzone) {
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-over');
      });
      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('drag-over');
      });
      dropzone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        if (e.dataTransfer && e.dataTransfer.files.length > 0) {
          const file = e.dataTransfer.files[0];
          try {
            const content = await file.text();
            const loaded = ProjectSerializer.deserialize(content);
            this.hide();
            EventBus.getInstance().emit('editor:load_project', loaded);
          } catch (err: any) {
            alert(`Could not load dropped file: ${err.message}`);
          }
        }
      });
    }

    // Tab 2: Load Sample Alchemist Quest
    this.overlay.querySelector('#btn-load-sample-alchemist')?.addEventListener('click', () => {
      const sampleCopy = JSON.parse(JSON.stringify(alchemistSampleProject)) as ProjectData;
      this.hide();
      EventBus.getInstance().emit('editor:load_project', sampleCopy);
    });

    // Tab 3: Empty state create button
    this.overlay.querySelector('#btn-empty-create-new')?.addEventListener('click', () => {
      this.activeTab = 'new';
      this.render();
    });

    // Tab 3: Open recent project
    this.overlay.querySelectorAll('.btn-load-recent').forEach(btn => {
      btn.addEventListener('click', () => {
        const pId = (btn as HTMLElement).dataset.projectid;
        const entry = recents.find(r => r.id === pId);
        if (entry && entry.data) {
          this.hide();
          EventBus.getInstance().emit('editor:load_project', entry.data);
        }
      });
    });

    // Tab 3: Remove recent project
    this.overlay.querySelectorAll('.btn-remove-recent').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pId = (btn as HTMLElement).dataset.projectid;
        if (pId) {
          RecentProjectsManager.removeRecentProject(pId);
          this.render();
        }
      });
    });

    // Tab 3: Clear all recents
    this.overlay.querySelector('#btn-clear-all-recents')?.addEventListener('click', () => {
      if (confirm('Clear all recent project history?')) {
        RecentProjectsManager.clearAll();
        this.render();
      }
    });
  }

  private attachGlobalDismiss(): void {
    // Backdrop click dismiss (only when clicking directly on the backdrop outside the modal window)
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.hide();
      }
    });

    // Escape key listener
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.overlay.style.display !== 'none') {
        this.hide();
      }
    });
  }

  private formatTimeAgo(timestamp: number): string {
    if (!timestamp) return 'Recently';
    const elapsedSeconds = Math.floor((Date.now() - timestamp) / 1000);
    if (elapsedSeconds < 60) return 'Just now';
    const elapsedMinutes = Math.floor(elapsedSeconds / 60);
    if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
    const elapsedHours = Math.floor(elapsedMinutes / 60);
    if (elapsedHours < 24) return `${elapsedHours}h ago`;
    const elapsedDays = Math.floor(elapsedHours / 24);
    if (elapsedDays < 30) return `${elapsedDays}d ago`;
    return new Date(timestamp).toLocaleDateString();
  }

  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
