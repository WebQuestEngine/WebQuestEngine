import { ProjectData, UIPresetType } from '../engine/types';
import { EditorCanvas } from './canvas/EditorCanvas';
import { GameRuntime } from '../engine/runtime/GameRuntime';
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

  private editorCanvas: EditorCanvas | null = null;
  private gameRuntime: GameRuntime | null = null;
  private viewportElement: HTMLElement | null = null;
  private pristineProjectJson: string = '';

  constructor(container: HTMLElement, initialProject: ProjectData) {
    this.container = container;
    this.project = initialProject;

    this.toolbar = new Toolbar();
    this.inspector = new Inspector();
    this.treeView = new ProjectTreeView();
    this.zoomWidget = new ZoomWidget();
    this.storyGraphView = new StoryGraphView();
    this.dialogEditor = new DialogEditor();

    HistoryManager.getInstance().init(this.project);
  }

  public async init(): Promise<void> {
    this.container.innerHTML = `
      <div id="toolbar-slot"></div>
      <div class="editor-main-layout">
        <div id="tree-slot"></div>
        <div id="viewport-slot" class="editor-viewport-container">
          <div id="canvas-container" class="editor-canvas-wrapper"></div>
          <div id="zoom-widget-slot"></div>
        </div>
        <div id="inspector-slot"></div>
      </div>
      <div id="story-graph-slot"></div>
      <div id="dialog-editor-slot"></div>
    `;

    this.container.querySelector('#toolbar-slot')?.appendChild(this.toolbar.element);
    this.container.querySelector('#tree-slot')?.appendChild(this.treeView.element);
    this.container.querySelector('#inspector-slot')?.appendChild(this.inspector.element);
    this.container.querySelector('#zoom-widget-slot')?.appendChild(this.zoomWidget.element);
    this.container.querySelector('#story-graph-slot')?.appendChild(this.storyGraphView.element);
    this.container.querySelector('#dialog-editor-slot')?.appendChild(this.dialogEditor.element);

    this.viewportElement = this.container.querySelector('#canvas-container');

    this.syncAllViews();
    this.attachEvents();
    this.attachKeyboardShortcuts();

    await this.startEditorCanvas();
  }

  private async startEditorCanvas(): Promise<void> {
    if (!this.viewportElement) return;

    if (this.editorCanvas) {
      this.editorCanvas.destroy();
      this.editorCanvas = null;
    }

    this.editorCanvas = new EditorCanvas(this.viewportElement, this.project);
    await this.editorCanvas.init();
  }

  private async startPlayRuntime(): Promise<void> {
    if (!this.viewportElement) return;

    // Save pristine master copy before entering play testing
    this.pristineProjectJson = ProjectSerializer.serialize(this.project);

    // Destroy editor canvas
    if (this.editorCanvas) {
      this.editorCanvas.destroy();
      this.editorCanvas = null;
    }

    // Spin up isolated GameRuntime with cloned project data
    const runtimeProject = ProjectSerializer.deserialize(this.pristineProjectJson);
    this.gameRuntime = new GameRuntime(this.viewportElement, runtimeProject);
    await this.gameRuntime.init();
  }

  private async stopPlayRuntime(): Promise<void> {
    // Destroy game runtime completely
    if (this.gameRuntime) {
      this.gameRuntime.destroy();
      this.gameRuntime = null;
    }

    // Restore pristine project master copy
    if (this.pristineProjectJson) {
      this.project = ProjectSerializer.deserialize(this.pristineProjectJson);
    }

    // Re-mount clean Editor Canvas
    await this.startEditorCanvas();
    this.syncAllViews();
    window.dispatchEvent(new Event('resize'));
  }

  private attachEvents(): void {
    // Record history snapshot on project updates
    EventBus.getInstance().on('editor:project_updated', () => {
      HistoryManager.getInstance().pushState(this.project);
      if (this.editorCanvas) {
        this.editorCanvas.setProject(this.project);
      }
    });

    // Undo action
    EventBus.getInstance().on('editor:undo', async () => {
      const restored = HistoryManager.getInstance().undo();
      if (restored) {
        this.project = restored;
        this.syncAllViews();
        await this.startEditorCanvas();
        this.showNotification('↩️ Undo executed');
      }
    });

    // Redo action
    EventBus.getInstance().on('editor:redo', async () => {
      const restored = HistoryManager.getInstance().redo();
      if (restored) {
        this.project = restored;
        this.syncAllViews();
        await this.startEditorCanvas();
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
          await this.startEditorCanvas();
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
      HistoryManager.getInstance().pushState(this.project);
      this.showNotification(`Interface layout set to: ${preset.toUpperCase()}`);
    });

    EventBus.getInstance().on('editor:toggle_story_graph', () => {
      this.storyGraphView.show();
    });

    EventBus.getInstance().on('editor:toggle_dialog_editor', () => {
      this.dialogEditor.show();
    });

    // Decoupled Mode Switching
    EventBus.getInstance().on('editor:mode_changed', async (data: { isPlayMode: boolean }) => {
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

        await this.startPlayRuntime();
      } else {
        document.body.classList.remove('play-mode-active');
        if (exitBar) exitBar.remove();

        await this.stopPlayRuntime();
        this.showNotification('⏪ Game reset to initial editor state.');
      }
    });

    EventBus.getInstance().on('editor:select_scene', async (sceneId: string) => {
      const targetScene = this.project.scenes.find(s => s.id === sceneId);
      if (targetScene && this.editorCanvas) {
        if (this.editorCanvas.currentScene?.data.id !== sceneId) {
          await this.editorCanvas.loadScene(targetScene);
        }
        this.inspector.setCurrentScene(targetScene);
      }
    });

    EventBus.getInstance().on('ui:notify', (message: string) => {
      this.showNotification(message);
    });
  }

  private syncAllViews(): void {
    this.treeView.setProject(this.project);
    this.storyGraphView.setProject(this.project);
    this.dialogEditor.setProject(this.project);
    const activeScene = this.project.scenes[0];
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

      // Global Ctrl+S / Cmd+S save shortcut
      if (ctrlOrCmd && e.key.toLowerCase() === 's') {
        e.preventDefault();
        e.stopPropagation();

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
          e.preventDefault();
          EventBus.getInstance().emit('editor:redo');
        } else {
          e.preventDefault();
          EventBus.getInstance().emit('editor:undo');
        }
      } else if (ctrlOrCmd && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        EventBus.getInstance().emit('editor:redo');
      }
    }, true);
  }

  private showNotification(text: string): void {
    const existing = document.querySelector('.editor-notification');
    if (existing) existing.remove();

    const notif = document.createElement('div');
    notif.className = 'editor-notification';
    notif.textContent = text;
    document.body.appendChild(notif);

    setTimeout(() => {
      notif.classList.add('fade-out');
      setTimeout(() => notif.remove(), 400);
    }, 2800);
  }
}
