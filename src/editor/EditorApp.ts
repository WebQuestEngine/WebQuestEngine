import { ProjectData, UIPresetType } from '../engine/types';
import { Engine } from '../engine/core/Engine';
import { Toolbar } from './components/Toolbar';
import { Inspector } from './components/Inspector';
import { ProjectTreeView } from './components/ProjectTreeView';
import { ZoomWidget } from './components/ZoomWidget';
import { StoryGraphView } from './components/StoryGraphView';
import { DialogEditor } from './components/DialogEditor';
import { EventBus } from '../engine/core/EventBus';
import { FileAccessAdapter } from '../engine/storage/FileAccessAdapter';
import { ProjectSerializer } from '../engine/storage/ProjectSerializer';
import { UISystem } from '../engine/systems/UISystem';
import { InventorySystem } from '../engine/systems/InventorySystem';
import { StoryGraphSystem } from '../engine/systems/StoryGraphSystem';
import { DialogSystem } from '../engine/systems/DialogSystem';
import { HistoryManager } from './HistoryManager';

export class EditorApp {
  private container: HTMLElement;
  private project: ProjectData;
  private toolbar: Toolbar;
  private inspector: Inspector;
  private treeView: ProjectTreeView;
  private zoomWidget: ZoomWidget;
  private storyGraphView: StoryGraphView;
  private dialogEditor: DialogEditor;
  private engine: Engine | null = null;
  private viewportElement: HTMLElement | null = null;

  constructor(container: HTMLElement, initialProject: ProjectData) {
    this.container = container;
    this.project = initialProject;

    this.toolbar = new Toolbar();
    this.inspector = new Inspector();
    this.treeView = new ProjectTreeView();
    this.zoomWidget = new ZoomWidget();
    this.storyGraphView = new StoryGraphView();
    this.dialogEditor = new DialogEditor();

    HistoryManager.getInstance().init(initialProject);
  }

  public async init(): Promise<void> {
    this.container.innerHTML = '';

    // Add Toolbar
    this.container.appendChild(this.toolbar.element);

    // Main layout
    const mainLayout = document.createElement('div');
    mainLayout.className = 'editor-main-layout';

    // Viewport Container
    this.viewportElement = document.createElement('div');
    this.viewportElement.className = 'editor-viewport-container';
    this.viewportElement.appendChild(this.zoomWidget.element);

    mainLayout.appendChild(this.treeView.element);
    mainLayout.appendChild(this.viewportElement);
    mainLayout.appendChild(this.inspector.element);

    this.container.appendChild(mainLayout);

    // Modals
    this.container.appendChild(this.storyGraphView.element);
    this.container.appendChild(this.dialogEditor.element);

    // Set initial project data
    this.treeView.setProject(this.project);
    this.storyGraphView.setProject(this.project);
    this.dialogEditor.setProject(this.project);

    const initialScene = this.project.scenes.find(s => s.id === this.project.scenes[0].id);
    this.inspector.setProject(this.project, initialScene);

    // Attach EventBus handlers
    this.attachEvents();

    // Attach Keyboard Shortcuts (Ctrl+Z / Cmd+Z, Ctrl+Y / Cmd+Shift+Z)
    this.attachKeyboardShortcuts();

    // Start Engine
    await this.startEngine();
  }

  private async startEngine(): Promise<void> {
    if (!this.viewportElement) return;
    if (this.engine) {
      this.engine.destroy();
    }

    this.engine = new Engine(this.viewportElement);
    await this.engine.init(this.project);

    // Populate inventory UI with items if available
    EventBus.getInstance().on('inventory:updated', (items: any[]) => {
      UISystem.getInstance().renderInventoryItems(items);
    });

    // Dialog start handler
    EventBus.getInstance().on('dialog:node', (data: any) => {
      this.renderDialogOverlay(data);
    });

    EventBus.getInstance().on('dialog:end', () => {
      const existing = this.container.querySelector('.dialog-box-overlay');
      if (existing) existing.remove();
    });

    // In-game notification banner
    EventBus.getInstance().on('ui:notify', (msg: string) => {
      this.showNotification(msg);
    });
  }

