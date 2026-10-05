import { ProjectData, DialogTree } from '../../engine/types';
import { EventBus } from '../../engine/core/EventBus';
import { DialogEditorUtils } from './dialog/DialogEditorUtils';
import { GraphCanvasController } from './dialog/GraphCanvasController';
import { DialogEditorTemplate } from './dialog/templates/NodeViews.template';
import { ZoomWidget } from './ZoomWidget';
import { StoryboardViewController } from './dialog/StoryboardViewController';
import { DialogSequenceController } from './dialog/DialogSequenceController';

export class DialogEditor {
  public element: HTMLElement;
  public backdropElement: HTMLElement;
  private project: ProjectData | null = null;
  private selectedTreeId: string | null = null;
  private canvasController: GraphCanvasController;
  private zoomWidget: ZoomWidget;
  private storyboardController: StoryboardViewController;
  private sequenceController: DialogSequenceController;

  public viewMode: 'storyboard' | 'sequences' = 'sequences';
  public selectedSceneFilter: string = 'all';
  public activeSceneId: string | null = null;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'dialog-editor-container hidden';

    this.backdropElement = document.createElement('div');
    this.backdropElement.className = 'dialog-editor-backdrop hidden';
    this.backdropElement.addEventListener('click', () => this.hide());

    this.canvasController = new GraphCanvasController(this.element, {
      getActiveTree: () => this.getActiveTree(),
      onUpdate: () => EventBus.getInstance().emit('editor:project_updated'),
      onReRenderTree: () => this.renderCurrentView(),
      getViewMode: () => this.viewMode,
      onReRenderStoryboardWires: () => this.renderStoryboardWires()
    });

    this.zoomWidget = new ZoomWidget({
      onZoomIn: () => this.canvasController.zoomIn(),
      onZoomOut: () => this.canvasController.zoomOut(),
      onReset: () => this.canvasController.resetZoom(),
      onFit: () => this.canvasController.fitToNodes(),
      initialZoom: this.canvasController.zoomLevel
    });
    this.canvasController.setZoomWidget(this.zoomWidget);

    this.storyboardController = new StoryboardViewController(this.element, {
      getProject: () => this.project,
      getActiveSceneId: () => this.activeSceneId,
      setActiveSceneId: (id) => { this.activeSceneId = id; },
      getZoomLevel: () => this.canvasController.zoomLevel,
      panToSceneCard: (cardX, cardY) => {
        this.canvasController.panOffset.x = 250 - cardX * this.canvasController.zoomLevel;
        this.canvasController.panOffset.y = 150 - cardY * this.canvasController.zoomLevel;
        this.canvasController.updateTransform();
      },
      openSceneInSequenceView: (sceneId) => this.openSceneInSequenceView(sceneId),
      switchToSequence: (treeId, sceneId) => {
        this.selectedTreeId = treeId;
        if (sceneId) {
          this.selectedSceneFilter = sceneId;
          this.activeSceneId = sceneId;
        }
        this.switchViewMode('sequences');
      },
      closeEditor: () => this.hide()
    });

    this.sequenceController = new DialogSequenceController(this.element, {
      getProject: () => this.project,
      getSelectedTreeId: () => this.selectedTreeId,
      setSelectedTreeId: (id) => { this.selectedTreeId = id; },
      getSelectedSceneFilter: () => this.selectedSceneFilter,
      setSelectedSceneFilter: (filter) => { this.selectedSceneFilter = filter; },
      getActiveSceneId: () => this.activeSceneId,
      setActiveSceneId: (id) => { this.activeSceneId = id; },
      getCanvasController: () => this.canvasController,
      onRenderCurrentView: () => this.renderCurrentView(),
      onSwitchViewMode: (mode) => this.switchViewMode(mode)
    });

