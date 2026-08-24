import { ProjectData, UIPresetType } from '../engine/types';
import { Engine } from '../engine/core/Engine';
import { Toolbar } from './components/Toolbar';
import { Inspector } from './components/Inspector';
import { StoryGraphView } from './components/StoryGraphView';
import { DialogEditor } from './components/DialogEditor';
import { EventBus } from '../engine/core/EventBus';
import { FileAccessAdapter } from '../engine/storage/FileAccessAdapter';
import { ProjectSerializer } from '../engine/storage/ProjectSerializer';
import { UISystem } from '../engine/systems/UISystem';
import { InventorySystem } from '../engine/systems/InventorySystem';
import { StoryGraphSystem } from '../engine/systems/StoryGraphSystem';
import { DialogSystem } from '../engine/systems/DialogSystem';

export class EditorApp {
  private container: HTMLElement;
  private project: ProjectData;
  private toolbar: Toolbar;
  private inspector: Inspector;
  private storyGraphView: StoryGraphView;
  private dialogEditor: DialogEditor;
  private engine: Engine | null = null;
  private viewportElement: HTMLElement | null = null;

  constructor(container: HTMLElement, initialProject: ProjectData) {
    this.container = container;
    this.project = initialProject;

    this.toolbar = new Toolbar();
    this.inspector = new Inspector();
    this.storyGraphView = new StoryGraphView();
    this.dialogEditor = new DialogEditor();
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

    mainLayout.appendChild(this.viewportElement);
    mainLayout.appendChild(this.inspector.element);

    this.container.appendChild(mainLayout);

    // Modals
    this.container.appendChild(this.storyGraphView.element);
    this.container.appendChild(this.dialogEditor.element);

    // Set initial project data
    this.storyGraphView.setProject(this.project);
    this.dialogEditor.setProject(this.project);

    const initialScene = this.project.scenes.find(s => s.id === this.project.scenes[0].id);
    this.inspector.setProject(this.project, initialScene);

    // Attach EventBus handlers
    this.attachEvents();

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
    EventBus.getInstance().on('editor:open_file', async () => {
      const res = await FileAccessAdapter.openLocalProjectFile();
      if (res) {
        try {
          const loadedProject = ProjectSerializer.deserialize(res.content);
          this.project = loadedProject;
          this.storyGraphView.setProject(this.project);
          this.dialogEditor.setProject(this.project);
          this.inspector.setProject(this.project);
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
      const success = await FileAccessAdapter.saveLocalProjectFile(jsonStr, filename);
      if (success) {
        this.showNotification(`Saved project to local disk successfully.`);
      }
    });

    EventBus.getInstance().on('editor:change_preset', (preset: UIPresetType) => {
      this.project.uiConfig.preset = preset;
      UISystem.getInstance().setPreset(preset);
      this.showNotification(`Interface layout set to: ${preset.toUpperCase()}`);
    });

    EventBus.getInstance().on('editor:toggle_story_graph', () => {
      this.storyGraphView.show();
    });

    EventBus.getInstance().on('editor:toggle_dialog_editor', () => {
      this.dialogEditor.show();
    });

    EventBus.getInstance().on('editor:select_scene', (sceneId: string) => {
      const targetScene = this.project.scenes.find(s => s.id === sceneId);
      if (targetScene) {
        StoryGraphSystem.getInstance().changeScene(sceneId);
        this.inspector.setCurrentScene(targetScene);
      }
    });
  }

  private renderDialogOverlay(data: any): void {
    const existing = this.container.querySelector('.dialog-box-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'dialog-box-overlay';

    overlay.innerHTML = `
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

    this.container.appendChild(overlay);
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