  private attachEvents(): void {
    // Record history snapshot on project updates
    EventBus.getInstance().on('editor:project_updated', () => {
      HistoryManager.getInstance().pushState(this.project);
    });

    // Undo action
    EventBus.getInstance().on('editor:undo', async () => {
      const restored = HistoryManager.getInstance().undo();
      if (restored) {
        this.project = restored;
        this.syncAllViews();
        await this.startEngine();
        this.showNotification('↩️ Undo executed');
      }
    });

    // Redo action
    EventBus.getInstance().on('editor:redo', async () => {
      const restored = HistoryManager.getInstance().redo();
      if (restored) {
        this.project = restored;
        this.syncAllViews();
        await this.startEngine();
        this.showNotification('↪️ Redo executed');
      }
    });

    EventBus.getInstance().on('editor:open_file', async () => {
      const res = await FileAccessAdapter.openLocalProjectFile();
      if (res) {
        try {
          const loadedProject = ProjectSerializer.deserialize(res.content);
          this.project = loadedProject;
          HistoryManager.getInstance().init(loadedProject);
          this.syncAllViews();
          await this.startEngine();
          this.showNotification(`Loaded project: "${loadedProject.title}" from local file system`);
        } catch (err: any) {
          alert(`Failed to parse project file: ${err.message}`);
        }
      }
    });

    EventBus.getInstance().on('editor:save_file', async () => {
      const jsonStr = ProjectSerializer.serialize(this.project);
      const filename = `${this.project.title.toLowerCase().replace(/\s+/g, '_')}.json`;
      const success = await FileAccessAdapter.saveProjectFile(jsonStr, filename);
      if (success) {
        const activeName = FileAccessAdapter.getActiveFilename() || filename;
        this.showNotification(`💾 Saved project to "${activeName}" successfully.`);
      }
    });

    EventBus.getInstance().on('editor:save_file_as', async () => {
      const jsonStr = ProjectSerializer.serialize(this.project);
      const filename = `${this.project.title.toLowerCase().replace(/\s+/g, '_')}.json`;
      const success = await FileAccessAdapter.saveProjectFileAs(jsonStr, filename);
      if (success) {
        const activeName = FileAccessAdapter.getActiveFilename() || filename;
        this.showNotification(`💾 Saved project as "${activeName}" successfully.`);
      }
    });

    EventBus.getInstance().on('editor:change_preset', (preset: UIPresetType) => {
      this.project.uiConfig.preset = preset;
      UISystem.getInstance().setPreset(preset);
      HistoryManager.getInstance().pushState(this.project);
      this.showNotification(`Interface layout set to: ${preset.toUpperCase()}`);
    });

    EventBus.getInstance().on('editor:toggle_story_graph', () => {
      this.storyGraphView.show();
    });

    EventBus.getInstance().on('editor:toggle_dialog_editor', () => {
      this.dialogEditor.show();
    });

    EventBus.getInstance().on('editor:mode_changed', (data: { isPlayMode: boolean }) => {
      let exitBar = document.querySelector('.play-mode-exit-bar');

      if (data.isPlayMode) {
        document.body.classList.add('play-mode-active');
        if (!exitBar) {
          exitBar = document.createElement('div');
          exitBar.className = 'play-mode-exit-bar';
          exitBar.innerHTML = `
            <button class="btn btn-gold" id="btn-exit-play-bar" style="font-weight: 700;">✏️ Exit to Editor (Esc)</button>
          `;
          exitBar.querySelector('#btn-exit-play-bar')?.addEventListener('click', () => {
            EventBus.getInstance().emit('editor:mode_changed', { isPlayMode: false });
          });
          document.body.appendChild(exitBar);
        }
      } else {
        document.body.classList.remove('play-mode-active');
        if (exitBar) exitBar.remove();
        this.syncAllViews();
        window.dispatchEvent(new Event('resize'));
      }
    });

    EventBus.getInstance().on('editor:select_scene', (sceneId: string) => {
      const targetScene = this.project.scenes.find(s => s.id === sceneId);
      if (targetScene) {
        StoryGraphSystem.getInstance().changeScene(sceneId);
        this.inspector.setCurrentScene(targetScene);
      }
    });
  }

  private syncAllViews(): void {
    this.treeView.setProject(this.project);
    this.storyGraphView.setProject(this.project);
    this.dialogEditor.setProject(this.project);
    const activeScene = StoryGraphSystem.getInstance().getCurrentScene() || this.project.scenes[0];
    this.inspector.setProject(this.project, activeScene);
  }