    this.render();

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.element.classList.contains('hidden')) {
        if (this.element.classList.contains('viewport-picking-active')) return;
        this.hide();
      }
    });

    EventBus.getInstance().on('editor:open_dialog_editor', (data?: { dialogId?: string; viewMode?: 'storyboard' | 'sequences'; sceneId?: string }) => {
      this.show(data);
    });
  }

  public setProject(project: ProjectData): void {
    this.project = project;
    if (this.project.scenes && this.project.scenes.length > 0 && !this.activeSceneId) {
      this.activeSceneId = this.project.scenes[0].id;
    }
    if (this.project.dialogs && this.project.dialogs.length > 0) {
      if (!this.selectedTreeId || !this.project.dialogs.some(d => d.id === this.selectedTreeId)) {
        this.selectedTreeId = this.project.dialogs[0].id;
      }
    }
    this.populateSceneDropdowns();
    this.renderCurrentView();
  }

  public selectTree(treeId: string): void {
    this.selectedTreeId = treeId;
    this.viewMode = 'sequences';
    this.renderCurrentView();
  }

  public show(options?: { viewMode?: 'storyboard' | 'sequences'; sceneId?: string; dialogId?: string }): void {
    if (!this.backdropElement.parentElement && this.element.parentElement) {
      this.element.parentElement.insertBefore(this.backdropElement, this.element);
    }
    this.backdropElement.classList.remove('hidden');
    this.element.classList.remove('hidden');

    if (options?.viewMode) {
      this.viewMode = options.viewMode;
    }
    if (options?.sceneId) {
      this.selectedSceneFilter = options.sceneId;
      this.activeSceneId = options.sceneId;
    }
    if (options?.dialogId) {
      this.selectedTreeId = options.dialogId;
      this.viewMode = 'sequences';
    }

    this.populateSceneDropdowns();
    this.renderCurrentView();
  }

  public hide(): void {
    this.canvasController.stopAutoPan();
    this.backdropElement.classList.add('hidden');
    this.element.classList.add('hidden');
  }

  public switchViewMode(mode: 'storyboard' | 'sequences'): void {
    this.viewMode = mode;
    this.renderCurrentView();
  }

  public getActiveTree(): DialogTree | null {
    return this.sequenceController.getActiveTree();
  }

  public populateSceneDropdowns(): void {
    this.sequenceController.populateSceneDropdowns();
  }

  public renderTreeListOnly(): void {
    this.sequenceController.renderTreeListOnly();
  }

  public renderStoryboardWires(): void {
    this.storyboardController.renderStoryboardWires();
  }

  public renderStoryboardView(): void {
    this.storyboardController.renderStoryboardView();
  }

  public renderSequenceView(): void {
    this.sequenceController.renderSequenceView();
  }

  public renderCurrentView(): void {
    if (!this.project) return;
    this.updateHeaderTabsUI();

    if (this.viewMode === 'storyboard') {
      this.storyboardController.renderStoryboardView();
    } else {
      this.sequenceController.renderSequenceView();
    }
  }

  private openSceneInSequenceView(sceneId: string): void {
    this.selectedSceneFilter = sceneId;
    this.activeSceneId = sceneId;
    const seqs = DialogEditorUtils.getSequencesForScene(this.project, sceneId);
    if (seqs.length > 0) {
      this.selectedTreeId = seqs[0].id;
    } else {
      this.selectedTreeId = this.project?.dialogs?.[0]?.id || null;
    }
    this.populateSceneDropdowns();
    this.switchViewMode('sequences');
  }

  private updateHeaderTabsUI(): void {
    const btnStoryboard = this.element.querySelector('#btn-tab-storyboard') as HTMLElement;
    const btnSequences = this.element.querySelector('#btn-tab-sequences') as HTMLElement;
    const nodeBtns = this.element.querySelector('#sequence-node-buttons') as HTMLElement;
    const backBtn = this.element.querySelector('#btn-back-to-storyboard') as HTMLElement;
    const treeHeaderBar = this.element.querySelector('#dialog-tree-header-bar') as HTMLElement;
    const storyboardHeaderBar = this.element.querySelector('#storyboard-header-bar') as HTMLElement;
    const sidebarTitle = this.element.querySelector('#panel-sidebar-title') as HTMLElement;
    const filterWrap = this.element.querySelector('#sequence-scene-filter-wrap') as HTMLElement;
    const addTreeBtn = this.element.querySelector('#btn-add-tree') as HTMLElement;

    if (this.viewMode === 'storyboard') {
      if (btnStoryboard) {
        btnStoryboard.style.background = 'var(--accent-gold)';
        btnStoryboard.style.color = '#000';
      }
      if (btnSequences) {
        btnSequences.style.background = 'transparent';
        btnSequences.style.color = 'var(--text-muted)';
      }
      if (nodeBtns) nodeBtns.style.display = 'none';
      if (backBtn) backBtn.style.display = 'none';
      if (treeHeaderBar) treeHeaderBar.style.display = 'none';
      if (storyboardHeaderBar) storyboardHeaderBar.style.display = 'flex';
      if (sidebarTitle) sidebarTitle.textContent = '🗺️ Storyboard Scenes';
      if (filterWrap) filterWrap.style.display = 'none';
      if (addTreeBtn) addTreeBtn.style.display = 'none';
    } else {
      if (btnStoryboard) {
        btnStoryboard.style.background = 'transparent';
        btnStoryboard.style.color = 'var(--text-muted)';
      }
      if (btnSequences) {
        btnSequences.style.background = '#38bdf8';
        btnSequences.style.color = '#000';
      }
      if (nodeBtns) nodeBtns.style.display = 'flex';
      if (backBtn) {
        backBtn.style.display = (this.selectedSceneFilter !== 'all') ? 'inline-block' : 'none';
      }
      if (treeHeaderBar) treeHeaderBar.style.display = 'flex';
      if (storyboardHeaderBar) storyboardHeaderBar.style.display = 'none';
      if (sidebarTitle) sidebarTitle.textContent = 'Sequence & Logic Graphs';
      if (filterWrap) filterWrap.style.display = 'flex';
      if (addTreeBtn) addTreeBtn.style.display = 'inline-block';
    }
  }

  private render(): void {
    this.element.innerHTML = DialogEditorTemplate.renderLayout();
    this.element.querySelector('#dialog-nodes-viewport')?.appendChild(this.zoomWidget.element);

    this.element.querySelector('#btn-close-dialog-editor')?.addEventListener('click', () => {
      this.hide();
    });

    // View switcher buttons
    this.element.querySelector('#btn-tab-storyboard')?.addEventListener('click', () => {
      this.switchViewMode('storyboard');
    });

    this.element.querySelector('#btn-tab-sequences')?.addEventListener('click', () => {
      this.switchViewMode('sequences');
    });

    this.element.querySelector('#btn-back-to-storyboard')?.addEventListener('click', () => {
      this.switchViewMode('storyboard');
    });

    // Initialize sequence controls and inputs
    this.sequenceController.initEventListeners();
    this.canvasController.initGlobalEvents();
  }
}
