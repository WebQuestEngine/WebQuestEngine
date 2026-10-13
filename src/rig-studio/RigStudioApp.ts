import {
  AnatomicalJointDef,
  AnatomicalJointId,
  BonePartAttachment,
  JointToolMode,
  SpineDocument,
  StudioView,
  VectorOutlineElement,
  ViewArtworkData,
  RigProjectData,
  SavedElementsDocument
} from './types';
import { RigStudioBridge } from './RigStudioBridge';
import {
  ANATOMICAL_BONES,
  ANATOMICAL_JOINTS,
  DEFAULT_ENVELOPES,
  convertJointsToSpineBones,
  copyJointsFromFront,
  getDefaultJointPositions
} from './rigging/AnatomicalRig';
import { RigStudioCanvas } from './rigging/RigStudioCanvas';
import { VectorElementSlicer, SlicerToolMode } from './slicer/VectorElementSlicer';

export interface RigPartItem {
  id: string;
  name: string;
  imageUrl: string;
  image: HTMLImageElement;
  width: number;
  height: number;
  assignedBoneId?: AnatomicalJointId | null;
  pivotX?: number;
  pivotY?: number;
}

interface StudioHistoryState {
  description: string;
  view: StudioView;
  joints: Record<string, { x: number; y: number }>;
  envelopes: Record<string, number>;
  parts: Record<string, BonePartAttachment>;
  selectedJointId: AnatomicalJointId | null;
}

export class RigStudioApp {
  private container: HTMLElement;
  private bridge: RigStudioBridge;

  private characterName = 'Character';
  private activeStudioMode: 'rig' | 'slicer' = 'rig';
  private activeView: StudioView = 'front';
  private activeRightTab: 'bones' | 'parts' | 'layers' = 'bones';
  private partsLibrary: RigPartItem[] = [];

  // Slicer State
  private slicer: VectorElementSlicer | null = null;
  private slicerToolMode: SlicerToolMode = 'select';
  private slicerImage: HTMLImageElement | null = null;
  private slicerImageUrl: string = '';
  private slicerImageFileName: string = 'spritesheet.png';
  private slicerImageFileSize: string = '';
  private savedElements: VectorOutlineElement[] = [];

  private toolMode: JointToolMode = 'select';
  private symmetryEnabled = true;
  private showBonesEnabled = true;
  private showEnvelopesEnabled = true;

  // View state dictionary for Front, Back, Left Side, Right Side
  private views: Record<StudioView, ViewArtworkData> = {
    front: {
      viewId: 'front',
      label: 'Front',
      image: null,
      imageUrl: '',
      fileName: 'character_front.png',
      fileSize: '1.2 MB',
      joints: getDefaultJointPositions('front'),
      envelopes: { ...DEFAULT_ENVELOPES },
      parts: {},
      visible: true
    },
    back: {
      viewId: 'back',
      label: 'Back',
      image: null,
      imageUrl: '',
      fileName: 'character_back.png',
      fileSize: '1.2 MB',
      joints: getDefaultJointPositions('back'),
      envelopes: { ...DEFAULT_ENVELOPES },
      parts: {},
      visible: true
    },
    left: {
      viewId: 'left',
      label: 'Left Side',
      image: null,
      imageUrl: '',
      fileName: 'character_left.png',
      fileSize: '1.1 MB',
      joints: getDefaultJointPositions('left'),
      envelopes: { ...DEFAULT_ENVELOPES },
      parts: {},
      visible: true
    },
    right: {
      viewId: 'right',
      label: 'Right Side',
      image: null,
      imageUrl: '',
      fileName: 'character_right.png',
      fileSize: '1.1 MB',
      joints: getDefaultJointPositions('right'),
      envelopes: { ...DEFAULT_ENVELOPES },
      parts: {},
      visible: true
    }
  };

  private selectedJointId: AnatomicalJointId | null = null;
  private canvas: RigStudioCanvas | null = null;

  // Undo / Redo History Stack
  private undoStack: StudioHistoryState[] = [];
  private redoStack: StudioHistoryState[] = [];
  private readonly MAX_HISTORY_STEPS = 50;
  private isPerformingUndoRedo = false;

  constructor(container: HTMLElement) {
    this.container = container;
    this.bridge = new RigStudioBridge();

    this.renderLayout();
    this.initBridge();

    // In standalone mode, auto-load demo character if none loaded
    if (!this.bridge.isEmbeddedMode) {
      this.loadDemoCharacter();
    }
  }

  private initBridge(): void {
    this.bridge.onInit((data) => {
      if (data.characterName) {
        this.characterName = data.characterName;
      }
      if (data.textureUrl) {
        this.loadImageFromUrl(data.textureUrl, 'character_front.png', 'front');
      }
      this.updateHeaderTitle();
    });

    this.bridge.onSaveRequested(() => {
      this.saveRigToHost();
    });

    this.bridge.notifyReady();
  }

  private renderLayout(): void {
    this.container.innerHTML = `
      <header class="studio-header">
        <div class="studio-title-area">
          <span class="studio-title">Character Rig Studio</span>
        </div>

        <nav class="studio-views-bar">
          <button class="studio-view-btn active" data-view="front">Front</button>
          <button class="studio-view-btn" data-view="back">Back</button>
          <button class="studio-view-btn" data-view="left">Left Side</button>
          <button class="studio-view-btn" data-view="right">Right Side</button>
        </nav>

        <div class="studio-mode-switcher">
          <button class="studio-mode-btn ${this.activeStudioMode === 'rig' ? 'active' : ''}" data-mode="rig" title="Setup skeleton joints and pose bones">
            🦴 Rig & Bones
          </button>
          <button class="studio-mode-btn ${this.activeStudioMode === 'slicer' ? 'active' : ''}" data-mode="slicer" title="Load image, mark elements and assign them to bones">
            ✂️ Slicer & Element Marking
          </button>
        </div>

        <div class="studio-header-actions">
          <button class="btn-studio" id="btn-studio-undo" title="Undo last change (Ctrl+Z)" disabled style="opacity:0.4;">
            ↶ Undo
          </button>
          <button class="btn-studio" id="btn-studio-redo" title="Redo last change (Ctrl+Y)" disabled style="opacity:0.4;">
            ↷ Redo
          </button>
          <button class="btn-studio btn-load-demo" title="Load sample fully rigged character (Sir Ronald) with all bone graphics attached">
            ⚔️ Load Demo Rig
          </button>
          <label class="btn-studio" style="cursor:pointer;" title="Load a saved rigged character project with graphics (.json)">
            📂 Load Rig (.json)
            <input type="file" id="input-load-rig-json" accept=".json" style="display:none;" />
          </label>
          <label class="btn-studio" style="cursor:pointer;" title="Import graphics image from disk into active view">
            📁 Import Image
            <input type="file" id="input-graphic-upload" accept="image/*" style="display:none;" />
          </label>
          <button class="btn-studio btn-save-rig-json" title="Save complete character rig project with graphics (.json)">
            💾 Save Rig (.json)
          </button>
          <button class="btn-studio btn-export-spine" title="Export rig as Spine JSON">
            🦴 Export Spine
          </button>
          ${this.bridge.isEmbeddedMode ? `
            <button class="btn-studio btn-studio-primary btn-apply-host">
              ✓ Apply to Character
            </button>
            <button class="btn-studio btn-close-modal">✕</button>
          ` : `
            <button class="btn-studio btn-studio-primary btn-save-local">
              💾 Save Rig
            </button>
          `}
        </div>
      </header>

      <main class="studio-main">
        <!-- Hidden input for attaching individual bone parts -->
        <input type="file" id="input-part-upload" accept="image/*" style="display:none;" />
        <!-- Hidden input for batch uploading multiple parts -->
        <input type="file" id="input-batch-part-upload" multiple accept="image/*" style="display:none;" />
        <!-- Hidden input for importing library images -->
        <input type="file" id="input-library-files-upload" multiple accept="image/*" style="display:none;" />
        <!-- Hidden input for multi-part spritesheet auto-slicing -->
        <input type="file" id="input-spritesheet-upload" accept="image/*" style="display:none;" />
        <!-- Hidden input for loading image into slicer -->
        <input type="file" id="input-slicer-image-upload" accept="image/*" style="display:none;" />
        <!-- Hidden input for loading rig project JSON -->
        <input type="file" id="input-load-rig-json" accept=".json" style="display:none;" />

        <!-- Left Panel: Import & Joint Tools -->
        <aside class="studio-left-sidebar" id="left-sidebar">
          <!-- Dynamically updated -->
        </aside>

        <!-- Center Workspace Canvas -->
        <section class="studio-workspace" id="center-workspace" style="position:relative; overflow:hidden;">
          <!-- Viewport 1: Skeleton Rig Canvas -->
          <div id="rig-viewport-container" style="position:absolute; inset:0; display:block;">
            <div class="workspace-hud">
              <span>View: <b id="hud-active-view" style="color:#38bdf8;">FRONT</b></span>
              <span>Tool: <b id="hud-active-tool">SELECT</b></span>
              <button class="btn-hud-fit" id="btn-fit-view">Fit</button>
              <button class="btn-hud-fit" id="btn-reset-view">Center</button>
            </div>
            <!-- Floating WYSIWYG Alignment Toolbar for Selected Bone Graphic -->
            <div id="canvas-part-alignment-bar" class="canvas-part-alignment-bar" style="display:none;"></div>
          </div>

          <!-- Viewport 2: Element Slicer Canvas -->
          <div id="slicer-viewport-container" style="position:absolute; inset:0; display:none; flex-direction:column;">
            <div class="slicer-toolbar" id="slicer-toolbar">
              <div class="tool-group" style="display:flex; gap:4px; align-items:center;">
                <button class="slicer-tool-btn active" data-tool="select" title="Select Element / Drag Nodes (Del to delete)">↖️ Select</button>
                <button class="slicer-tool-btn" data-tool="magic" title="Magic Wand: Click opaque element to auto-trace contour">✨ Magic Contour</button>
                <button class="slicer-tool-btn" data-tool="polygon" title="Polygon: Click points around element, click first node to close">📐 Polygon</button>
                <button class="slicer-tool-btn" data-tool="split" title="Knife Split: Drag a cut line across an element">✂️ Split / Knife</button>
                <button class="slicer-tool-btn" data-tool="add_node" title="Add node on polygon edge">➕ Add Node</button>
                <button class="slicer-tool-btn" data-tool="delete_node" title="Delete clicked node">➖ Del Node</button>
                <button class="slicer-tool-btn" data-tool="pivot" title="Set rotation pivot anchor">🎯 Pivot</button>
                <button class="slicer-tool-btn" data-tool="pan" title="Pan workspace">✋ Pan</button>
              </div>
              <div style="width:1px; height:20px; background:rgba(255,255,255,0.15); margin:0 4px;"></div>
              <div class="tool-group" style="display:flex; gap:4px; align-items:center;">
                <button class="btn-studio btn-simplify-poly" style="font-size:0.68rem; padding:4px 6px;" title="Douglas-Peucker reduction">📉 Simplify</button>
                <button class="btn-studio btn-smooth-poly" style="font-size:0.68rem; padding:4px 6px;" title="Chaikin smooth corners">🌀 Smooth</button>
                <button class="btn-studio btn-subdivide-poly" style="font-size:0.68rem; padding:4px 6px;" title="Subdivide edges with midpoints">➗ Subdivide</button>
              </div>
              <div style="width:1px; height:20px; background:rgba(255,255,255,0.15); margin:0 4px;"></div>
              <div class="tool-group" style="display:flex; gap:4px; align-items:center;">
                <button class="btn-hud-fit" id="btn-slicer-fit">Fit</button>
                <button class="btn-hud-fit" id="btn-slicer-center">Center</button>
              </div>
              <div style="width:1px; height:20px; background:rgba(255,255,255,0.15); margin:0 4px;"></div>
              <div class="tool-group" style="display:flex; gap:4px; align-items:center;">
                <button class="btn-studio" id="btn-slicer-save-elements-toolbar" style="font-size:0.68rem; padding:4px 7px; color:#38bdf8;" title="Save marked elements as a .json file">💾 Save Elements</button>
                <label class="btn-studio" style="font-size:0.68rem; padding:4px 7px; color:#a855f7; cursor:pointer; margin:0;" title="Load marked elements from a .json file">
                  📂 Load Elements
                  <input type="file" id="input-load-elements-toolbar" accept=".json" style="display:none;" />
                </label>
              </div>
            </div>
            <div id="slicer-canvas-host" style="position:absolute; inset:42px 0 0 0; overflow:hidden;"></div>
            <div class="workspace-hud" id="slicer-hud" style="bottom:12px; left:12px;">
              <span>Marked Elements: <b id="hud-slicer-count" style="color:#10b981;">0</b></span>
              <span>Tool: <b id="hud-slicer-tool" style="color:#38bdf8;">SELECT</b></span>
            </div>
          </div>
        </section>

        <!-- Right Panel: Joints, Envelopes & Parts -->
        <aside class="studio-right-sidebar" id="right-sidebar">
          <!-- Dynamically updated -->
        </aside>
      </main>
    `;

    // Initialize Canvas in skeleton viewport container
    const rigViewportEl = this.container.querySelector('#rig-viewport-container') as HTMLElement;
    this.canvas = new RigStudioCanvas(rigViewportEl, {
      onJointSelected: (jointId) => {
        this.selectedJointId = jointId;
        this.renderRightSidebar();
        this.renderCanvasAlignmentBar();
      },
      onBeforeModification: (desc) => {
        this.recordHistory(desc);
      },
      onJointsModified: (joints) => {
        this.views[this.activeView].joints = { ...joints };
        this.updateUndoRedoButtons();
      },
      onPartModified: (boneId, part) => {
        this.views[this.activeView].parts[boneId] = part;
        this.updatePartInspectorValues(boneId, part);
        this.updateUndoRedoButtons();
      },
      onPartDroppedOnBone: (boneId, partData) => {
        this.attachPartToBone(boneId, partData);
      },
      onFileDroppedOnBone: (boneId, file) => {
        this.handlePartUpload(file, boneId);
      },
      onImageDropped: (file) => {
        this.handleFileUpload(file);
      }
    });

    this.bindDOMEvents();
    this.renderLeftSidebar();
    this.renderRightSidebar();
  }

