import { UIPresetType } from '../../../engine/types';
import { RecentProjectEntry } from '../../../engine/storage/RecentProjectsManager';
import { TemplateUtils } from '../../utils/TemplateUtils';
import modalHtml from './ProjectHubModal.html?raw';

export class ProjectHubModalTemplate {
  public static render(params: {
    activeTab: 'new' | 'open' | 'recents';
    selectedPreset: UIPresetType;
    recents: RecentProjectEntry[];
    isSuppressed: boolean;
  }): string {
    const { activeTab, selectedPreset, recents, isSuppressed } = params;

    let tabContentHtml = '';
    if (activeTab === 'new') {
      tabContentHtml = this.renderNewTab(selectedPreset);
    } else if (activeTab === 'open') {
      tabContentHtml = this.renderOpenTab();
    } else {
      tabContentHtml = this.renderRecentsTab(recents);
    }

    const footerButtonsHtml = activeTab === 'new'
      ? `<button class="btn btn-gold btn-hub-primary" id="btn-create-quest-confirm">
           ✨ Create & Open Quest
         </button>`
      : `<button class="btn" id="btn-footer-close">Close</button>`;

    return TemplateUtils.populate(modalHtml, {
      tabNewActive: activeTab === 'new' ? 'active' : '',
      tabOpenActive: activeTab === 'open' ? 'active' : '',
      tabRecentsActive: activeTab === 'recents' ? 'active' : '',
      recentsCount: recents.length,
      tabContentHtml,
      suppressChecked: isSuppressed ? 'checked' : '',
      footerButtonsHtml,
    });
  }

  private static renderNewTab(selectedPreset: UIPresetType): string {
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
          <div class="hub-preset-card ${selectedPreset === 'lucasarts' ? 'selected' : ''}" data-preset="lucasarts">
            <div class="preset-icon">📜</div>
            <div class="preset-name">LucasArts 9-Verb</div>
            <div class="preset-desc">Classic SCUMM 9-verb grid (Give, Open, Close, Pick Up, Look, Talk, Use, Push, Pull) + bottom inventory.</div>
          </div>

          <div class="hub-preset-card ${selectedPreset === 'sierra' ? 'selected' : ''}" data-preset="sierra">
            <div class="preset-icon">👑</div>
            <div class="preset-name">Sierra Icon Bar</div>
            <div class="preset-desc">Icon toolbar (Walk, Look, Hand, Talk) with clean fullscreen canvas and floating inventory.</div>
          </div>

          <div class="hub-preset-card ${selectedPreset === 'context_coin' ? 'selected' : ''}" data-preset="context_coin">
            <div class="preset-icon">🪙</div>
            <div class="preset-name">Context Coin</div>
            <div class="preset-desc">Radial action coin popping up on click/touch with primary object interactions.</div>
          </div>

          <div class="hub-preset-card ${selectedPreset === 'direct_cursor' ? 'selected' : ''}" data-preset="direct_cursor">
            <div class="preset-icon">🎯</div>
            <div class="preset-name">Direct Smart Cursor</div>
            <div class="preset-desc">Modern streamlined cursor with smart contextual verbs and hover highlights.</div>
          </div>
        </div>
      </div>
    `;
  }

  private static renderOpenTab(): string {
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

  private static renderRecentsTab(recents: RecentProjectEntry[]): string {
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
          ${TemplateUtils.renderList(recents, (entry) => `
            <div class="recent-item-card" data-projectid="${entry.id}">
              <div class="recent-item-info">
                <div class="recent-item-title-row">
                  <span class="recent-title">${TemplateUtils.escapeHtml(entry.title)}</span>
                  <span class="preset-tag">${entry.preset || 'lucasarts'}</span>
                </div>
                <div class="recent-meta">
                  <span>Author: <strong>${TemplateUtils.escapeHtml(entry.author || 'Creator')}</strong></span>
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
          `)}
        </div>
      </div>
    `;
  }

  private static formatTimeAgo(timestamp: number): string {
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
}
