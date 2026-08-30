import { ProjectData, UIPresetType } from '../../engine/types';
import { EventBus } from '../../engine/core/EventBus';
import { ProjectSerializer } from '../../engine/storage/ProjectSerializer';
import { RecentProjectsManager, RecentProjectEntry } from '../../engine/storage/RecentProjectsManager';
import { FileAccessAdapter } from '../../engine/storage/FileAccessAdapter';
import alchemistSampleProject from '../../../demo/the_alchemist\'s_mystery.json';
import { ProjectHubModalTemplate } from './templates/ProjectHubModal.template';

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

    this.overlay.innerHTML = ProjectHubModalTemplate.render({
      activeTab: this.activeTab,
      selectedPreset: this.selectedPreset,
      recents,
      isSuppressed,
    });

    this.attachEvents(recents);
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
            FileAccessAdapter.setActiveFilename(file.name);
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
      const filename = "the_alchemist's_mystery.json";
      FileAccessAdapter.setActiveFilename(filename);
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
          const filename = entry.filename || `${entry.title.toLowerCase().replace(/\s+/g, '_')}.json`;
          FileAccessAdapter.setActiveFilename(filename);
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