  private bindDOMEvents(): void {
    // Undo & Redo Header Buttons
    this.container.querySelector('#btn-studio-undo')?.addEventListener('click', () => {
      this.undo();
    });
    this.container.querySelector('#btn-studio-redo')?.addEventListener('click', () => {
      this.redo();
    });

    // Global Undo / Redo Shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z / Cmd equivalents)
    window.addEventListener('keydown', (e) => {
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        if (isInput && (e.target as HTMLInputElement).type === 'text') return;
        e.preventDefault();
        if (e.shiftKey) {
          this.redo();
        } else {
          this.undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        if (isInput && (e.target as HTMLInputElement).type === 'text') return;
        e.preventDefault();
        this.redo();
      }
    });

    // Studio Mode Switcher (Rig vs Slicer)
    this.container.querySelectorAll('.studio-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-mode') as 'rig' | 'slicer';
        if (mode && mode !== this.activeStudioMode) {
          this.switchStudioMode(mode);
        }
      });
    });

    // View Switcher Buttons (Front, Back, Left Side, Right Side)
    this.container.querySelectorAll('.studio-view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const viewId = btn.getAttribute('data-view') as StudioView;
        if (viewId && viewId !== this.activeView) {
          this.switchView(viewId);
        }
      });
    });

    // Slicer Image Upload via file input
    const slicerFileInput = this.container.querySelector('#input-slicer-image-upload') as HTMLInputElement;
    slicerFileInput?.addEventListener('change', () => {
      if (slicerFileInput.files && slicerFileInput.files[0]) {
        this.handleSlicerImageUpload(slicerFileInput.files[0]);
        slicerFileInput.value = '';
      }
    });

    // File Upload via file input
    const fileInput = this.container.querySelector('#input-graphic-upload') as HTMLInputElement;
    fileInput?.addEventListener('change', () => {
      if (fileInput.files && fileInput.files[0]) {
        this.handleFileUpload(fileInput.files[0]);
        fileInput.value = '';
      }
    });

    // Bone Part Upload via dedicated part file input
    const partInput = this.container.querySelector('#input-part-upload') as HTMLInputElement;
    partInput?.addEventListener('change', () => {
      if (partInput.files && partInput.files[0] && this.selectedJointId) {
        this.handlePartUpload(partInput.files[0], this.selectedJointId);
        partInput.value = '';
      }
    });

    // Batch Parts Upload via multiple files input
    const batchPartInput = this.container.querySelector('#input-batch-part-upload') as HTMLInputElement;
    batchPartInput?.addEventListener('change', () => {
      if (batchPartInput.files && batchPartInput.files.length > 0) {
        this.handleBatchPartsUpload(batchPartInput.files);
        batchPartInput.value = '';
      }
    });

    // Parts Library Files Import
    const libFilesInput = this.container.querySelector('#input-library-files-upload') as HTMLInputElement;
    libFilesInput?.addEventListener('change', () => {
      if (libFilesInput.files && libFilesInput.files.length > 0) {
        this.handleLibraryFilesUpload(libFilesInput.files);
        libFilesInput.value = '';
      }
    });

    // Spritesheet Multi-Part Upload
    const sheetInput = this.container.querySelector('#input-spritesheet-upload') as HTMLInputElement;
    sheetInput?.addEventListener('change', () => {
      if (sheetInput.files && sheetInput.files[0]) {
        this.handleSpritesheetUpload(sheetInput.files[0]);
        sheetInput.value = '';
      }
    });

    // Load Demo Rigged Character button
    const demoBtn = this.container.querySelector('.btn-load-demo');
    demoBtn?.addEventListener('click', () => {
      this.loadDemoCharacter(true);
    });

    // Load Rig Project JSON input
    const loadRigInput = this.container.querySelector('#input-load-rig-json') as HTMLInputElement;
    loadRigInput?.addEventListener('change', () => {
      if (loadRigInput.files && loadRigInput.files[0]) {
        this.handleLoadRigJson(loadRigInput.files[0]);
        loadRigInput.value = '';
      }
    });

    // Save Rig Project JSON button
    const saveRigJsonBtn = this.container.querySelector('.btn-save-rig-json');
    saveRigJsonBtn?.addEventListener('click', () => {
      this.saveRigProjectJson();
    });

    // Export Spine JSON
    const exportBtn = this.container.querySelector('.btn-export-spine');
    exportBtn?.addEventListener('click', () => {
      this.exportSpineJson();
    });

    // Save Local or Apply to Host
    const saveBtn = this.container.querySelector('.btn-save-local');
    saveBtn?.addEventListener('click', () => {
      this.saveRigProjectJson();
    });

    const applyBtn = this.container.querySelector('.btn-apply-host');
    applyBtn?.addEventListener('click', () => {
      this.saveRigToHost();
    });

    const closeBtn = this.container.querySelector('.btn-close-modal');
    closeBtn?.addEventListener('click', () => {
      this.bridge.notifyClose();
    });

    // HUD buttons
    this.container.querySelector('#btn-fit-view')?.addEventListener('click', () => {
      this.canvas?.resetView();
    });
    this.container.querySelector('#btn-reset-view')?.addEventListener('click', () => {
      this.canvas?.resetView();
    });
  }

  public switchView(viewId: StudioView): void {
    // 1. Save all current view state from canvas before switching
    if (this.canvas) {
      this.views[this.activeView].joints = JSON.parse(JSON.stringify(this.canvas.getJoints()));
      this.views[this.activeView].envelopes = { ...this.canvas.getEnvelopes() };
      this.views[this.activeView].parts = { ...this.canvas.getParts() };
    }

    this.activeView = viewId;

    // Update active tab styles
    this.container.querySelectorAll('.studio-view-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-view') === viewId);
    });

    const hudView = this.container.querySelector('#hud-active-view');
    if (hudView) hudView.textContent = viewId.toUpperCase();

    const viewData = this.views[viewId];

    // If back view artwork is not loaded yet, check if demo back artwork is available
    if (viewId === 'back' && !viewData.image && this.views.front.image) {
      const demoBackUrl = '/demo/assets/characters/sir_ronald_back.png';
      this.loadImageFromUrl(demoBackUrl, 'character_back.png', 'back', false);
    }

    // Update Canvas with view's joints, envelopes, and attached parts
    if (this.canvas) {
      this.canvas.setView(viewId, viewData.joints, viewData.envelopes, viewData.parts);
      this.canvas.setSourceImage(viewData.image, viewData.fileName, false);
    }

    this.renderLeftSidebar();
    this.renderRightSidebar();
    this.renderCanvasAlignmentBar();
  }

  public switchStudioMode(mode: 'rig' | 'slicer'): void {
    this.activeStudioMode = mode;

    this.container.querySelectorAll('.studio-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-mode') === mode);
    });

    const rigViewport = this.container.querySelector('#rig-viewport-container') as HTMLElement;
    const slicerViewport = this.container.querySelector('#slicer-viewport-container') as HTMLElement;

    if (rigViewport) rigViewport.style.display = mode === 'rig' ? 'block' : 'none';
    if (slicerViewport) slicerViewport.style.display = mode === 'slicer' ? 'flex' : 'none';

    this.renderCanvasAlignmentBar();

    if (mode === 'slicer') {
      this.initSlicerIfNeeded();
      this.renderSlicerLeftSidebar();
      this.renderSlicerRightSidebar();
      this.slicer?.resizeCanvas();
    } else {
      // Synchronize slicer image to active rig view and canvas if slicer image was loaded/changed
      if (this.slicerImage) {
        const currentArt = this.views[this.activeView];
        if (!currentArt.image || currentArt.image !== this.slicerImage) {
          currentArt.image = this.slicerImage;
          currentArt.imageUrl = this.slicerImageUrl;
          currentArt.fileName = this.slicerImageFileName;
          this.canvas?.setSourceImage(this.slicerImage, this.slicerImageFileName, false);
        }
      }
      this.renderLeftSidebar();
      this.renderRightSidebar();
      this.canvas?.resizeCanvas();
      this.canvas?.render();
    }
  }

  private initSlicerIfNeeded(): void {
    if (this.slicer) return;

    const host = this.container.querySelector('#slicer-canvas-host') as HTMLElement;
    if (!host) return;

    this.slicer = new VectorElementSlicer(host, {
      onElementsChange: (elements) => {
        this.savedElements = elements;
        this.persistElementsToStorage();
        this.renderSlicerRightSidebar();
        this.updateSlicerHUD();
      },
      onSelectElement: () => {
        this.renderSlicerRightSidebar();
        this.updateSlicerHUD();
      },
      onTextureLoaded: (img) => {
        this.slicerImage = img;
        const currentArt = this.views[this.activeView];
        currentArt.image = img;
        currentArt.imageUrl = this.slicerImageUrl;
        currentArt.fileName = this.slicerImageFileName;
        if (this.canvas) {
          this.canvas.setSourceImage(img, this.slicerImageFileName || 'sheet.png', false);
          this.canvas.render();
        }
        if (this.savedElements.length > 0 && this.slicer?.getElements().length === 0) {
          this.slicer.setElements(this.savedElements);
        }
        this.renderSlicerLeftSidebar();
        this.renderSlicerRightSidebar();
        this.updateSlicerHUD();
      }
    });

    this.bindSlicerToolbarEvents();

    // Initial load: current view image or Ronald parts demo
    const currentArt = this.views[this.activeView];
    if (currentArt.image) {
      this.slicerImage = currentArt.image;
      this.slicerImageUrl = currentArt.imageUrl;
      this.slicerImageFileName = currentArt.fileName;
      this.slicerImageFileSize = currentArt.fileSize;
      this.slicer.setImage(currentArt.image);
    } else {
      this.loadSlicerImageFromUrl('/demo/assets/characters/sir_ronald_parts.png', 'sir_ronald_parts.png', '420 KB');
    }

    // Restore saved elements or storage cache
    if (this.savedElements.length > 0) {
      this.slicer.setElements(this.savedElements);
    } else {
      this.loadElementsFromStorage();
    }
  }

  private bindSlicerToolbarEvents(): void {
    const toolbar = this.container.querySelector('#slicer-toolbar');
    if (!toolbar) return;

    toolbar.querySelectorAll('.slicer-tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.getAttribute('data-tool') as SlicerToolMode;
        if (!tool || !this.slicer) return;
        this.slicerToolMode = tool;
        this.slicer.setToolMode(tool);
        toolbar.querySelectorAll('.slicer-tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.updateSlicerHUD();
      });
    });

    toolbar.querySelector('.btn-simplify-poly')?.addEventListener('click', () => {
      this.slicer?.simplifySelectedElement(2.5);
    });
    toolbar.querySelector('.btn-smooth-poly')?.addEventListener('click', () => {
      this.slicer?.smoothSelectedElement(1);
    });
    toolbar.querySelector('.btn-subdivide-poly')?.addEventListener('click', () => {
      this.slicer?.subdivideSelectedElement();
    });

    toolbar.querySelector('#btn-slicer-fit')?.addEventListener('click', () => {
      this.slicer?.resetView();
    });
    toolbar.querySelector('#btn-slicer-center')?.addEventListener('click', () => {
      this.slicer?.resetView();
    });

    toolbar.querySelector('#btn-slicer-save-elements-toolbar')?.addEventListener('click', () => {
      this.saveElementsJson();
    });
    toolbar.querySelector('#input-load-elements-toolbar')?.addEventListener('change', (e) => {
      const input = e.target as HTMLInputElement;
      if (input.files && input.files[0]) {
        this.handleLoadElementsJson(input.files[0]);
        input.value = '';
      }
    });
  }

  public saveElementsJson(): void {
    const elements = this.slicer ? this.slicer.getElements() : this.savedElements;
    if (elements.length === 0) {
      alert('No marked elements yet to save. Mark elements first using Magic Wand or Polygon tools.');
      return;
    }

    const doc: SavedElementsDocument = {
      format: 'questforge-elements',
      version: '1.0',
      characterName: this.characterName,
      imageFileName: this.slicerImageFileName || 'character_parts.png',
      imageFileSize: this.slicerImageFileSize || '',
      imageUrl: this.slicerImageUrl || '',
      elementCount: elements.length,
      elements: elements
    };

    const jsonStr = JSON.stringify(doc, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.characterName.toLowerCase().replace(/\s+/g, '_')}_elements.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  public handleLoadElementsJson(file: File): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = JSON.parse(text);
        this.loadElementsData(data);
      } catch (err: any) {
        console.error('Failed to parse elements JSON:', err);
        alert(`Failed to load elements: ${err.message || 'Invalid JSON format'}`);
      }
    };
    reader.readAsText(file);
  }

  public loadElementsData(data: any): void {
    let elements: VectorOutlineElement[] = [];
    if (Array.isArray(data)) {
      elements = data;
    } else if (data && Array.isArray(data.elements)) {
      elements = data.elements;
    } else if (data?.slicer && Array.isArray(data.slicer.elements)) {
      elements = data.slicer.elements;
    } else {
      alert('Invalid elements JSON: No elements array found in file.');
      return;
    }

    if (data.characterName && (!this.characterName || this.characterName === 'Character')) {
      this.characterName = data.characterName;
      this.updateHeaderTitle();
    }

    if (data.imageUrl && !this.slicerImage) {
      this.loadSlicerImageFromUrl(data.imageUrl, data.imageFileName || 'sheet.png', data.imageFileSize || '');
    }

    this.savedElements = JSON.parse(JSON.stringify(elements));
    if (this.slicer) {
      this.slicer.setElements(this.savedElements);
    }
    this.persistElementsToStorage();
    this.renderSlicerRightSidebar();
    this.updateSlicerHUD();
  }

  public clearSlicerElements(): void {
    this.savedElements = [];
    this.slicer?.clearAllElements();
    try {
      const key = `questforge_slicer_elements_${this.characterName || 'default'}`;
      localStorage.removeItem(key);
      localStorage.removeItem('questforge_slicer_elements_latest');
    } catch {}
    this.renderSlicerRightSidebar();
    this.updateSlicerHUD();
  }

  private persistElementsToStorage(): void {
    try {
      const dataStr = JSON.stringify(this.savedElements);
      const key = `questforge_slicer_elements_${this.characterName || 'default'}`;
      localStorage.setItem(key, dataStr);
      localStorage.setItem('questforge_slicer_elements_latest', dataStr);
    } catch (e) {
      console.warn('Could not save elements to localStorage:', e);
    }
  }

  private loadElementsFromStorage(): void {
    try {
      const key = `questforge_slicer_elements_${this.characterName || 'default'}`;
      let cached = localStorage.getItem(key);
      if (!cached) {
        cached = localStorage.getItem('questforge_slicer_elements_latest');
      }
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.savedElements = parsed;
          if (this.slicer) {
            this.slicer.setElements(parsed);
          }
        }
      }
    } catch (e) {
      console.warn('Could not read elements from localStorage:', e);
    }
  }

  private updateSlicerHUD(): void {
    const countEl = this.container.querySelector('#hud-slicer-count');
    const toolEl = this.container.querySelector('#hud-slicer-tool');
    if (countEl) countEl.textContent = `${this.slicer?.getElements().length || 0}`;
    if (toolEl) toolEl.textContent = this.slicerToolMode.toUpperCase();
  }

  public setSlicerImage(img: HTMLImageElement, url: string, fileName: string, fileSize = ''): void {
    this.slicerImage = img;
    this.slicerImageUrl = url;
    this.slicerImageFileName = fileName;
    this.slicerImageFileSize = fileSize;
    if (this.slicer) {
      this.slicer.setImage(img);
      this.slicer.resetView();
    }

    // Synchronize newly loaded graphic directly into the active Rig & Bones view
    const currentArt = this.views[this.activeView];
    currentArt.image = img;
    currentArt.imageUrl = url;
    currentArt.fileName = fileName;
    currentArt.fileSize = fileSize;

    if (this.canvas) {
      this.canvas.setSourceImage(img, fileName, false);
      this.canvas.render();
    }

    this.renderSlicerLeftSidebar();
    this.renderSlicerRightSidebar();
    this.updateSlicerHUD();
  }

  public loadSlicerImageFromUrl(url: string, fileName: string, fileSize = ''): void {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this.setSlicerImage(img, url, fileName, fileSize);
    };
    img.src = url;
  }

  private handleSlicerImageUpload(file: File): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const sizeStr = file.size > 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(file.size / 1024)} KB`;
      this.loadSlicerImageFromUrl(dataUrl, file.name, sizeStr);
    };
    reader.readAsDataURL(file);
  }

  private renderSlicerLeftSidebar(): void {
    const sidebar = this.container.querySelector('#left-sidebar') as HTMLElement;
    if (!sidebar) return;

    const hasImage = !!this.slicerImage;
    sidebar.innerHTML = `
      <!-- Slicer Image Source Section -->
      <div>
        <div class="panel-section-title">Image Source</div>

        ${!hasImage ? `
          <div class="import-dropzone" id="slicer-dropzone" style="cursor:pointer;">
            <div class="dropzone-icon">🖼️</div>
            <div class="dropzone-text">Click to load image / spritesheet</div>
            <button class="btn-browse" id="btn-browse-slicer-file">Browse Files...</button>
          </div>
        ` : `
          <div class="imported-card">
            <div class="imported-thumb-wrapper">
              <img src="${this.slicerImageUrl}" class="imported-thumb-img" alt="${this.slicerImageFileName}" />
            </div>
            <div class="imported-meta">
              <div class="imported-info">
                <span class="imported-filename" title="${this.slicerImageFileName}">${this.slicerImageFileName}</span>
                <span class="imported-filesize">${this.slicerImage ? `${this.slicerImage.naturalWidth}×${this.slicerImage.naturalHeight}` : ''}</span>
              </div>
              <div class="imported-check-badge">✓</div>
            </div>
          </div>
        `}

        <div style="display:flex; flex-direction:column; gap:6px; margin-top:8px;">
          <button class="btn-studio" id="btn-slicer-load-file" style="font-size:0.7rem; justify-content:center;">
            📁 Load Image from Disk...
          </button>
          ${hasImage ? `
            <button class="btn-studio" id="btn-slicer-sync-to-rig" style="font-size:0.7rem; justify-content:center; color:#38bdf8; border-color:rgba(56, 189, 248, 0.4);" title="Set this graphic as active rig artwork and update canvas">
              🖼️ Set as Base Rig Artwork
            </button>
          ` : ''}
          ${this.views[this.activeView].image ? `
            <button class="btn-studio" id="btn-slicer-load-active-view" style="font-size:0.7rem; justify-content:center; color:#94a3b8;">
              ↩️ Use Active View Artwork
            </button>
          ` : ''}
          <button class="btn-studio" id="btn-slicer-load-ronald" style="font-size:0.7rem; justify-content:center; color:#10b981;">
            ⚔️ Load Ronald Spritesheet Demo
          </button>
        </div>
      </div>

      <!-- Slicing Shortcuts Section -->
      <div style="display:flex; flex-direction:column; gap:8px;">
        <div class="panel-section-title">Contour Tracing Tools</div>
        <div style="font-size:0.68rem; color:#94a3b8; line-height:1.35;">
          • <b>Magic Wand:</b> Click any part on canvas to auto-trace outline.<br/>
          • <b>Polygon:</b> Click points around element to trace manual cutout.<br/>
          • <b>Knife / Split:</b> Drag line across element to cut in two.
        </div>

        <button class="btn-studio btn-studio-primary" id="btn-slicer-auto-trace" style="font-size:0.72rem; padding:7px; justify-content:center; background:#0284c7; border-color:#38bdf8; font-weight:700;" title="Scan image and automatically trace contours of all separate body parts">
          ✨ Auto-Trace All Elements
        </button>

        <button class="btn-studio" id="btn-slicer-load-precut-ronald" style="font-size:0.7rem; justify-content:center; color:#e2e8f0;" title="Load all pre-marked Ronald body parts with bone assignments">
          ⚔️ Load Ronald Pre-Marked Parts
        </button>
      </div>
    `;

    // Bind Left Sidebar Events
    sidebar.querySelector('#btn-browse-slicer-file')?.addEventListener('click', () => {
      (this.container.querySelector('#input-slicer-image-upload') as HTMLInputElement)?.click();
    });
    sidebar.querySelector('#slicer-dropzone')?.addEventListener('click', () => {
      (this.container.querySelector('#input-slicer-image-upload') as HTMLInputElement)?.click();
    });
    sidebar.querySelector('#btn-slicer-load-file')?.addEventListener('click', () => {
      (this.container.querySelector('#input-slicer-image-upload') as HTMLInputElement)?.click();
    });
    sidebar.querySelector('#btn-slicer-sync-to-rig')?.addEventListener('click', () => {
      if (this.slicerImage) {
        const art = this.views[this.activeView];
        art.image = this.slicerImage;
        art.imageUrl = this.slicerImageUrl;
        art.fileName = this.slicerImageFileName;
        art.fileSize = this.slicerImageFileSize;
        if (this.canvas) {
          this.canvas.setSourceImage(this.slicerImage, this.slicerImageFileName, false);
          this.canvas.render();
        }
        alert(`Graphic "${this.slicerImageFileName}" set as base artwork for ${this.activeView.toUpperCase()} rig!`);
      }
    });
    sidebar.querySelector('#btn-slicer-load-active-view')?.addEventListener('click', () => {
      const art = this.views[this.activeView];
      if (art.image) {
        this.loadSlicerImageFromUrl(art.imageUrl, art.fileName, art.fileSize);
      }
    });
    sidebar.querySelector('#btn-slicer-load-ronald')?.addEventListener('click', () => {
      this.loadSlicerImageFromUrl('/demo/assets/characters/sir_ronald_parts.png', 'sir_ronald_parts.png', '420 KB');
    });
    sidebar.querySelector('#btn-slicer-auto-trace')?.addEventListener('click', () => {
      this.slicer?.autoTraceAllElements();
    });
    sidebar.querySelector('#btn-slicer-load-precut-ronald')?.addEventListener('click', () => {
      this.loadRonaldPreMarkedElementsInSlicer();
    });
  }

  private renderSlicerRightSidebar(): void {
    const sidebar = this.container.querySelector('#right-sidebar') as HTMLElement;
    if (!sidebar || !this.slicer) return;

    const elements = this.slicer.getElements();
    const selectedElem = this.slicer.getSelectedElement();

    sidebar.innerHTML = `
      <div class="sidebar-tabs-header">
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%; padding:2px 0;">
          <span style="font-weight:700; font-size:0.8rem; color:#f1f5f9;">Marked Elements (${elements.length})</span>
          <div style="display:flex; gap:4px; align-items:center;">
            <button class="btn-studio" id="btn-slicer-save-elements" style="font-size:0.64rem; padding:2px 6px; color:#38bdf8;" title="Save marked elements as .json file">
              💾 Save
            </button>
            <label class="btn-studio" style="font-size:0.64rem; padding:2px 6px; color:#a855f7; cursor:pointer; margin:0;" title="Load elements from .json file">
              📂 Load
              <input type="file" id="input-load-elements-file" accept=".json" style="display:none;" />
            </label>
            <button class="btn-studio" id="btn-slicer-clear-elements" style="font-size:0.64rem; padding:2px 6px; color:#ef4444;" title="Delete all marked elements">
              🗑️ Clear
            </button>
          </div>
        </div>
      </div>

      <div class="sidebar-content" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:8px;">
        <!-- Primary Apply Button -->
        <button class="btn-studio btn-studio-primary" id="btn-apply-marked-to-rig" style="font-size:0.75rem; padding:8px 8px; justify-content:center; background:#059669; border-color:#10b981; font-weight:700;" title="Cut all marked elements, attach assigned elements to skeleton bones, and view rigged character">
          ⚡ Apply Marked Elements to Skeleton Rig
        </button>

        <div style="font-size:0.68rem; color:#94a3b8; line-height:1.35;">
          Assign each marked element to a bone below. When applied, graphics are extracted and attached to the character's skeleton.
        </div>

        ${elements.length > 0 ? `
          <div style="display:flex; flex-direction:column; gap:6px;">
            ${elements.map((el) => {
              const isSelected = selectedElem?.id === el.id;
              const thumbUrl = this.slicer?.generateThumbnail(el) || '';

              return `
                <div class="slicer-element-card ${isSelected ? 'selected' : ''}" data-elem-id="${el.id}">
                  <div style="display:flex; align-items:center; gap:8px;">
                    <!-- Thumbnail -->
                    <div style="width:36px; height:36px; background:#020617; border:1px solid rgba(255,255,255,0.08); border-radius:4px; display:flex; align-items:center; justify-content:center; flex-shrink:0; overflow:hidden;">
                      ${thumbUrl ? `
                        <img src="${thumbUrl}" style="max-width:100%; max-height:100%; object-fit:contain;" alt="${el.name}" />
                      ` : `
                        <span style="font-size:0.75rem;">🎨</span>
                      `}
                    </div>

                    <!-- Element Name & Info -->
                    <div style="flex:1; min-width:0;">
                      <div style="display:flex; align-items:center; justify-content:space-between; gap:4px;">
                        <input type="text" class="input-slicer-elem-name" data-elem-id="${el.id}" value="${el.name}" style="background:transparent; border:none; border-bottom:1px dashed rgba(255,255,255,0.2); color:#f8fafc; font-size:0.72rem; font-weight:600; width:100%; padding:1px 0;" />
                        <button class="btn-studio btn-delete-slicer-elem" data-elem-id="${el.id}" style="padding:1px 5px; font-size:0.65rem; color:#ef4444;" title="Delete Element">✕</button>
                      </div>
                      <div style="font-size:0.6rem; color:#64748b; margin-top:2px;">
                        ${Math.round(el.bounds.width)}×${Math.round(el.bounds.height)}px • ${el.polygon.length} pts
                      </div>
                    </div>
                  </div>

                  <!-- Bone Assignment Dropdown -->
                  <div style="display:flex; align-items:center; gap:6px; background:rgba(0,0,0,0.3); border-radius:4px; padding:3px 6px;">
                    <span style="font-size:0.64rem; color:#38bdf8; font-weight:600; white-space:nowrap;">🦴 Bone:</span>
                    <select class="select-slicer-elem-bone" data-elem-id="${el.id}" style="flex:1; font-size:0.65rem; background:#0b1120; border:1px solid ${el.assignedBoneId ? '#10b981' : 'rgba(255,255,255,0.15)'}; color:#f1f5f9; border-radius:3px; padding:2px 4px;">
                      <option value="">-- None (Parts Library only) --</option>
                      ${ANATOMICAL_BONES.map(b => `
                        <option value="${b.id}" ${el.assignedBoneId === b.id ? 'selected' : ''}>
                          ${b.name} (${b.category})
                        </option>
                      `).join('')}
                    </select>
                  </div>

                  <!-- Bone Origin & Target Joints Dropdowns -->
                  <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px; background:rgba(0,0,0,0.22); border-radius:4px; padding:3px 6px;">
                    <div style="display:flex; align-items:center; gap:4px; min-width:0;">
                      <span style="font-size:0.62rem; color:#94a3b8; font-weight:600; white-space:nowrap;">Origin:</span>
                      <select class="select-slicer-elem-origin" data-elem-id="${el.id}" style="flex:1; min-width:0; font-size:0.63rem; background:#0b1120; border:1px solid rgba(255,255,255,0.12); color:#f1f5f9; border-radius:3px; padding:2px 3px;">
                        <option value="">Default Origin</option>
                        ${ANATOMICAL_JOINTS.map(j => `
                          <option value="${j.id}" ${el.originJointId === j.id ? 'selected' : ''}>
                            ${j.name}
                          </option>
                        `).join('')}
                      </select>
                    </div>
                    <div style="display:flex; align-items:center; gap:4px; min-width:0;">
                      <span style="font-size:0.62rem; color:#38bdf8; font-weight:600; white-space:nowrap;">Target:</span>
                      <select class="select-slicer-elem-target" data-elem-id="${el.id}" style="flex:1; min-width:0; font-size:0.63rem; background:#0b1120; border:1px solid rgba(255,255,255,0.12); color:#38bdf8; border-radius:3px; padding:2px 3px;">
                        <option value="">Default Target</option>
                        ${ANATOMICAL_JOINTS.map(j => `
                          <option value="${j.id}" ${el.targetJointId === j.id ? 'selected' : ''}>
                            ${j.name}
                          </option>
                        `).join('')}
                      </select>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        ` : `
          <div style="background:#0f172a; border:1px dashed rgba(148, 163, 184, 0.2); border-radius:6px; padding:24px 12px; text-align:center; color:#64748b; font-size:0.72rem; line-height:1.4;">
            No elements marked yet.<br/>
            Click <b>Magic Contour</b> or <b>Polygon</b> on the toolbar, or click <b>Auto-Trace All Elements</b> on the left!
          </div>
        `}
      </div>
    `;

    // Bind Right Sidebar Events
    sidebar.querySelector('#btn-apply-marked-to-rig')?.addEventListener('click', () => {
      this.applyMarkedElementsToRig();
    });

    sidebar.querySelector('#btn-slicer-save-elements')?.addEventListener('click', () => {
      this.saveElementsJson();
    });

    sidebar.querySelector('#input-load-elements-file')?.addEventListener('change', (e) => {
      const input = e.target as HTMLInputElement;
      if (input.files && input.files[0]) {
        this.handleLoadElementsJson(input.files[0]);
        input.value = '';
      }
    });

    sidebar.querySelector('#btn-slicer-clear-elements')?.addEventListener('click', () => {
      if (confirm('Clear all marked elements?')) {
        this.clearSlicerElements();
      }
    });

    // Select element card on click
    sidebar.querySelectorAll('.slicer-element-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'BUTTON') return;
        const id = card.getAttribute('data-elem-id');
        if (id) {
          this.slicer?.selectElement(id);
        }
      });
    });

    // Delete element
    sidebar.querySelectorAll('.btn-delete-slicer-elem').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-elem-id');
        if (id) {
          this.slicer?.removeElement(id);
        }
      });
    });

    // Inline element rename
    sidebar.querySelectorAll('.input-slicer-elem-name').forEach(input => {
      input.addEventListener('change', () => {
        const elemInput = input as HTMLInputElement;
        const id = elemInput.getAttribute('data-elem-id');
        if (id && elemInput.value) {
          this.slicer?.renameElement(id, elemInput.value);
        }
      });
    });

    // Bone assignment change with immediate live sync to rig canvas & parts library
    sidebar.querySelectorAll('.select-slicer-elem-bone').forEach(sel => {
      sel.addEventListener('change', () => {
        const select = sel as HTMLSelectElement;
        const id = select.getAttribute('data-elem-id');
        const boneId = (select.value || undefined) as AnatomicalJointId | undefined;
        if (id && this.slicer) {
          this.slicer.updateElementAssignedBone(id, boneId);
          // Sync element thumbnail and bone attachment live
          const elem = this.slicer.getElements().find(el => el.id === id);
          if (elem) {
            if (boneId) {
              const bDef = ANATOMICAL_BONES.find(b => b.id === boneId);
              if (bDef) {
                if (!elem.originJointId) elem.originJointId = (bDef.originJointId !== 'hip_mid' ? bDef.originJointId : 'chest') as AnatomicalJointId;
                if (!elem.targetJointId) elem.targetJointId = bDef.targetJointId as AnatomicalJointId;
                const origSel = sidebar.querySelector(`.select-slicer-elem-origin[data-elem-id="${id}"]`) as HTMLSelectElement | null;
                const tgtSel = sidebar.querySelector(`.select-slicer-elem-target[data-elem-id="${id}"]`) as HTMLSelectElement | null;
                if (origSel && elem.originJointId) origSel.value = elem.originJointId;
                if (tgtSel && elem.targetJointId) tgtSel.value = elem.targetJointId;
              }
            }
            const thumbUrl = this.slicer.generateThumbnail(elem);
            if (thumbUrl) {
              const img = new Image();
              img.onload = () => this.canvas?.render();
              img.src = thumbUrl;
              const pivotX = elem.bounds.width > 0 ? elem.pivot.x / elem.bounds.width : 0.5;
              const pivotY = elem.bounds.height > 0 ? elem.pivot.y / elem.bounds.height : 0.5;

              const libIdx = this.partsLibrary.findIndex(p => p.id === id);
              if (libIdx >= 0) {
                this.partsLibrary[libIdx].assignedBoneId = boneId || null;
              } else {
                this.partsLibrary.push({
                  id: elem.id,
                  name: elem.name,
                  imageUrl: thumbUrl,
                  image: img,
                  width: Math.round(elem.bounds.width),
                  height: Math.round(elem.bounds.height),
                  assignedBoneId: boneId || null,
                  pivotX,
                  pivotY
                });
              }

              const currentArt = this.views[this.activeView];
              if (boneId) {
                const boneAttachment: BonePartAttachment = {
                  id: elem.id,
                  boneId,
                  originJointId: elem.originJointId,
                  targetJointId: elem.targetJointId,
                  fileName: elem.name + '.png',
                  imageUrl: thumbUrl,
                  image: img,
                  width: Math.round(elem.bounds.width),
                  height: Math.round(elem.bounds.height),
                  pivotX,
                  pivotY,
                  visible: true,
                  opacity: 1
                };
                currentArt.parts[boneId] = boneAttachment;
                this.canvas?.setPart(boneId, boneAttachment);
              } else {
                for (const bId of Object.keys(currentArt.parts)) {
                  if (currentArt.parts[bId]?.id === id) {
                    delete currentArt.parts[bId];
                    this.canvas?.setPart(bId as AnatomicalJointId, null);
                  }
                }
              }
            }
          }
        }
      });
    });

    // Origin joint change
    sidebar.querySelectorAll('.select-slicer-elem-origin').forEach(sel => {
      sel.addEventListener('change', () => {
        const select = sel as HTMLSelectElement;
        const id = select.getAttribute('data-elem-id');
        const origId = (select.value || undefined) as AnatomicalJointId | undefined;
        if (id && this.slicer) {
          const elem = this.slicer.getElements().find(el => el.id === id);
          if (elem) {
            elem.originJointId = origId;
            const currentArt = this.views[this.activeView];
            if (elem.assignedBoneId && currentArt.parts[elem.assignedBoneId]) {
              currentArt.parts[elem.assignedBoneId].originJointId = origId;
              this.canvas?.setPart(elem.assignedBoneId, currentArt.parts[elem.assignedBoneId]);
            }
          }
        }
      });
    });

    // Target joint change
    sidebar.querySelectorAll('.select-slicer-elem-target').forEach(sel => {
      sel.addEventListener('change', () => {
        const select = sel as HTMLSelectElement;
        const id = select.getAttribute('data-elem-id');
        const tgtId = (select.value || undefined) as AnatomicalJointId | undefined;
        if (id && this.slicer) {
          const elem = this.slicer.getElements().find(el => el.id === id);
          if (elem) {
            elem.targetJointId = tgtId;
            const currentArt = this.views[this.activeView];
            if (elem.assignedBoneId && currentArt.parts[elem.assignedBoneId]) {
              currentArt.parts[elem.assignedBoneId].targetJointId = tgtId;
              this.canvas?.setPart(elem.assignedBoneId, currentArt.parts[elem.assignedBoneId]);
            }
          }
        }
      });
    });
  }

  public applyMarkedElementsToRig(): void {
    if (!this.slicer) return;
    const elements = this.slicer.getElements();
    if (elements.length === 0) {
      alert('No elements marked yet! Use Magic Wand or Polygon to mark elements first.');
      return;
    }

    const currentArt = this.views[this.activeView];

    // Ensure slicer graphic is set as the active view base image
    if (this.slicerImage) {
      currentArt.image = this.slicerImage;
      currentArt.imageUrl = this.slicerImageUrl;
      currentArt.fileName = this.slicerImageFileName;
      currentArt.fileSize = this.slicerImageFileSize;
      this.canvas?.setSourceImage(this.slicerImage, this.slicerImageFileName, false);
    }

    for (const elem of elements) {
      const thumbUrl = this.slicer.generateThumbnail(elem);
      if (!thumbUrl) continue;

      const img = new Image();
      img.onload = () => {
        this.canvas?.render();
      };
      img.src = thumbUrl;

      const pivotX = elem.bounds.width > 0 ? elem.pivot.x / elem.bounds.width : 0.5;
      const pivotY = elem.bounds.height > 0 ? elem.pivot.y / elem.bounds.height : 0.5;

      const partItem: RigPartItem = {
        id: elem.id,
        name: elem.name,
        imageUrl: thumbUrl,
        image: img,
        width: Math.round(elem.bounds.width),
        height: Math.round(elem.bounds.height),
        assignedBoneId: elem.assignedBoneId || null,
        pivotX,
        pivotY
      };

      const existingIdx = this.partsLibrary.findIndex(p => p.id === elem.id);
      if (existingIdx >= 0) {
        this.partsLibrary[existingIdx] = partItem;
      } else {
        this.partsLibrary.push(partItem);
      }

      if (elem.assignedBoneId) {
        const boneAttachment: BonePartAttachment = {
          id: elem.id,
          boneId: elem.assignedBoneId,
          originJointId: elem.originJointId,
          targetJointId: elem.targetJointId,
          fileName: elem.name + '.png',
          imageUrl: thumbUrl,
          image: img,
          width: Math.round(elem.bounds.width),
          height: Math.round(elem.bounds.height),
          pivotX,
          pivotY,
          visible: true,
          opacity: 1
        };

        currentArt.parts[elem.assignedBoneId] = boneAttachment;
        this.canvas?.setPart(elem.assignedBoneId, boneAttachment);
      }
    }

    if (this.canvas) {
      this.canvas.setParts(currentArt.parts);
      this.canvas.render();
    }

    this.activeRightTab = 'bones';
    this.switchStudioMode('rig');
  }

  private loadRonaldPreMarkedElementsInSlicer(): void {
    const demoUrl = '/demo/assets/characters/sir_ronald_parts.png';
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this.slicerImage = img;
      this.slicerImageUrl = demoUrl;
      this.slicerImageFileName = 'sir_ronald_parts.png';
      this.slicerImageFileSize = '420 KB';
      if (this.slicer) {
        this.slicer.setImage(img);
        this.slicer.resetView();

        const ronaldParts: {
          name: string;
          boneId?: AnatomicalJointId;
          bounds: { x: number; y: number; width: number; height: number };
          pivot: { x: number; y: number };
        }[] = [
          { name: 'Head (f_head)', boneId: 'head', bounds: { x: 16, y: 166, width: 211, height: 216 }, pivot: { x: 106, y: 168 } },
          { name: 'Torso & Waist (f_torso)', boneId: 'chest', bounds: { x: 249, y: 168, width: 252, height: 249 }, pivot: { x: 126, y: 180 } },
          { name: 'Left Upper Arm (f_arm_upper_l)', boneId: 'shoulder_l', bounds: { x: 673, y: 197, width: 97, height: 117 }, pivot: { x: 31, y: 23 } },
          { name: 'Left Forearm (f_arm_lower_l)', boneId: 'elbow_l', bounds: { x: 706, y: 312, width: 69, height: 66 }, pivot: { x: 35, y: 14 } },
          { name: 'Left Hand (f_hand_l)', boneId: 'wrist_l', bounds: { x: 673, y: 354, width: 91, height: 75 }, pivot: { x: 46, y: 20 } },
          { name: 'Right Upper Arm (f_arm_upper_r)', boneId: 'shoulder_r', bounds: { x: 529, y: 197, width: 90, height: 117 }, pivot: { x: 61, y: 21 } },
          { name: 'Right Forearm (f_arm_lower_r)', boneId: 'elbow_r', bounds: { x: 520, y: 304, width: 69, height: 81 }, pivot: { x: 31, y: 10 } },
          { name: 'Right Hand (f_hand_r)', boneId: 'wrist_r', bounds: { x: 533, y: 349, width: 88, height: 80 }, pivot: { x: 32, y: 23 } },
          { name: 'Left Thigh (f_leg_upper_l)', boneId: 'hip_l', bounds: { x: 973, y: 158, width: 95, height: 123 }, pivot: { x: 44, y: 16 } },
          { name: 'Left Calf (f_leg_lower_l)', boneId: 'knee_l', bounds: { x: 981, y: 278, width: 87, height: 92 }, pivot: { x: 45, y: 14 } },
          { name: 'Left Boot (f_foot_l)', boneId: 'ankle_l', bounds: { x: 995, y: 370, width: 94, height: 80 }, pivot: { x: 33, y: 10 } },
          { name: 'Right Thigh (f_leg_upper_r)', boneId: 'hip_r', bounds: { x: 829, y: 160, width: 92, height: 128 }, pivot: { x: 54, y: 14 } },
          { name: 'Right Calf (f_leg_lower_r)', boneId: 'knee_r', bounds: { x: 828, y: 286, width: 86, height: 99 }, pivot: { x: 40, y: 12 } },
          { name: 'Right Boot (f_foot_r)', boneId: 'ankle_r', bounds: { x: 813, y: 382, width: 89, height: 70 }, pivot: { x: 52, y: 11 } },
        ];

        const elements: VectorOutlineElement[] = ronaldParts.map((p, i) => {
          const b = p.bounds;
          return {
            id: `ronald_slicer_elem_${i + 1}`,
            name: p.name,
            assignedBoneId: p.boneId,
            polygon: [
              { x: b.x, y: b.y },
              { x: b.x + b.width, y: b.y },
              { x: b.x + b.width, y: b.y + b.height },
              { x: b.x, y: b.y + b.height }
            ],
            bounds: b,
            pivot: p.pivot,
            deformationMode: 'cutout'
          };
        });

        this.slicer.setElements(elements);
        this.savedElements = elements;
        this.persistElementsToStorage();
        this.renderSlicerLeftSidebar();
        this.renderSlicerRightSidebar();
        this.updateSlicerHUD();
      }
    };
    img.src = demoUrl;
  }

  private renderLeftSidebar(): void {
    const sidebar = this.container.querySelector('#left-sidebar') as HTMLElement;
    if (!sidebar) return;

    if (this.activeStudioMode === 'slicer') {
      this.renderSlicerLeftSidebar();
      return;
    }

    const currentArt = this.views[this.activeView];
    const hasImage = !!currentArt.image || Object.keys(currentArt.parts).length > 0;

    sidebar.innerHTML = `
      <!-- Import Section (Step 1 & 2) -->
      <div>
        <div class="panel-section-title">Import</div>

        ${!currentArt.image ? `
          <div class="import-dropzone" id="left-dropzone">
            <div class="dropzone-icon">🖼️</div>
            <div class="dropzone-text">Drag and drop image files here</div>
            <button class="btn-browse" id="btn-browse-file">Browse Files...</button>
          </div>
        ` : `
          <div class="imported-card">
            <div class="imported-thumb-wrapper">
              <img src="${currentArt.imageUrl}" class="imported-thumb-img" alt="${currentArt.fileName}" />
            </div>
            <div class="imported-meta">
              <div class="imported-info">
                <span class="imported-filename" title="${currentArt.fileName}">${currentArt.fileName}</span>
                <span class="imported-filesize">(${currentArt.fileSize})</span>
              </div>
              <div class="imported-check-badge">✓</div>
            </div>
          </div>
        `}
      </div>

      <!-- Joint Tools Section (Step 3, 4, 5) -->
      ${hasImage ? `
        <div style="display:flex; flex-direction:column; gap:8px;">
          <div class="panel-section-title">Joint Tools</div>

          <div class="joint-tools-group">
            <button class="joint-tool-btn ${this.toolMode === 'select' ? 'active' : ''}" data-tool="select">
              <span style="font-size:1.1rem; line-height:1;">↖</span> Select
            </button>
            <button class="joint-tool-btn ${this.toolMode === 'add_joint' ? 'active' : ''}" data-tool="add_joint">
              <span style="font-size:1.1rem; line-height:1;">+</span> Add Joint
            </button>
            <button class="joint-tool-btn ${this.toolMode === 'move' ? 'active' : ''}" data-tool="move">
              <span style="font-size:1.1rem; line-height:1;">✥</span> Move
            </button>
            <button class="joint-tool-btn btn-preview-mode ${this.toolMode === 'preview' ? 'active' : ''}" data-tool="preview">
              <span style="font-size:1rem; line-height:1;">▶</span> Preview Mode
            </button>
          </div>

          <!-- Toggles (Symmetry, Show Bones, Show Envelopes) -->
          <div class="studio-toggles-section">
            <div class="studio-toggle-row">
              <span class="toggle-label">Symmetry</span>
              <label class="studio-switch">
                <input type="checkbox" id="toggle-symmetry" ${this.symmetryEnabled ? 'checked' : ''} />
                <span class="switch-slider"></span>
              </label>
            </div>

            <div class="studio-toggle-row">
              <span class="toggle-label">Show Bones</span>
              <label class="studio-switch">
                <input type="checkbox" id="toggle-show-bones" ${this.showBonesEnabled ? 'checked' : ''} />
                <span class="switch-slider"></span>
              </label>
            </div>

            <div class="studio-toggle-row">
              <span class="toggle-label">Show Envelopes</span>
              <label class="studio-switch">
                <input type="checkbox" id="toggle-show-envelopes" ${this.showEnvelopesEnabled ? 'checked' : ''} />
                <span class="switch-slider"></span>
              </label>
            </div>

            <div class="studio-toggle-row">
              <span class="toggle-label">Ghost (Rest)</span>
              <label class="studio-switch">
                <input type="checkbox" id="toggle-show-ghost" ${this.canvas?.getShowGhost() ? 'checked' : ''} />
                <span class="switch-slider"></span>
              </label>
            </div>

            <div class="studio-toggle-row">
              <span class="toggle-label" title="Keep attached graphics pinned in world space when dragging joint pins">Lock Graphics</span>
              <label class="studio-switch">
                <input type="checkbox" id="toggle-lock-graphics" ${this.canvas?.isLockGraphicPosition() ? 'checked' : ''} />
                <span class="switch-slider"></span>
              </label>
            </div>

            <div class="studio-toggle-row">
              <span class="toggle-label" title="Underlay character image behind parts for alignment reference">Reference Art</span>
              <label class="studio-switch">
                <input type="checkbox" id="toggle-show-refart" ${this.canvas?.isShowReferenceArtwork() ? 'checked' : ''} />
                <span class="switch-slider"></span>
              </label>
            </div>
          </div>

          <!-- Additional Actions (Step 4 & 5) -->
          ${this.toolMode === 'preview' ? `
            <button class="btn-studio" id="btn-reset-pose" style="justify-content:center; margin-top:6px;">
              🔄 Reset Pose
            </button>
          ` : ''}

          ${this.activeView !== 'front' ? `
            <button class="btn-studio" id="btn-copy-joints-front" style="justify-content:center; margin-top:4px;" title="Copy joint coordinates from Front view with symmetry reflection">
              📋 Copy joints from Front
            </button>
          ` : ''}

          <button class="btn-studio" id="btn-replace-artwork" style="justify-content:center; margin-top:4px; opacity:0.85;">
            📁 Replace Artwork...
          </button>
        </div>
      ` : ''}
    `;

    // Bind left sidebar events
    const browseBtn = sidebar.querySelector('#btn-browse-file');
    browseBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const fileInput = this.container.querySelector('#input-graphic-upload') as HTMLInputElement;
      fileInput?.click();
    });

    sidebar.querySelector('#left-dropzone')?.addEventListener('click', () => {
      const fileInput = this.container.querySelector('#input-graphic-upload') as HTMLInputElement;
      fileInput?.click();
    });

    sidebar.querySelector('#btn-replace-artwork')?.addEventListener('click', () => {
      const fileInput = this.container.querySelector('#input-graphic-upload') as HTMLInputElement;
      fileInput?.click();
    });

    // Joint Tool buttons
    sidebar.querySelectorAll('.joint-tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-tool') as JointToolMode;
        if (mode) {
          this.setToolMode(mode);
        }
      });
    });

    // Switches
    const symToggle = sidebar.querySelector('#toggle-symmetry') as HTMLInputElement;
    symToggle?.addEventListener('change', () => {
      this.symmetryEnabled = symToggle.checked;
      this.canvas?.setSymmetry(this.symmetryEnabled);
    });

    const bonesToggle = sidebar.querySelector('#toggle-show-bones') as HTMLInputElement;
    bonesToggle?.addEventListener('change', () => {
      this.showBonesEnabled = bonesToggle.checked;
      this.canvas?.setShowBones(this.showBonesEnabled);
    });

    const envToggle = sidebar.querySelector('#toggle-show-envelopes') as HTMLInputElement;
    envToggle?.addEventListener('change', () => {
      this.showEnvelopesEnabled = envToggle.checked;
      this.canvas?.setShowEnvelopes(this.showEnvelopesEnabled);
    });

    const ghostToggle = sidebar.querySelector('#toggle-show-ghost') as HTMLInputElement;
    ghostToggle?.addEventListener('change', () => {
      this.canvas?.setShowGhost(ghostToggle.checked);
    });

    const lockToggle = sidebar.querySelector('#toggle-lock-graphics') as HTMLInputElement;
    lockToggle?.addEventListener('change', () => {
      this.canvas?.setLockGraphicPosition(lockToggle.checked);
      this.renderCanvasAlignmentBar();
    });

    const refArtToggle = sidebar.querySelector('#toggle-show-refart') as HTMLInputElement;
    refArtToggle?.addEventListener('change', () => {
      this.canvas?.setShowReferenceArtwork(refArtToggle.checked);
    });

    // Action buttons
    sidebar.querySelector('#btn-reset-pose')?.addEventListener('click', () => {
      this.canvas?.resetPose();
    });

    sidebar.querySelector('#btn-copy-joints-front')?.addEventListener('click', () => {
      this.copyJointsFromFrontView();
    });
  }

  public snapRigToCharacterFit(): void {
    const defaultJoints = getDefaultJointPositions(this.activeView);
    this.views[this.activeView].joints = JSON.parse(JSON.stringify(defaultJoints));
    this.canvas?.setJoints(this.views[this.activeView].joints);
    this.canvas?.resetPose();
    this.renderRightSidebar();
  }

  public attachPartToBone(
    boneId: AnatomicalJointId,
    partData: {
      id?: string;
      name?: string;
      imageUrl: string;
      image?: HTMLImageElement;
      pivotX?: number;
      pivotY?: number;
      scale?: number;
      offsetX?: number;
      offsetY?: number;
      rotation?: number;
    }
  ): void {
    this.recordHistory('Attach Part');
    const applyAttachment = (img: HTMLImageElement) => {
      const currentArt = this.views[this.activeView];
      const part: BonePartAttachment = {
        boneId,
        image: img,
        imageUrl: partData.imageUrl,
        fileName: partData.name || `${boneId}_part.png`,
        scale: partData.scale ?? 1.0,
        offsetX: partData.offsetX ?? 0,
        offsetY: partData.offsetY ?? 0,
        rotation: partData.rotation ?? 0,
        pivotX: partData.pivotX,
        pivotY: partData.pivotY,
        flipX: (partData as any).flipX ?? false,
        flipY: (partData as any).flipY ?? false
      };

      currentArt.parts[boneId] = part;
      this.canvas?.setPart(boneId, part);

      if (partData.id) {
        const libItem = this.partsLibrary.find(p => p.id === partData.id);
        if (libItem) libItem.assignedBoneId = boneId;
      }

      this.selectedJointId = boneId;
      this.renderRightSidebar();
      this.renderCanvasAlignmentBar();
    };

    if (partData.image && partData.image.complete && partData.image.naturalWidth > 0) {
      applyAttachment(partData.image);
    } else {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => applyAttachment(img);
      img.src = partData.imageUrl;
    }
  }

  public assembleAllRonaldParts(): void {
    if (this.partsLibrary.length === 0) {
      this.loadRonaldDemoParts(true);
      return;
    }

    const currentArt = this.views[this.activeView];
    for (const item of this.partsLibrary) {
      if (item.assignedBoneId) {
        const part: BonePartAttachment = {
          boneId: item.assignedBoneId,
          image: item.image,
          imageUrl: item.imageUrl,
          fileName: item.name,
          scale: 1.0,
          offsetX: 0,
          offsetY: 0,
          rotation: 0,
          pivotX: item.pivotX,
          pivotY: item.pivotY
        };
        currentArt.parts[item.assignedBoneId] = part;
        this.canvas?.setPart(item.assignedBoneId, part);
      }
    }
    if (this.canvas) {
      this.canvas.setParts(currentArt.parts);
      this.canvas.render();
    }
    this.renderRightSidebar();
  }

  public handleLibraryFilesUpload(files: FileList | File[]): void {
    Array.from(files).forEach((file, i) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const img = new Image();
        img.onload = () => {
          this.partsLibrary.push({
            id: `part_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`,
            name: file.name.replace(/\.[^/.]+$/, ''),
            imageUrl: dataUrl,
            image: img,
            width: img.width,
            height: img.height,
            assignedBoneId: null
          });
          this.activeRightTab = 'parts';
          this.renderRightSidebar();
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    });
  }

  public handleSpritesheetUpload(file: File): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        this.autoSliceSpritesheet(img, file.name.replace(/\.[^/.]+$/, ''));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  public autoSliceSpritesheet(img: HTMLImageElement, baseName = 'part'): void {
    const off = document.createElement('canvas');
    off.width = img.naturalWidth || img.width;
    off.height = img.naturalHeight || img.height;
    const ctx = off.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);

    const imgData = ctx.getImageData(0, 0, off.width, off.height);
    const { width, height, data } = imgData;
    const visited = new Uint8Array(width * height);
    const alphaThreshold = 25;

    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        const idx = y * width + x;
        if (visited[idx] || data[idx * 4 + 3] <= alphaThreshold) continue;

        let minX = x;
        let maxX = x;
        let minY = y;
        let maxY = y;
        let pixelCount = 0;

        const queue: number[] = [idx];
        visited[idx] = 1;

        while (queue.length > 0) {
          const cur = queue.pop()!;
          const cy = Math.floor(cur / width);
          const cx = cur % width;
          pixelCount++;

          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;

          const neighbors = [
            cy > 1 ? cur - width : -1,
            cy < height - 2 ? cur + width : -1,
            cx > 1 ? cur - 1 : -1,
            cx < width - 2 ? cur + 1 : -1
          ];

          for (const n of neighbors) {
            if (n >= 0 && !visited[n] && data[n * 4 + 3] > alphaThreshold) {
              visited[n] = 1;
              queue.push(n);
            }
          }
        }

        const w = maxX - minX + 1;
        const h = maxY - minY + 1;
        if (w >= 16 && h >= 16 && pixelCount >= 30) {
          const partCanvas = document.createElement('canvas');
          partCanvas.width = w;
          partCanvas.height = h;
          const pCtx = partCanvas.getContext('2d');
          if (pCtx) {
            pCtx.drawImage(img, minX, minY, w, h, 0, 0, w, h);
            const dataUrl = partCanvas.toDataURL('image/png');
            const partImg = new Image();
            partImg.src = dataUrl;

            this.partsLibrary.push({
              id: `part_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              name: `${baseName}_${this.partsLibrary.length + 1}`,
              imageUrl: dataUrl,
              image: partImg,
              width: w,
              height: h,
              assignedBoneId: null
            });
          }
        }
      }
    }

    this.activeRightTab = 'parts';
    this.renderRightSidebar();
  }

  public loadRonaldDemoParts(autoAssemble = false): void {
    const demoUrl = '/demo/assets/characters/sir_ronald_parts.png';
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const ronaldElements: {
        name: string;
        boneId?: AnatomicalJointId;
        bounds: { x: number; y: number; width: number; height: number };
        pivot: { x: number; y: number };
      }[] = [
        { name: 'Head (f_head)', boneId: 'head', bounds: { x: 16, y: 166, width: 211, height: 216 }, pivot: { x: 106, y: 168 } },
        { name: 'Torso & Waist (Full)', boneId: 'chest', bounds: { x: 249, y: 168, width: 252, height: 249 }, pivot: { x: 126, y: 180 } },
        { name: 'Torso Chest (f_torso)', bounds: { x: 249, y: 168, width: 252, height: 173 }, pivot: { x: 126, y: 160 } },
        { name: 'Hip / Belt (f_hip)', bounds: { x: 292, y: 336, width: 168, height: 81 }, pivot: { x: 84, y: 41 } },
        { name: 'Left Upper Arm (f_arm_upper_l)', boneId: 'shoulder_l', bounds: { x: 673, y: 197, width: 97, height: 117 }, pivot: { x: 31, y: 23 } },
        { name: 'Left Forearm (f_arm_lower_l)', boneId: 'elbow_l', bounds: { x: 706, y: 312, width: 69, height: 66 }, pivot: { x: 35, y: 14 } },
        { name: 'Left Hand (f_hand_l)', boneId: 'wrist_l', bounds: { x: 673, y: 354, width: 91, height: 75 }, pivot: { x: 46, y: 20 } },
        { name: 'Right Upper Arm (f_arm_upper_r)', boneId: 'shoulder_r', bounds: { x: 529, y: 197, width: 90, height: 117 }, pivot: { x: 61, y: 21 } },
        { name: 'Right Forearm (f_arm_lower_r)', boneId: 'elbow_r', bounds: { x: 520, y: 304, width: 69, height: 81 }, pivot: { x: 31, y: 10 } },
        { name: 'Right Hand (f_hand_r)', boneId: 'wrist_r', bounds: { x: 533, y: 349, width: 88, height: 80 }, pivot: { x: 32, y: 23 } },
        { name: 'Left Thigh (f_leg_upper_l)', boneId: 'hip_l', bounds: { x: 973, y: 158, width: 95, height: 123 }, pivot: { x: 44, y: 16 } },
        { name: 'Left Calf (f_leg_lower_l)', boneId: 'knee_l', bounds: { x: 981, y: 278, width: 87, height: 92 }, pivot: { x: 45, y: 14 } },
        { name: 'Left Boot (f_foot_l)', boneId: 'ankle_l', bounds: { x: 995, y: 370, width: 94, height: 80 }, pivot: { x: 33, y: 10 } },
        { name: 'Right Thigh (f_leg_upper_r)', boneId: 'hip_r', bounds: { x: 829, y: 160, width: 92, height: 128 }, pivot: { x: 54, y: 14 } },
        { name: 'Right Calf (f_leg_lower_r)', boneId: 'knee_r', bounds: { x: 828, y: 286, width: 86, height: 99 }, pivot: { x: 40, y: 12 } },
        { name: 'Right Boot (f_foot_r)', boneId: 'ankle_r', bounds: { x: 813, y: 382, width: 89, height: 70 }, pivot: { x: 52, y: 11 } },
      ];

      for (const elem of ronaldElements) {
        const off = document.createElement('canvas');
        off.width = elem.bounds.width;
        off.height = elem.bounds.height;
        const ctx = off.getContext('2d');
        if (!ctx) continue;
        ctx.drawImage(img, elem.bounds.x, elem.bounds.y, elem.bounds.width, elem.bounds.height, 0, 0, elem.bounds.width, elem.bounds.height);
        const dataUrl = off.toDataURL('image/png');

        const partImg = new Image();
        partImg.onload = () => {
          this.canvas?.render();
        };
        partImg.src = dataUrl;

        const pX = elem.pivot.x / elem.bounds.width;
        const pY = elem.pivot.y / elem.bounds.height;

        this.partsLibrary.push({
          id: `ronald_${elem.name.replace(/\W+/g, '_')}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: elem.name,
          imageUrl: dataUrl,
          image: partImg,
          width: elem.bounds.width,
          height: elem.bounds.height,
          assignedBoneId: elem.boneId || null,
          pivotX: pX,
          pivotY: pY
        });
      }

      if (autoAssemble) {
        this.assembleAllRonaldParts();
      } else {
        this.activeRightTab = 'parts';
        this.renderRightSidebar();
      }
    };
    img.src = demoUrl;
  }

  private renderRightSidebar(): void {
    const sidebar = this.container.querySelector('#right-sidebar') as HTMLElement;
    if (!sidebar) return;

    if (this.activeStudioMode === 'slicer') {
      this.renderSlicerRightSidebar();
      return;
    }

    const currentArt = this.views[this.activeView];
    const attachedCount = Object.keys(currentArt.parts).length;
    const libCount = this.partsLibrary.length;

    sidebar.innerHTML = `
      <div class="sidebar-tabs-header">
        <div class="sidebar-tab-toggle" style="display:flex; width:100%; gap:4px;">
          <button class="sidebar-tab-btn ${this.activeRightTab === 'bones' ? 'active' : ''}" data-tab="bones" style="flex:1;">
            Joints & Bones
          </button>
          <button class="sidebar-tab-btn ${this.activeRightTab === 'parts' ? 'active' : ''}" data-tab="parts" style="flex:1.2;">
            Parts Library ${libCount > 0 ? `(${libCount})` : ''}
          </button>
          <button class="sidebar-tab-btn ${this.activeRightTab === 'layers' ? 'active' : ''}" data-tab="layers" style="flex:0.8;">
            Layers
          </button>
        </div>
      </div>

      <div class="sidebar-content" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:10px;">
        ${this.activeRightTab === 'bones' ? `
          <!-- Joints & Bones Inspector Panel -->
          <div style="display:flex; flex-direction:column; gap:8px;">
            <div style="font-size:0.72rem; color:#94a3b8; line-height:1.35; padding:2px 0;">
              Joints are pivot points (wrist, elbow, knee, shoulder). Each bone starts from a joint, has length, and is wrapped in an envelope.
            </div>

            <button class="btn-studio" id="btn-snap-fit-defaults" style="font-size:0.7rem; justify-content:center; width:100%; color:#38bdf8; border-color:rgba(56, 189, 248, 0.4);" title="Snap all joints and bones to accurate anatomical character defaults">
              ↺ Fit Joints & Bones to Ronald
            </button>

            <!-- Quick Joint Pivot Selector Pills -->
            <div style="display:flex; flex-direction:column; gap:4px; margin-top:2px;">
              <span style="font-size:0.68rem; font-weight:700; color:#e2e8f0; text-transform:uppercase; letter-spacing:0.04em;">Joint Pivots:</span>
              <div style="display:flex; flex-wrap:wrap; gap:4px;">
                ${ANATOMICAL_JOINTS.map(j => {
                  const isSel = this.selectedJointId === j.id;
                  return `
                    <button class="btn-select-pivot ${isSel ? 'active' : ''}" data-joint-id="${j.id}" style="background:${isSel ? '#2563eb' : '#0f172a'}; border:1px solid ${isSel ? '#38bdf8' : 'rgba(255,255,255,0.1)'}; color:#f1f5f9; font-size:0.65rem; padding:3px 6px; border-radius:4px; cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
                      <span style="background:${j.color}; width:6px; height:6px; border-radius:50%; display:inline-block;"></span>
                      ${j.name}
                    </button>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- Bones & Envelopes Slots List -->
            <div style="display:flex; flex-direction:column; gap:6px; margin-top:4px;">
              <span style="font-size:0.68rem; font-weight:700; color:#e2e8f0; text-transform:uppercase; letter-spacing:0.04em;">Bones & Envelopes:</span>

              ${ANATOMICAL_BONES.map(bone => {
                const isSelected = this.selectedJointId === bone.id;
                const part = currentArt.parts[bone.id];
                const radius = currentArt.envelopes[bone.id] || this.canvas?.getEnvelopeRadius(bone.id) || 18;
                const originJoint = ANATOMICAL_JOINTS.find(j => j.id === bone.originJointId);

                return `
                  <div class="bone-part-slot-card ${isSelected ? 'selected' : ''}" data-bone-id="${bone.id}" style="background:#0f172a; border:1px solid ${isSelected ? '#38bdf8' : 'rgba(56, 189, 248, 0.15)'}; border-radius:6px; padding:6px 8px; display:flex; flex-direction:column; gap:5px; transition:all 0.15s;">
                    <div style="display:flex; align-items:center; justify-content:space-between;">
                      <div style="display:flex; align-items:center; gap:6px; font-weight:600; font-size:0.75rem; color:#f1f5f9; cursor:pointer;" class="btn-focus-bone" data-bone-id="${bone.id}">
                        <span style="background:${originJoint?.color || '#38bdf8'}; width:8px; height:8px; border-radius:50%; display:inline-block;"></span>
                        <span>${bone.name}</span>
                      </div>
                      <span style="font-size:0.62rem; color:#94a3b8; font-style:italic;">
                        ${originJoint ? `Pivots at ${originJoint.name}` : ''}
                      </span>
                    </div>

                    <div style="font-size:0.62rem; color:#64748b; line-height:1.2;">
                      ${bone.description}
                    </div>

                    <!-- Envelope Radius Slider for this Bone -->
                    <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; background:rgba(255,255,255,0.03); border-radius:4px; padding:3px 6px;">
                      <span style="font-size:0.62rem; color:#94a3b8;">Envelope:</span>
                      <input type="range" class="bone-envelope-slider" data-bone-id="${bone.id}" min="8" max="55" step="1" value="${radius}" style="flex:1; height:4px;" />
                      <span class="bone-envelope-label" data-bone-id="${bone.id}" style="font-size:0.62rem; color:#38bdf8; font-family:var(--studio-font-mono); font-weight:700; width:28px; text-align:right;">${radius}px</span>
                    </div>

                    <!-- Attached Part or Drop Target -->
                    ${part ? `
                      <div style="display:flex; flex-direction:column; gap:4px; background:rgba(0,0,0,0.4); border-radius:4px; padding:5px 7px; border:1px solid rgba(56, 189, 248, 0.25);">
                        <div style="display:flex; align-items:center; gap:8px;">
                          <img src="${part.imageUrl}" style="width:34px; height:34px; object-fit:contain; border-radius:3px; background:rgba(255,255,255,0.05);" />
                          <div style="flex:1; min-width:0;">
                            <div style="font-size:0.68rem; color:#e2e8f0; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${part.fileName}">
                              ${part.fileName}
                            </div>
                            <div style="font-size:0.58rem; color:#38bdf8;" class="part-pivot-label" data-bone-id="${bone.id}">
                              Pivot: (${Math.round((part.pivotX ?? 0.5) * 100)}%, ${Math.round((part.pivotY ?? 0.5) * 100)}%)
                            </div>
                          </div>
                          <button class="btn-danger-part btn-remove-bone-part" data-bone-id="${bone.id}" style="padding:2px 6px; font-size:0.62rem;" title="Remove graphic from this bone">✕ Detach</button>
                        </div>

                        <!-- Bone Origin & Target Overrides -->
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:4px; margin-top:2px; background:rgba(0,0,0,0.25); border-radius:3px; padding:2px 4px;">
                          <div style="display:flex; align-items:center; gap:2px;">
                            <span style="font-size:0.56rem; color:#94a3b8; white-space:nowrap;">Orig:</span>
                            <select class="bone-part-origin-select" data-bone-id="${bone.id}" style="flex:1; min-width:0; font-size:0.58rem; background:#0b1120; border:1px solid rgba(255,255,255,0.12); color:#f1f5f9; border-radius:2px; padding:1px 2px;">
                              <option value="">Default (${originJoint?.name || bone.originJointId})</option>
                              ${ANATOMICAL_JOINTS.map(j => `
                                <option value="${j.id}" ${(part.originJointId || bone.originJointId) === j.id ? 'selected' : ''}>${j.name}</option>
                              `).join('')}
                            </select>
                          </div>
                          <div style="display:flex; align-items:center; gap:2px;">
                            <span style="font-size:0.56rem; color:#38bdf8; white-space:nowrap;">Tgt:</span>
                            <select class="bone-part-target-select" data-bone-id="${bone.id}" style="flex:1; min-width:0; font-size:0.58rem; background:#0b1120; border:1px solid rgba(255,255,255,0.12); color:#38bdf8; border-radius:2px; padding:1px 2px;">
                              <option value="">Default (${bone.targetJointId})</option>
                              ${ANATOMICAL_JOINTS.map(j => `
                                <option value="${j.id}" ${(part.targetJointId || bone.targetJointId) === j.id ? 'selected' : ''}>${j.name}</option>
                              `).join('')}
                            </select>
                          </div>
                        </div>

                        <!-- Alignment Quick Actions Bar -->
                        <div style="display:flex; flex-wrap:wrap; gap:3px; margin-top:3px; padding-top:4px; border-top:1px solid rgba(255,255,255,0.06);">
                          <button class="btn-align-micro btn-part-center" data-bone-id="${bone.id}" title="Center graphic along bone">🎯 Center</button>
                          <button class="btn-align-micro btn-part-snap-pivot" data-bone-id="${bone.id}" title="Snap graphic pivot to origin joint">📍 Snap Pivot</button>
                          <button class="btn-align-micro btn-part-fliph" data-bone-id="${bone.id}" title="Flip graphic horizontally (H)">↔️ Flip H</button>
                          <button class="btn-align-micro btn-part-flipv" data-bone-id="${bone.id}" title="Flip graphic vertically (V)">↕️ Flip V</button>
                          <button class="btn-align-micro btn-part-rot90" data-bone-id="${bone.id}" title="Rotate by 90°">↺ +90°</button>
                          <button class="btn-align-micro btn-part-reset" data-bone-id="${bone.id}" title="Reset alignment (R)">🔄 Reset</button>
                        </div>

                        <!-- Alignment Sliders -->
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:4px; margin-top:2px;">
                          <div style="display:flex; align-items:center; gap:3px;">
                            <span style="font-size:0.58rem; color:#94a3b8; width:28px;">Scale:</span>
                            <input type="range" class="part-scale-slider" data-bone-id="${bone.id}" min="0.1" max="3.0" step="0.02" value="${part.scale || 1.0}" style="flex:1; height:3px;" />
                            <span class="part-scale-label" data-bone-id="${bone.id}" style="font-size:0.58rem; color:#38bdf8; width:28px; text-align:right;">${Math.round((part.scale || 1.0) * 100)}%</span>
                          </div>
                          <div style="display:flex; align-items:center; gap:3px;">
                            <span style="font-size:0.58rem; color:#94a3b8; width:28px;">Rot:</span>
                            <input type="range" class="part-rot-slider" data-bone-id="${bone.id}" min="-3.1415" max="3.1415" step="0.02" value="${part.rotation || 0}" style="flex:1; height:3px;" />
                            <span class="part-rot-label" data-bone-id="${bone.id}" style="font-size:0.58rem; color:#38bdf8; width:28px; text-align:right;">${Math.round((part.rotation || 0) * 180 / Math.PI)}°</span>
                          </div>
                          <div style="display:flex; align-items:center; gap:3px;">
                            <span style="font-size:0.58rem; color:#94a3b8; width:28px;">Off X:</span>
                            <input type="range" class="part-offx-slider" data-bone-id="${bone.id}" min="-250" max="250" step="1" value="${Math.round(part.offsetX || 0)}" style="flex:1; height:3px;" />
                            <span class="part-offx-label" data-bone-id="${bone.id}" style="font-size:0.58rem; color:#38bdf8; width:28px; text-align:right;">${Math.round(part.offsetX || 0)}px</span>
                          </div>
                          <div style="display:flex; align-items:center; gap:3px;">
                            <span style="font-size:0.58rem; color:#94a3b8; width:28px;">Off Y:</span>
                            <input type="range" class="part-offy-slider" data-bone-id="${bone.id}" min="-250" max="250" step="1" value="${Math.round(part.offsetY || 0)}" style="flex:1; height:3px;" />
                            <span class="part-offy-label" data-bone-id="${bone.id}" style="font-size:0.58rem; color:#38bdf8; width:28px; text-align:right;">${Math.round(part.offsetY || 0)}px</span>
                          </div>
                        </div>
                        <div style="font-size:0.58rem; color:#64748b; font-style:italic;">
                          💡 Drag graphic, rotate handle, or scale corners directly on canvas!
                        </div>
                      </div>
                    ` : `
                      <div class="bone-drop-target-area" data-bone-id="${bone.id}" style="border:1px dashed rgba(56, 189, 248, 0.35); border-radius:4px; padding:5px 6px; text-align:center; font-size:0.65rem; color:#94a3b8; cursor:pointer; background:rgba(56, 189, 248, 0.02); transition:all 0.15s;">
                        📥 Drag & Drop part graphic here (or click to upload)
                      </div>
                    `}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : this.activeRightTab === 'parts' ? `
          <!-- Parts Library Tab -->
          <div style="display:flex; flex-direction:column; gap:8px;">
            <div style="font-size:0.72rem; color:#94a3b8; line-height:1.35; padding:2px 0;">
              Import individual PNG graphics or auto-slice spritesheets. Drag and drop graphics directly onto bones on the canvas or into bone slots!
            </div>

            <!-- Launch Slicer Button -->
            <button class="btn-studio btn-studio-primary" id="btn-open-slicer" style="font-size:0.75rem; padding:8px 8px; justify-content:center; background:#0284c7; border-color:#38bdf8; font-weight:700;" title="Open Element Slicer to load image, mark elements and assign them to bones">
              ✂️ Open Element Slicer & Mark Elements on Image...
            </button>

            <!-- Toolbar Actions -->
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px;">
              <button class="btn-studio" id="btn-import-lib-images" style="font-size:0.7rem; padding:6px 4px; justify-content:center;" title="Select one or more PNG image files from your computer">
                📁 Import Images...
              </button>
              <button class="btn-studio" id="btn-import-lib-spritesheet" style="font-size:0.7rem; padding:6px 4px; justify-content:center;" title="Select a multi-part character spritesheet to automatically extract all islands into parts">
                ✂️ Spritesheet Slice...
              </button>
            </div>

            <div style="display:flex; flex-direction:column; gap:5px;">
              <button class="btn-studio btn-studio-primary" id="btn-assemble-all-ronald" style="font-size:0.72rem; padding:7px 8px; justify-content:center; background:#059669; border-color:#10b981; font-weight:700;" title="Instantly assemble all Ronald body parts to their skeleton bones with game-quality seamless alignment">
                ⚡ Assemble Ronald Character
              </button>
              <button class="btn-studio" id="btn-load-ronald-parts" style="font-size:0.7rem; padding:5px 6px; justify-content:center;" title="Load all pre-cut Ronald parts from demo assets into library">
                ⚔️ Reload Ronald Parts Library
              </button>
            </div>

            ${libCount > 0 ? `
              <div style="display:flex; align-items:center; justify-content:space-between; margin-top:2px;">
                <span style="font-size:0.68rem; font-weight:700; color:#e2e8f0;">${libCount} Parts in Library:</span>
                <button class="btn-danger-part" id="btn-clear-lib" style="padding:2px 6px; font-size:0.64rem;">🗑️ Clear All</button>
              </div>

              <!-- Parts Gallery Grid -->
              <div class="parts-library-grid">
                ${this.partsLibrary.map(item => {
                  const assignedBone = ANATOMICAL_BONES.find(b => b.id === item.assignedBoneId);
                  return `
                    <div class="part-card" data-part-id="${item.id}" draggable="true" title="Drag and drop onto a bone on canvas or list">
                      <div class="part-card-thumb">
                        <img src="${item.imageUrl}" class="part-card-img" alt="${item.name}" />
                      </div>
                      <div class="part-card-name" title="${item.name}">${item.name}</div>
                      <div class="part-card-meta">
                        <span>${item.width}×${item.height}</span>
                        ${assignedBone ? `
                          <span class="part-status-badge attached" title="Attached to ${assignedBone.name}">Attached</span>
                        ` : `
                          <span class="part-status-badge unassigned">Ready</span>
                        `}
                      </div>

                      <!-- 1-Click Bone Assignment Dropdown -->
                      <select class="part-assign-select" data-part-id="${item.id}" style="width:100%; font-size:0.6rem; background:#0b0f19; border:1px solid rgba(255,255,255,0.12); color:#e2e8f0; border-radius:3px; padding:2px; margin-top:2px;">
                        <option value="">Assign to Bone...</option>
                        ${ANATOMICAL_BONES.map(b => `
                          <option value="${b.id}" ${item.assignedBoneId === b.id ? 'selected' : ''}>${b.name}</option>
                        `).join('')}
                      </select>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : `
              <div style="background:#0f172a; border:1px dashed rgba(148, 163, 184, 0.2); border-radius:6px; padding:18px 12px; text-align:center; color:#64748b; font-size:0.72rem; line-height:1.4; margin-top:4px;">
                No parts in library yet.<br />
                Click <b>Load Ronald Demo Parts</b> above or import your own PNG files or spritesheets!
              </div>
            `}
          </div>
        ` : `
          <!-- Layers Tab -->
          <div class="layers-list">
            ${currentArt.image ? `
              <div class="layer-item-row selected">
                <button class="layer-eye-btn" title="Toggle visibility">👁</button>
                <span class="layer-name" title="${currentArt.fileName}">${currentArt.fileName} (Base Body)</span>
              </div>
            ` : `
              <div class="layers-empty-text">No body artwork loaded yet</div>
            `}

            <!-- Attached Parts Layers -->
            ${Object.entries(currentArt.parts).map(([bId, p]) => {
              const bDef = ANATOMICAL_BONES.find(b => b.id === bId);
              return `
                <div class="layer-item-row" data-part-bone="${bId}" style="border-left:3px solid #38bdf8; cursor:pointer;">
                  <button class="layer-eye-btn" title="Toggle visibility">👁</button>
                  <span class="layer-name" title="${p.fileName}">
                    <b style="color:#38bdf8;">${bDef?.name || bId}:</b> ${p.fileName}
                  </span>
                  <button class="btn-danger-part btn-remove-part-layer" data-part-bone="${bId}" style="padding:2px 5px;" title="Remove this part">✕</button>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `;

    // Tab toggle events
    sidebar.querySelectorAll('.sidebar-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab') as 'bones' | 'parts' | 'layers';
        if (tab) {
          this.activeRightTab = tab;
          this.renderRightSidebar();
        }
      });
    });

    // Fit Defaults button
    sidebar.querySelector('#btn-snap-fit-defaults')?.addEventListener('click', () => {
      this.snapRigToCharacterFit();
    });

    // Pivot select buttons
    sidebar.querySelectorAll('.btn-select-pivot').forEach(btn => {
      btn.addEventListener('click', () => {
        const jId = btn.getAttribute('data-joint-id') as AnatomicalJointId;
        if (jId) {
          this.selectedJointId = jId;
          this.canvas?.selectJoint(jId);
          this.renderRightSidebar();
        }
      });
    });

    // Bone focus buttons
    sidebar.querySelectorAll('.btn-focus-bone').forEach(el => {
      el.addEventListener('click', () => {
        const bId = el.getAttribute('data-bone-id') as AnatomicalJointId;
        if (bId) {
          this.selectedJointId = bId;
          this.canvas?.selectJoint(bId);
          this.renderRightSidebar();
        }
      });
    });

    // Envelope sliders for bones
    sidebar.querySelectorAll('.bone-envelope-slider').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const input = e.target as HTMLInputElement;
        const bId = input.getAttribute('data-bone-id') as AnatomicalJointId;
        const val = parseInt(input.value, 10);
        if (bId) {
          currentArt.envelopes[bId] = val;
          this.canvas?.setEnvelopeRadius(bId, val);
          const label = sidebar.querySelector(`.bone-envelope-label[data-bone-id="${bId}"]`);
          if (label) label.textContent = `${val}px`;
        }
      });
    });

    // Bone Drop Target Area click to upload
    sidebar.querySelectorAll('.bone-drop-target-area').forEach(box => {
      box.addEventListener('click', () => {
        const bId = box.getAttribute('data-bone-id') as AnatomicalJointId;
        if (bId) {
          this.selectedJointId = bId;
          const partInput = this.container.querySelector('#input-part-upload') as HTMLInputElement;
          partInput?.click();
        }
      });

      // Drag and drop onto bone slot card
      box.addEventListener('dragover', (e) => {
        e.preventDefault();
        box.classList.add('drag-target-active');
      });
      box.addEventListener('dragleave', () => {
        box.classList.remove('drag-target-active');
      });
      box.addEventListener('drop', (evt: Event) => {
        const e = evt as DragEvent;
        e.preventDefault();
        box.classList.remove('drag-target-active');
        const bId = box.getAttribute('data-bone-id') as AnatomicalJointId;
        const partJson = e.dataTransfer?.getData('application/rig-part');
        if (bId && partJson) {
          try {
            const partData = JSON.parse(partJson);
            this.attachPartToBone(bId, partData);
          } catch {}
        }
      });
    });

    // Remove bone part button
    sidebar.querySelectorAll('.btn-remove-bone-part').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const bId = btn.getAttribute('data-bone-id') as AnatomicalJointId;
        if (bId) {
          this.removePartFromBone(bId);
        }
      });
    });

    // Quick Alignment Buttons in Bone Part Cards
    sidebar.querySelectorAll('.btn-part-center').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const bId = btn.getAttribute('data-bone-id') as AnatomicalJointId;
        if (bId) this.canvas?.centerPartOnBone(bId);
      });
    });

    sidebar.querySelectorAll('.btn-part-snap-pivot').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const bId = btn.getAttribute('data-bone-id') as AnatomicalJointId;
        if (bId) this.canvas?.snapPartPivotToJoint(bId);
      });
    });

    sidebar.querySelectorAll('.btn-part-fliph').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const bId = btn.getAttribute('data-bone-id') as AnatomicalJointId;
        if (bId) this.canvas?.flipPartHorizontal(bId);
      });
    });

    sidebar.querySelectorAll('.btn-part-flipv').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const bId = btn.getAttribute('data-bone-id') as AnatomicalJointId;
        if (bId) this.canvas?.flipPartVertical(bId);
      });
    });

    sidebar.querySelectorAll('.btn-part-rot90').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const bId = btn.getAttribute('data-bone-id') as AnatomicalJointId;
        if (bId) this.canvas?.rotatePart90(bId, true);
      });
    });

    sidebar.querySelectorAll('.btn-part-reset').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const bId = btn.getAttribute('data-bone-id') as AnatomicalJointId;
        if (bId) this.canvas?.resetPartTransform(bId);
      });
    });

    // Part alignment sliders
    sidebar.querySelectorAll('.part-scale-slider').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const input = e.target as HTMLInputElement;
        const bId = input.getAttribute('data-bone-id') as AnatomicalJointId;
        const val = parseFloat(input.value);
        if (bId && currentArt.parts[bId]) {
          currentArt.parts[bId].scale = val;
          this.canvas?.setPart(bId, currentArt.parts[bId]);
          const label = sidebar.querySelector(`.part-scale-label[data-bone-id="${bId}"]`);
          if (label) label.textContent = `${((val) * 100).toFixed(0)}%`;
        }
      });
    });

    sidebar.querySelectorAll('.part-rot-slider').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const input = e.target as HTMLInputElement;
        const bId = input.getAttribute('data-bone-id') as AnatomicalJointId;
        const val = parseFloat(input.value);
        if (bId && currentArt.parts[bId]) {
          currentArt.parts[bId].rotation = val;
          this.canvas?.setPart(bId, currentArt.parts[bId]);
          const label = sidebar.querySelector(`.part-rot-label[data-bone-id="${bId}"]`);
          if (label) label.textContent = `${Math.round(val * 180 / Math.PI)}°`;
        }
      });
    });

    sidebar.querySelectorAll('.part-offx-slider').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const input = e.target as HTMLInputElement;
        const bId = input.getAttribute('data-bone-id') as AnatomicalJointId;
        const val = parseInt(input.value, 10);
        if (bId && currentArt.parts[bId]) {
          currentArt.parts[bId].offsetX = val;
          this.canvas?.setPart(bId, currentArt.parts[bId]);
          const label = sidebar.querySelector(`.part-offx-label[data-bone-id="${bId}"]`);
          if (label) label.textContent = `${val}px`;
        }
      });
    });

    sidebar.querySelectorAll('.part-offy-slider').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const input = e.target as HTMLInputElement;
        const bId = input.getAttribute('data-bone-id') as AnatomicalJointId;
        const val = parseInt(input.value, 10);
        if (bId && currentArt.parts[bId]) {
          currentArt.parts[bId].offsetY = val;
          this.canvas?.setPart(bId, currentArt.parts[bId]);
          const label = sidebar.querySelector(`.part-offy-label[data-bone-id="${bId}"]`);
          if (label) label.textContent = `${val}px`;
        }
      });
    });

    sidebar.querySelectorAll('.bone-part-origin-select').forEach(sel => {
      sel.addEventListener('change', () => {
        const select = sel as HTMLSelectElement;
        const bId = select.getAttribute('data-bone-id') as AnatomicalJointId;
        const origId = (select.value || undefined) as AnatomicalJointId | undefined;
        if (bId && currentArt.parts[bId]) {
          this.recordHistory('Change Part Origin Joint');
          currentArt.parts[bId].originJointId = origId;
          this.canvas?.setPart(bId, currentArt.parts[bId]);
        }
      });
    });

    sidebar.querySelectorAll('.bone-part-target-select').forEach(sel => {
      sel.addEventListener('change', () => {
        const select = sel as HTMLSelectElement;
        const bId = select.getAttribute('data-bone-id') as AnatomicalJointId;
        const tgtId = (select.value || undefined) as AnatomicalJointId | undefined;
        if (bId && currentArt.parts[bId]) {
          this.recordHistory('Change Part Target Joint');
          currentArt.parts[bId].targetJointId = tgtId;
          this.canvas?.setPart(bId, currentArt.parts[bId]);
        }
      });
    });

    // Parts Library Actions
    sidebar.querySelector('#btn-open-slicer')?.addEventListener('click', () => {
      this.switchStudioMode('slicer');
    });

    sidebar.querySelector('#btn-assemble-all-ronald')?.addEventListener('click', () => {
      this.assembleAllRonaldParts();
    });

    sidebar.querySelector('#btn-import-lib-images')?.addEventListener('click', () => {
      const input = this.container.querySelector('#input-library-files-upload') as HTMLInputElement;
      input?.click();
    });

    sidebar.querySelector('#btn-import-lib-spritesheet')?.addEventListener('click', () => {
      const input = this.container.querySelector('#input-spritesheet-upload') as HTMLInputElement;
      input?.click();
    });

    sidebar.querySelector('#btn-load-ronald-parts')?.addEventListener('click', () => {
      this.loadRonaldDemoParts();
    });

    sidebar.querySelector('#btn-clear-lib')?.addEventListener('click', () => {
      this.partsLibrary = [];
      this.renderRightSidebar();
    });

    // Draggable Part Cards in Library
    sidebar.querySelectorAll('.part-card').forEach(card => {
      card.addEventListener('dragstart', (evt: Event) => {
        const e = evt as DragEvent;
        const pId = card.getAttribute('data-part-id');
        const item = this.partsLibrary.find(p => p.id === pId);
        if (item && e.dataTransfer) {
          card.classList.add('dragging');
          this.canvas?.setDragHoverPart(item);
          e.dataTransfer.setData('application/rig-part', JSON.stringify({
            id: item.id,
            name: item.name,
            imageUrl: item.imageUrl,
            width: item.width,
            height: item.height,
            pivotX: item.pivotX,
            pivotY: item.pivotY
          }));
          e.dataTransfer.effectAllowed = 'copy';
        }
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        this.canvas?.setDragHoverPart(null);
      });
    });

    // 1-Click Bone Assignment Dropdown
    sidebar.querySelectorAll('.part-assign-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const sel = e.target as HTMLSelectElement;
        const pId = sel.getAttribute('data-part-id');
        const boneId = sel.value as AnatomicalJointId;
        const item = this.partsLibrary.find(p => p.id === pId);
        if (item && boneId) {
          this.attachPartToBone(boneId, item);
        }
      });
    });

    // Remove Part from Layer row
    sidebar.querySelectorAll('.btn-remove-part-layer').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const bId = btn.getAttribute('data-part-bone') as AnatomicalJointId;
        if (bId) {
          this.removePartFromBone(bId);
        }
      });
    });
  }

  public setToolMode(mode: JointToolMode): void {
    this.toolMode = mode;
    this.canvas?.setToolMode(mode);

    if (mode === 'add_joint') {
      this.activeRightTab = 'bones';
    }

    const hudTool = this.container.querySelector('#hud-active-tool');
    if (hudTool) hudTool.textContent = mode.toUpperCase().replace('_', ' ');

    this.renderLeftSidebar();
    this.renderRightSidebar();
  }

  private copyJointsFromFrontView(): void {
    const frontJoints = this.views.front.joints;
    const copied = copyJointsFromFront(frontJoints, this.activeView);
    this.views[this.activeView].joints = copied;
    this.canvas?.setJoints(copied);
    this.renderRightSidebar();
  }

  private handleFileUpload(file: File): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const fileSizeStr = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
        const currentArt = this.views[this.activeView];
        currentArt.image = img;
        currentArt.imageUrl = dataUrl;
        currentArt.fileName = file.name;
        currentArt.fileSize = fileSizeStr;

        this.canvas?.setSourceImage(img, file.name);

        this.activeRightTab = 'bones';
        this.renderLeftSidebar();
        this.renderRightSidebar();
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  private handlePartUpload(file: File, boneId: AnatomicalJointId): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const currentArt = this.views[this.activeView];
        const part: BonePartAttachment = {
          boneId,
          image: img,
          imageUrl: dataUrl,
          fileName: file.name,
          fileSize: `${(file.size / 1024).toFixed(0)} KB`,
          scale: 1.0,
          rotation: 0
        };

        currentArt.parts[boneId] = part;
        this.canvas?.setPart(boneId, part);
        this.renderRightSidebar();
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  private handleBatchPartsUpload(files: FileList | File[]): void {
    const matchBoneFromFilename = (name: string): AnatomicalJointId | null => {
      const lower = name.toLowerCase().replace(/[-_.\s]/g, '');
      if (lower.includes('head')) return 'head';
      if (lower.includes('neck') || lower.includes('torso') || lower.includes('body') || lower.includes('chest')) return 'neck';
      if (lower.includes('shoulderl') || lower.includes('upperarml') || lower.includes('leftupperarm') || lower.includes('bicepl')) return 'shoulder_l';
      if (lower.includes('shoulderr') || lower.includes('upperarmr') || lower.includes('rightupperarm') || lower.includes('bicepr')) return 'shoulder_r';
      if (lower.includes('elbowl') || lower.includes('forearml') || lower.includes('lowerarml') || lower.includes('leftforearm')) return 'elbow_l';
      if (lower.includes('elbowr') || lower.includes('forearmr') || lower.includes('lowerarmr') || lower.includes('rightforearm')) return 'elbow_r';
      if (lower.includes('wristl') || lower.includes('handl') || lower.includes('lefthand') || lower.includes('glovel')) return 'wrist_l';
      if (lower.includes('wristr') || lower.includes('handr') || lower.includes('righthand') || lower.includes('glover')) return 'wrist_r';
      if (lower.includes('hipl') || lower.includes('thighl') || lower.includes('upperlegl') || lower.includes('leftthigh')) return 'hip_l';
      if (lower.includes('hipr') || lower.includes('thighr') || lower.includes('upperlegr') || lower.includes('rightthigh')) return 'hip_r';
      if (lower.includes('kneel') || lower.includes('shinl') || lower.includes('calfl') || lower.includes('lowerlegl') || lower.includes('leftshin')) return 'knee_l';
      if (lower.includes('kneer') || lower.includes('shinr') || lower.includes('calfr') || lower.includes('lowerlegr') || lower.includes('rightshin')) return 'knee_r';
      if (lower.includes('anklel') || lower.includes('footl') || lower.includes('leftfoot') || lower.includes('bootl')) return 'ankle_l';
      if (lower.includes('ankler') || lower.includes('footr') || lower.includes('rightfoot') || lower.includes('bootr')) return 'ankle_r';
      if (lower.includes('arml') || lower.includes('leftarm')) return 'shoulder_l';
      if (lower.includes('armr') || lower.includes('rightarm')) return 'shoulder_r';
      if (lower.includes('legl') || lower.includes('leftleg')) return 'hip_l';
      if (lower.includes('legr') || lower.includes('rightleg')) return 'hip_r';
      return null;
    };

    Array.from(files).forEach(file => {
      const boneId = matchBoneFromFilename(file.name);
      if (boneId) {
        this.handlePartUpload(file, boneId);
      }
    });
    this.activeRightTab = 'parts';
  }

  private handleAutoExtractParts(): void {
    if (!this.canvas) return;
    const extracted = this.canvas.autoExtractBoneParts();
    if (Object.keys(extracted).length === 0) return;

    const currentArt = this.views[this.activeView];
    currentArt.parts = { ...currentArt.parts, ...extracted };
    this.canvas.setParts(currentArt.parts);
    this.activeRightTab = 'parts';
    this.renderRightSidebar();
  }

  private removePartFromBone(boneId: AnatomicalJointId): void {
    const currentArt = this.views[this.activeView];
    delete currentArt.parts[boneId];
    this.canvas?.setPart(boneId, null);
    this.renderRightSidebar();
  }

  public loadImageFromUrl(url: string, fileName = 'character_front.png', targetView: StudioView = 'front', updateCanvas = true): void {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const art = this.views[targetView];
      art.image = img;
      art.imageUrl = url;
      art.fileName = fileName;
      art.fileSize = '1.2 MB';

      if (updateCanvas && targetView === this.activeView) {
        this.canvas?.setSourceImage(img, fileName);
        art.joints = this.canvas?.getJoints() || art.joints;
        if (Object.keys(art.parts).length > 0) {
          this.canvas?.setParts(art.parts);
        }
      }
      this.renderLeftSidebar();
      this.renderRightSidebar();
    };
    img.src = url;
  }

  public loadDemoCharacter(autoAssemble = true): void {
    // 1. Clear existing parts library and view attachments
    this.partsLibrary = [];
    for (const v of Object.values(this.views)) {
      v.parts = {};
    }
    if (this.canvas) {
      this.canvas.setParts({});
    }

    // 2. Load Front demo artwork
    this.loadImageFromUrl('/demo/assets/characters/sir_ronald_front.png', 'character_front.png', 'front', true);
    // Preload Back demo artwork
    this.loadImageFromUrl('/demo/assets/characters/sir_ronald_back.png', 'character_back.png', 'back', false);

    // 3. Snap joints to Ronald anatomical defaults
    this.snapRigToCharacterFit();

    // 4. Pre-populate Ronald demo parts in Parts Library and auto-assemble onto bones
    this.loadRonaldDemoParts(autoAssemble);

    // 5. Pre-populate Ronald elements in Slicer
    this.loadRonaldPreMarkedElementsInSlicer();
  }

  public saveRigProjectJson(): void {
    if (this.canvas) {
      this.views[this.activeView].joints = JSON.parse(JSON.stringify(this.canvas.getJoints()));
      this.views[this.activeView].envelopes = { ...this.canvas.getEnvelopes() };
      this.views[this.activeView].parts = { ...this.canvas.getParts() };
    }

    const viewsExport: Record<string, any> = {};
    for (const [vKey, vData] of Object.entries(this.views)) {
      const partsExport: Record<string, any> = {};
      for (const [pKey, pVal] of Object.entries(vData.parts)) {
        partsExport[pKey] = {
          id: pVal.id,
          boneId: pVal.boneId,
          originJointId: pVal.originJointId,
          targetJointId: pVal.targetJointId,
          fileName: pVal.fileName,
          imageUrl: pVal.imageUrl,
          scale: pVal.scale ?? 1.0,
          offsetX: pVal.offsetX ?? 0,
          offsetY: pVal.offsetY ?? 0,
          rotation: pVal.rotation ?? 0,
          pivotX: pVal.pivotX,
          pivotY: pVal.pivotY,
          width: pVal.width,
          height: pVal.height,
          flipX: pVal.flipX ?? false,
          flipY: pVal.flipY ?? false
        };
      }

      viewsExport[vKey] = {
        label: vData.label,
        imageUrl: vData.imageUrl,
        fileName: vData.fileName,
        fileSize: vData.fileSize,
        joints: vData.joints,
        envelopes: vData.envelopes,
        parts: partsExport
      };
    }

    const partsLibExport = this.partsLibrary.map(item => ({
      id: item.id,
      name: item.name,
      imageUrl: item.imageUrl,
      width: item.width,
      height: item.height,
      assignedBoneId: item.assignedBoneId ?? null,
      pivotX: item.pivotX,
      pivotY: item.pivotY
    }));

    const elementsToExport = this.slicer ? this.slicer.getElements() : this.savedElements;
    const slicerExport = {
      imageUrl: this.slicerImageUrl,
      fileName: this.slicerImageFileName,
      fileSize: this.slicerImageFileSize,
      elements: elementsToExport || []
    };

    const projectData: RigProjectData = {
      format: 'questforge-rig-project',
      version: '1.0',
      characterName: this.characterName,
      activeView: this.activeView,
      views: viewsExport,
      partsLibrary: partsLibExport,
      slicer: slicerExport
    };

    const jsonStr = JSON.stringify(projectData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.characterName.toLowerCase().replace(/\s+/g, '_')}_rigged.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  public handleLoadRigJson(file: File): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = JSON.parse(text);
        this.loadRigProjectData(data);
      } catch (err: any) {
        console.error('Failed to parse rig JSON:', err);
        alert(`Failed to load rig project: ${err.message || 'Invalid JSON format'}`);
      }
    };
    reader.readAsText(file);
  }

  public loadRigProjectData(data: any): void {
    if (data.format === 'questforge-rig-project' || data.views) {
      if (data.characterName) {
        this.characterName = data.characterName;
        this.updateHeaderTitle();
      }

      // 1. Restore Views
      if (data.views) {
        for (const [vKey, vData] of Object.entries(data.views) as [StudioView, any][]) {
          if (!this.views[vKey]) continue;
          const targetView = this.views[vKey];
          targetView.joints = vData.joints || targetView.joints;
          targetView.envelopes = vData.envelopes || targetView.envelopes;
          targetView.fileName = vData.fileName || targetView.fileName;
          targetView.fileSize = vData.fileSize || targetView.fileSize;
          targetView.imageUrl = vData.imageUrl || targetView.imageUrl;

          if (vData.imageUrl) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              targetView.image = img;
              if (this.activeView === vKey) {
                this.canvas?.setSourceImage(img, targetView.fileName, false);
                this.canvas?.render();
              }
            };
            img.src = vData.imageUrl;
          }

          targetView.parts = {};
          if (vData.parts) {
            for (const [boneId, partData] of Object.entries(vData.parts) as [AnatomicalJointId, any][]) {
              const partImg = new Image();
              partImg.crossOrigin = 'anonymous';
              partImg.onload = () => this.canvas?.render();
              partImg.src = partData.imageUrl;

              targetView.parts[boneId] = {
                id: partData.id,
                boneId,
                originJointId: partData.originJointId,
                targetJointId: partData.targetJointId,
                fileName: partData.fileName || `${boneId}.png`,
                imageUrl: partData.imageUrl,
                image: partImg,
                scale: partData.scale ?? 1.0,
                offsetX: partData.offsetX ?? 0,
                offsetY: partData.offsetY ?? 0,
                rotation: partData.rotation ?? 0,
                pivotX: partData.pivotX,
                pivotY: partData.pivotY,
                flipX: partData.flipX ?? false,
                flipY: partData.flipY ?? false,
                width: partData.width,
                height: partData.height,
                visible: true,
                opacity: 1
              };
            }
          }
        }
      }

      // 2. Restore Parts Library
      if (Array.isArray(data.partsLibrary)) {
        this.partsLibrary = [];
        for (const item of data.partsLibrary) {
          const libImg = new Image();
          libImg.crossOrigin = 'anonymous';
          libImg.onload = () => this.canvas?.render();
          libImg.src = item.imageUrl;

          this.partsLibrary.push({
            id: item.id,
            name: item.name,
            imageUrl: item.imageUrl,
            image: libImg,
            width: item.width || 64,
            height: item.height || 64,
            assignedBoneId: item.assignedBoneId || null,
            pivotX: item.pivotX,
            pivotY: item.pivotY
          });
        }
      }

      // 3. Restore Slicer Elements & Image
      if (data.slicer) {
        if (Array.isArray(data.slicer.elements)) {
          this.savedElements = JSON.parse(JSON.stringify(data.slicer.elements));
          if (this.slicer) {
            this.slicer.setElements(this.savedElements);
          }
          this.persistElementsToStorage();
        }
        if (data.slicer.imageUrl) {
          this.loadSlicerImageFromUrl(data.slicer.imageUrl, data.slicer.fileName || 'slicer_sheet.png', data.slicer.fileSize || '');
        }
      }

      // 4. Set active view without overwriting newly loaded data from old canvas state
      const targetActiveView = (data.activeView && this.views[data.activeView as StudioView]) ? (data.activeView as StudioView) : 'front';
      this.activeView = targetActiveView;

      this.container.querySelectorAll('.studio-view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-view') === targetActiveView);
      });

      const hudView = this.container.querySelector('#hud-active-view');
      if (hudView) hudView.textContent = targetActiveView.toUpperCase();

      // 5. Update canvas joints, envelopes, parts
      const activeArt = this.views[this.activeView];
      if (this.canvas) {
        this.canvas.setView(this.activeView, activeArt.joints, activeArt.envelopes, activeArt.parts);
        if (activeArt.image) {
          this.canvas.setSourceImage(activeArt.image, activeArt.fileName, false);
        }
        this.canvas.setParts(activeArt.parts);
        this.canvas.resetPose();
      }

      this.renderLeftSidebar();
      this.renderRightSidebar();
      this.renderCanvasAlignmentBar();
    } else if (data.bones || data.skeleton) {
      if (data.skeleton?.questforge?.elements && this.slicer) {
        this.slicer.setElements(data.skeleton.questforge.elements);
      }
      if (data.skeleton?.questforge?.textureUrl) {
        this.loadImageFromUrl(data.skeleton.questforge.textureUrl, 'imported_texture.png', 'front', true);
      }
    }
  }

  private exportSpineJson(): void {
    const doc = this.buildSpineDocument();
    const jsonStr = JSON.stringify(doc, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.characterName.toLowerCase().replace(/\s+/g, '_')}_skeleton.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private saveRigToHost(): void {
    const spineDoc = this.buildSpineDocument();
    this.bridge.notifySave(spineDoc, this.views.front.imageUrl || '');
  }

  private buildSpineDocument(): SpineDocument {
    const frontJoints = this.views.front.joints;
    const bones = convertJointsToSpineBones(frontJoints, 'front');

    const spineDoc: SpineDocument = {
      skeleton: {
        spine: '3.8.99',
        width: 128,
        height: 256,
        questforge: {
          posePreset: '3-way',
          poseDirections: {
            front: ['down'],
            side: ['right', 'left'],
            back: ['up']
          },
          elements: []
        }
      },
      bones,
      slots: [
        { name: 'hip', bone: 'hip' },
        { name: 'torso', bone: 'torso' },
        { name: 'head', bone: 'head' },
        { name: 'arm_upper_r', bone: 'arm_upper_r' },
        { name: 'arm_lower_r', bone: 'arm_lower_r' },
        { name: 'hand_r', bone: 'hand_r' },
        { name: 'arm_upper_l', bone: 'arm_upper_l' },
        { name: 'arm_lower_l', bone: 'arm_lower_l' },
        { name: 'hand_l', bone: 'hand_l' },
        { name: 'leg_upper_r', bone: 'leg_upper_r' },
        { name: 'leg_lower_r', bone: 'leg_lower_r' },
        { name: 'foot_r', bone: 'foot_r' },
        { name: 'leg_upper_l', bone: 'leg_upper_l' },
        { name: 'leg_lower_l', bone: 'leg_lower_l' },
        { name: 'foot_l', bone: 'foot_l' }
      ],
      skins: [
        { name: 'front', attachments: {} },
        { name: 'back', attachments: {} },
        { name: 'side', attachments: {} }
      ],
      animations: {
        idle: {
          bones: {
            torso: { rotate: [{ time: 0, angle: 0 }, { time: 0.8, angle: 2 }, { time: 1.6, angle: 0 }] },
            head: { rotate: [{ time: 0, angle: 0 }, { time: 0.8, angle: -1.5 }, { time: 1.6, angle: 0 }] }
          }
        }
      }
    };

    return spineDoc;
  }

  private updatePartInspectorValues(boneId: AnatomicalJointId, part: BonePartAttachment): void {
    const sidebar = this.container.querySelector('#studio-right-sidebar');
    if (sidebar) {
      const scaleSlider = sidebar.querySelector(`.part-scale-slider[data-bone-id="${boneId}"]`) as HTMLInputElement | null;
      const scaleLabel = sidebar.querySelector(`.part-scale-label[data-bone-id="${boneId}"]`);
      if (scaleSlider && part.scale !== undefined) {
        scaleSlider.value = String(part.scale);
        if (scaleLabel) scaleLabel.textContent = `${Math.round(part.scale * 100)}%`;
      }

      const rotSlider = sidebar.querySelector(`.part-rot-slider[data-bone-id="${boneId}"]`) as HTMLInputElement | null;
      const rotLabel = sidebar.querySelector(`.part-rot-label[data-bone-id="${boneId}"]`);
      if (rotSlider && part.rotation !== undefined) {
        rotSlider.value = String(part.rotation);
        if (rotLabel) rotLabel.textContent = `${Math.round((part.rotation * 180) / Math.PI)}°`;
      }

      const offxSlider = sidebar.querySelector(`.part-offx-slider[data-bone-id="${boneId}"]`) as HTMLInputElement | null;
      const offxLabel = sidebar.querySelector(`.part-offx-label[data-bone-id="${boneId}"]`);
      if (offxSlider && part.offsetX !== undefined) {
        offxSlider.value = String(Math.round(part.offsetX));
        if (offxLabel) offxLabel.textContent = `${Math.round(part.offsetX)}px`;
      }

      const offySlider = sidebar.querySelector(`.part-offy-slider[data-bone-id="${boneId}"]`) as HTMLInputElement | null;
      const offyLabel = sidebar.querySelector(`.part-offy-label[data-bone-id="${boneId}"]`);
      if (offySlider && part.offsetY !== undefined) {
        offySlider.value = String(Math.round(part.offsetY));
        if (offyLabel) offyLabel.textContent = `${Math.round(part.offsetY)}px`;
      }
    }

    // Sync floating alignment bar without interrupting focused input
    const bar = this.container.querySelector('#canvas-part-alignment-bar');
    if (bar && this.selectedJointId === boneId && part.rotation !== undefined) {
      const rotDeg = Math.round((part.rotation * 180) / Math.PI);
      const hudSlider = bar.querySelector('.hud-rot-slider') as HTMLInputElement | null;
      const hudInput = bar.querySelector('.hud-rot-input') as HTMLInputElement | null;
      if (hudSlider && document.activeElement !== hudSlider) {
        hudSlider.value = String(rotDeg);
      }
      if (hudInput && document.activeElement !== hudInput) {
        hudInput.value = String(rotDeg);
      }
    }
  }

  private renderCanvasAlignmentBar(): void {
    const bar = this.container.querySelector('#canvas-part-alignment-bar') as HTMLElement | null;
    if (!bar) return;

    if (this.activeStudioMode !== 'rig' || !this.selectedJointId) {
      bar.style.display = 'none';
      return;
    }

    const currentArt = this.views[this.activeView];
    const part = currentArt.parts[this.selectedJointId];
    if (!part) {
      bar.style.display = 'none';
      return;
    }

    const boneDef = ANATOMICAL_JOINTS.find(b => b.id === this.selectedJointId);
    const boneLabel = boneDef ? boneDef.name : this.selectedJointId;
    const isLocked = this.canvas?.isLockGraphicPosition() ?? false;
    const rotDeg = Math.round(((part.rotation || 0) * 180) / Math.PI);
    const canUndo = this.undoStack.length > 0;

    bar.style.display = 'flex';
    bar.innerHTML = `
      <div class="align-hud-info">
        <span class="align-hud-badge">🎯 ${boneLabel}</span>
        <span class="align-hud-name" title="${part.fileName}">${part.fileName}</span>
      </div>
      <div class="align-hud-rot-section">
        <span style="font-size:0.65rem; color:#94a3b8; font-weight:600;">Rot:</span>
        <input type="range" class="hud-rot-slider" min="-180" max="180" step="1" value="${rotDeg}" title="Drag to rotate smoothly (-180° to 180°)" />
        <div style="display:flex; align-items:center; gap:1px;">
          <input type="number" class="hud-rot-input" min="-180" max="180" step="1" value="${rotDeg}" title="Type exact degrees (-180° to 180°)" />
          <span style="font-size:0.62rem; color:#38bdf8; font-weight:700;">°</span>
        </div>
        <button class="btn-align-micro" id="hud-btn-rot-m15" title="Rotate -15°">↺ -15°</button>
        <button class="btn-align-micro" id="hud-btn-rot-p15" title="Rotate +15°">↻ +15°</button>
        <button class="btn-align-micro" id="hud-btn-rot-90" title="Rotate +90°">↺ 90°</button>
        <button class="btn-align-micro" id="hud-btn-rot-zero" title="Reset angle to 0°">0°</button>
      </div>
      <div class="align-hud-actions">
        <button class="btn-align-pill" id="hud-btn-center" title="Center graphic along bone length">🎯 Center</button>
        <button class="btn-align-pill" id="hud-btn-snap-pivot" title="Snap graphic pivot to origin joint pin">📍 Snap Pivot</button>
        <button class="btn-align-pill" id="hud-btn-fliph" title="Flip graphic horizontally (H)">↔️ Flip H</button>
        <button class="btn-align-pill" id="hud-btn-flipv" title="Flip graphic vertically (V)">↕️ Flip V</button>
        <button class="btn-align-pill" id="hud-btn-reset" title="Reset alignment transforms (R)">🔄 Reset</button>
        <button class="btn-align-pill ${isLocked ? 'active' : ''}" id="hud-btn-toggle-lock" title="Lock Graphic Position" style="${isLocked ? 'background:#0284c7; border-color:#38bdf8;' : ''}">📌 ${isLocked ? 'Locked' : 'Lock Graphic'}</button>
        <button class="btn-align-pill" id="hud-btn-undo" title="Undo change (Ctrl+Z)" ${canUndo ? '' : 'disabled style="opacity:0.4;"'}>↶ Undo</button>
      </div>
    `;

    const bId = this.selectedJointId;
    const rotSlider = bar.querySelector('.hud-rot-slider') as HTMLInputElement | null;
    const rotInput = bar.querySelector('.hud-rot-input') as HTMLInputElement | null;

    rotSlider?.addEventListener('mousedown', () => {
      this.recordHistory('Rotate Graphic');
    });

    rotSlider?.addEventListener('input', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value, 10);
      if (!isNaN(val)) {
        if (rotInput) rotInput.value = String(val);
        const rad = (val * Math.PI) / 180;
        this.canvas?.setPartRotation(bId, rad);
      }
    });

    rotInput?.addEventListener('focus', () => {
      this.recordHistory('Rotate Graphic');
    });

    rotInput?.addEventListener('input', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value, 10);
      if (!isNaN(val)) {
        if (rotSlider) rotSlider.value = String(val);
        const rad = (val * Math.PI) / 180;
        this.canvas?.setPartRotation(bId, rad);
      }
    });

    bar.querySelector('#hud-btn-rot-m15')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.canvas?.rotatePartBy(bId, (-15 * Math.PI) / 180);
    });

    bar.querySelector('#hud-btn-rot-p15')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.canvas?.rotatePartBy(bId, (15 * Math.PI) / 180);
    });

    bar.querySelector('#hud-btn-rot-90')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.canvas?.rotatePart90(bId, true);
    });

    bar.querySelector('#hud-btn-rot-zero')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.canvas?.setPartRotation(bId, 0);
    });

    bar.querySelector('#hud-btn-center')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.canvas?.centerPartOnBone(bId);
    });

    bar.querySelector('#hud-btn-snap-pivot')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.canvas?.snapPartPivotToJoint(bId);
    });

    bar.querySelector('#hud-btn-fliph')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.canvas?.flipPartHorizontal(bId);
    });

    bar.querySelector('#hud-btn-flipv')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.canvas?.flipPartVertical(bId);
    });

    bar.querySelector('#hud-btn-reset')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.canvas?.resetPartTransform(bId);
    });

    bar.querySelector('#hud-btn-toggle-lock')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const current = this.canvas?.isLockGraphicPosition() ?? false;
      const next = !current;
      this.canvas?.setLockGraphicPosition(next);
      const leftToggle = this.container.querySelector('#toggle-lock-graphics') as HTMLInputElement | null;
      if (leftToggle) leftToggle.checked = next;
      this.renderCanvasAlignmentBar();
    });

    bar.querySelector('#hud-btn-undo')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.undo();
    });
  }

  public recordHistory(description: string): void {
    if (this.isPerformingUndoRedo) return;
    const snap = this.createHistorySnapshot(description);
    this.undoStack.push(snap);
    if (this.undoStack.length > this.MAX_HISTORY_STEPS) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.updateUndoRedoButtons();
  }

  private createHistorySnapshot(description: string): StudioHistoryState {
    const currentArt = this.views[this.activeView];
    const clonedJoints: Record<string, { x: number; y: number }> = this.canvas
      ? JSON.parse(JSON.stringify(this.canvas.getJoints()))
      : JSON.parse(JSON.stringify(currentArt.joints));

    const clonedEnvelopes: Record<string, number> = this.canvas
      ? { ...this.canvas.getEnvelopes() }
      : { ...currentArt.envelopes };

    const clonedParts: Record<string, BonePartAttachment> = {};
    const sourceParts = this.canvas ? this.canvas.getParts() : currentArt.parts;
    for (const [k, v] of Object.entries(sourceParts)) {
      if (v) {
        clonedParts[k] = { ...v };
      }
    }

    return {
      description,
      view: this.activeView,
      joints: clonedJoints,
      envelopes: clonedEnvelopes,
      parts: clonedParts,
      selectedJointId: this.selectedJointId
    };
  }

  public undo(): void {
    if (this.undoStack.length === 0) return;
    this.isPerformingUndoRedo = true;
    try {
      const currentState = this.createHistorySnapshot('Current State');
      this.redoStack.push(currentState);
      const targetState = this.undoStack.pop()!;
      this.restoreHistoryState(targetState);
    } finally {
      this.isPerformingUndoRedo = false;
      this.updateUndoRedoButtons();
    }
  }

  public redo(): void {
    if (this.redoStack.length === 0) return;
    this.isPerformingUndoRedo = true;
    try {
      const currentState = this.createHistorySnapshot('Current State');
      this.undoStack.push(currentState);
      const targetState = this.redoStack.pop()!;
      this.restoreHistoryState(targetState);
    } finally {
      this.isPerformingUndoRedo = false;
      this.updateUndoRedoButtons();
    }
  }

  private restoreHistoryState(state: StudioHistoryState): void {
    if (this.activeView !== state.view) {
      this.switchView(state.view);
    }

    const currentArt = this.views[this.activeView];
    currentArt.joints = JSON.parse(JSON.stringify(state.joints));
    currentArt.envelopes = { ...state.envelopes };
    currentArt.parts = {};
    for (const [k, v] of Object.entries(state.parts)) {
      currentArt.parts[k as AnatomicalJointId] = { ...v };
    }

    if (this.canvas) {
      this.canvas.setJoints(currentArt.joints);
      this.canvas.setEnvelopes(currentArt.envelopes);
      this.canvas.setParts(currentArt.parts);
      this.canvas.selectJoint(state.selectedJointId);
      this.canvas.render();
    }

    this.selectedJointId = state.selectedJointId;
    this.renderLeftSidebar();
    this.renderRightSidebar();
    this.renderCanvasAlignmentBar();
  }

  private updateUndoRedoButtons(): void {
    const undoBtn = this.container.querySelector('#btn-studio-undo') as HTMLButtonElement | null;
    const redoBtn = this.container.querySelector('#btn-studio-redo') as HTMLButtonElement | null;
    const hudUndoBtn = this.container.querySelector('#hud-btn-undo') as HTMLButtonElement | null;

    const canUndo = this.undoStack.length > 0;
    const canRedo = this.redoStack.length > 0;

    if (undoBtn) {
      undoBtn.disabled = !canUndo;
      undoBtn.style.opacity = canUndo ? '1' : '0.4';
      undoBtn.title = canUndo ? `Undo: ${this.undoStack[this.undoStack.length - 1].description} (Ctrl+Z)` : 'Undo (Ctrl+Z)';
    }

    if (redoBtn) {
      redoBtn.disabled = !canRedo;
      redoBtn.style.opacity = canRedo ? '1' : '0.4';
      redoBtn.title = canRedo ? `Redo: ${this.redoStack[this.redoStack.length - 1].description} (Ctrl+Y)` : 'Redo (Ctrl+Y)';
    }

    if (hudUndoBtn) {
      hudUndoBtn.disabled = !canUndo;
      hudUndoBtn.style.opacity = canUndo ? '1' : '0.4';
    }
  }

  private updateHeaderTitle(): void {
    const titleEl = this.container.querySelector('.studio-title');
    if (titleEl) {
      titleEl.textContent = 'Character Rig Studio';
    }
  }
}