  private attachKeyboardShortcuts(): void {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.body.classList.contains('play-mode-active')) {
        EventBus.getInstance().emit('editor:mode_changed', { isPlayMode: false });
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

      // Global Ctrl+S / Cmd+S save shortcut (works everywhere regardless of focused element)
      if (ctrlOrCmd && e.key.toLowerCase() === 's') {
        e.preventDefault();
        e.stopPropagation();

        // Commit active input value if currently focused on an input element
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }

        if (e.shiftKey) {
          EventBus.getInstance().emit('editor:save_file_as');
        } else {
          EventBus.getInstance().emit('editor:save_file');
        }
        return;
      }

      // Don't trigger undo/redo if typing inside text input or textarea
      const targetTag = (e.target as HTMLElement)?.tagName;
      if (targetTag === 'INPUT' || targetTag === 'TEXTAREA') return;

      if (ctrlOrCmd && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          // Redo: Ctrl+Shift+Z / Cmd+Shift+Z
          e.preventDefault();
          EventBus.getInstance().emit('editor:redo');
        } else {
          // Undo: Ctrl+Z / Cmd+Z
          e.preventDefault();
          EventBus.getInstance().emit('editor:undo');
        }
      } else if (ctrlOrCmd && e.key.toLowerCase() === 'y') {
        // Redo: Ctrl+Y
        e.preventDefault();
        EventBus.getInstance().emit('editor:redo');
      }
    }, true);
  }

  private renderDialogOverlay(data: any): void {
    const parent = this.viewportElement || this.container;
    const existing = parent.querySelector('.dialog-box-overlay');
    if (existing) existing.remove();

    // Check character screen position for in-world speech bubble positioning
    const screenPos = this.engine ? this.engine.getCharacterScreenPos(data.speaker) : null;

    const overlay = document.createElement('div');
    overlay.className = `dialog-box-overlay ${screenPos ? 'in-world-bubble' : ''}`;

    if (screenPos) {
      overlay.style.left = `${screenPos.x}px`;
      overlay.style.top = `${screenPos.y}px`;
      overlay.style.transform = 'translate(-50%, -100%)';
      overlay.style.bottom = 'auto';
    }

    overlay.innerHTML = `
      ${data.portraitUrl ? `<img src="${data.portraitUrl}" class="dialog-portrait" onError="this.style.display='none'" />` : ''}
      <div class="dialog-content">
        <div class="dialog-speaker">${data.speaker}</div>
        <div class="dialog-text">${data.text}</div>
        ${data.choices && data.choices.length > 0 ? `
          <div class="dialog-choices">
            ${data.choices.map((c: any) => `
              <button class="dialog-choice-btn" data-choiceid="${c.id}">${c.text}</button>
            `).join('')}
          </div>
        ` : (data.hasNext ? `<button class="btn btn-primary" id="btn-dlg-next">Continue ➔</button>` : `<button class="btn btn-primary" id="btn-dlg-end">Close</button>`)}
      </div>
    `;

    overlay.querySelectorAll('.dialog-choice-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.choiceid!;
        DialogSystem.getInstance().selectChoice(id, (flag) => StoryGraphSystem.getInstance().getFlag(flag));
      });
    });

    overlay.querySelector('#btn-dlg-next')?.addEventListener('click', () => {
      DialogSystem.getInstance().advanceNextNode((flag) => StoryGraphSystem.getInstance().getFlag(flag));
    });

    overlay.querySelector('#btn-dlg-end')?.addEventListener('click', () => {
      DialogSystem.getInstance().endDialog();
    });

    parent.appendChild(overlay);
  }

  private showNotification(text: string): void {
    const banner = document.createElement('div');
    banner.style.cssText = `
      position: absolute;
      top: 64px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(15, 23, 42, 0.95);
      border: 1px solid var(--accent-gold);
      color: var(--accent-gold);
      padding: 10px 20px;
      border-radius: 20px;
      font-size: 0.9rem;
      font-weight: 600;
      z-index: 300;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
      pointer-events: none;
      animation: fadeIn 0.3s ease;
    `;
    banner.textContent = text;
    this.container.appendChild(banner);

    setTimeout(() => {
      banner.remove();
    }, 3500);
  }
}
