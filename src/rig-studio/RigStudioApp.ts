import {
  AnatomicalJointDef,
  AnatomicalJointId,
  JointToolMode,
  SpineDocument,
  StudioView,
  ViewArtworkData
} from './types';
import { RigStudioBridge } from './RigStudioBridge';
import {
  ANATOMICAL_JOINTS,
  convertJointsToSpineBones,
  copyJointsFromFront,
  getDefaultJointPositions
} from './rigging/AnatomicalRig';
import { RigStudioCanvas } from './rigging/RigStudioCanvas';

export class RigStudioApp {
  private container: HTMLElement;
  private bridge: RigStudioBridge;

  private characterName = 'Character';
  private activeView: StudioView = 'front';
  private activeRightTab: 'joints' | 'layers' = 'joints';

  private toolMode: JointToolMode = 'select';
  private symmetryEnabled = true;
  private showBonesEnabled = true;

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
      visible: true
    }
  };

  private selectedJointId: AnatomicalJointId | null = null;
  private canvas: RigStudioCanvas | null = null;

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

        <div class="studio-header-actions">
          <button class="btn-studio btn-load-demo" title="Load sample demo character artwork">
            🎨 Demo Artwork
          </button>
          <label class="btn-studio" style="cursor:pointer;" title="Import graphics image from disk">
            📁 Import
            <input type="file" id="input-graphic-upload" accept="image/*" style="display:none;" />
          </label>
          <button class="btn-studio btn-export-spine" title="Export rig as Spine JSON">
            💾 Export Spine
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
        <!-- Left Panel: Import & Joint Tools -->
        <aside class="studio-left-sidebar" id="left-sidebar">
          <!-- Dynamically updated -->
        </aside>

        <!-- Center Workspace Canvas -->
        <section class="studio-workspace" id="center-workspace">
          <div class="workspace-hud">
            <span>View: <b id="hud-active-view" style="color:#38bdf8;">FRONT</b></span>
            <span>Tool: <b id="hud-active-tool">SELECT</b></span>
            <button class="btn-hud-fit" id="btn-fit-view">Fit</button>
            <button class="btn-hud-fit" id="btn-reset-view">Center</button>
          </div>
        </section>

        <!-- Right Panel: Joints & Layers -->
        <aside class="studio-right-sidebar" id="right-sidebar">
          <!-- Dynamically updated -->
        </aside>
      </main>
    `;

    // Initialize Canvas in center workspace
    const workspaceEl = this.container.querySelector('#center-workspace') as HTMLElement;
    this.canvas = new RigStudioCanvas(workspaceEl, {
      onJointSelected: (jointId) => {
        this.selectedJointId = jointId;
        this.renderRightSidebar();
      },
      onJointsModified: (joints) => {
        this.views[this.activeView].joints = { ...joints };
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
    // View Switcher Buttons (Front, Back, Left Side, Right Side)
    this.container.querySelectorAll('.studio-view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const viewId = btn.getAttribute('data-view') as StudioView;
        if (viewId && viewId !== this.activeView) {
          this.switchView(viewId);
        }
      });
    });

    // File Upload via file input
    const fileInput = this.container.querySelector('#input-graphic-upload') as HTMLInputElement;
    fileInput?.addEventListener('change', () => {
      if (fileInput.files && fileInput.files[0]) {
        this.handleFileUpload(fileInput.files[0]);
        fileInput.value = '';
      }
    });

    // Demo Character button
    const demoBtn = this.container.querySelector('.btn-load-demo');
    demoBtn?.addEventListener('click', () => {
      this.loadDemoCharacter();
    });

    // Export Spine JSON
    const exportBtn = this.container.querySelector('.btn-export-spine');
    exportBtn?.addEventListener('click', () => {
      this.exportSpineJson();
    });

    // Save Local or Apply to Host
    const saveBtn = this.container.querySelector('.btn-save-local');
    saveBtn?.addEventListener('click', () => {
      this.exportSpineJson();
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

    // Update Canvas
    if (this.canvas) {
      this.canvas.setView(viewId, viewData.joints);
      this.canvas.setSourceImage(viewData.image, viewData.fileName);
    }

    this.renderLeftSidebar();
    this.renderRightSidebar();
  }

  private renderLeftSidebar(): void {
    const sidebar = this.container.querySelector('#left-sidebar') as HTMLElement;
    if (!sidebar) return;

    const currentArt = this.views[this.activeView];
    const hasImage = !!currentArt.image;

    sidebar.innerHTML = `
      <!-- Import Section (Step 1 & 2) -->
      <div>
        <div class="panel-section-title">Import</div>

        ${!hasImage ? `
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

          <!-- Toggles (Symmetry, Show Bones) -->
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

    // Action buttons
    sidebar.querySelector('#btn-reset-pose')?.addEventListener('click', () => {
      this.canvas?.resetPose();
    });

    sidebar.querySelector('#btn-copy-joints-front')?.addEventListener('click', () => {
      this.copyJointsFromFrontView();
    });
  }

  private renderRightSidebar(): void {
    const sidebar = this.container.querySelector('#right-sidebar') as HTMLElement;
    if (!sidebar) return;

    const currentArt = this.views[this.activeView];

    sidebar.innerHTML = `
      <div class="sidebar-tabs-header">
        <div class="sidebar-tab-toggle">
          <button class="sidebar-tab-btn ${this.activeRightTab === 'joints' ? 'active' : ''}" data-tab="joints">
            Joints
          </button>
          <button class="sidebar-tab-btn ${this.activeRightTab === 'layers' ? 'active' : ''}" data-tab="layers">
            Layers
          </button>
        </div>
      </div>

      <div class="sidebar-content" style="flex:1; overflow-y:auto;">
        ${this.activeRightTab === 'joints' ? `
          <!-- Joints List (Step 3) -->
          <div class="joints-list">
            ${ANATOMICAL_JOINTS.map(joint => {
              const isSelected = this.selectedJointId === joint.id;
              return `
                <div class="joint-item-row ${isSelected ? 'selected' : ''}" data-joint-id="${joint.id}">
                  <span class="joint-color-dot" style="background:${joint.color}; color:${joint.color};"></span>
                  <span>${joint.name}</span>
                </div>
              `;
            }).join('')}
          </div>
        ` : `
          <!-- Layers List (Step 1, 2, 4, 5) -->
          <div class="layers-list">
            ${currentArt.image ? `
              <div class="layer-item-row selected">
                <button class="layer-eye-btn" title="Toggle visibility">👁</button>
                <span class="layer-name" title="${currentArt.fileName}">${currentArt.fileName}</span>
              </div>
            ` : `
              <div class="layers-empty-text">No layers imported yet</div>
            `}
          </div>
        `}
      </div>
    `;

    // Tab toggle events
    sidebar.querySelectorAll('.sidebar-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab') as 'joints' | 'layers';
        if (tab) {
          this.activeRightTab = tab;
          this.renderRightSidebar();
        }
      });
    });

    // Joint item click
    sidebar.querySelectorAll('.joint-item-row').forEach(row => {
      row.addEventListener('click', () => {
        const jId = row.getAttribute('data-joint-id') as AnatomicalJointId;
        if (jId) {
          this.selectedJointId = jId;
          this.canvas?.selectJoint(jId);
          this.renderRightSidebar();
        }
      });
    });
  }

  public setToolMode(mode: JointToolMode): void {
    this.toolMode = mode;
    this.canvas?.setToolMode(mode);

    // Switch right panel tab contextually:
    // When in Add Joint or Move, show Joints; in Preview or Select, can show either
    if (mode === 'add_joint') {
      this.activeRightTab = 'joints';
    } else if (mode === 'preview') {
      this.activeRightTab = 'layers';
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

        // Auto-switch to joints view
        this.activeRightTab = 'joints';
        this.renderLeftSidebar();
        this.renderRightSidebar();
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
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
      }
      this.renderLeftSidebar();
      this.renderRightSidebar();
    };
    img.src = url;
  }

  public loadDemoCharacter(): void {
    // Load Front demo artwork
    this.loadImageFromUrl('/demo/assets/characters/sir_ronald_front.png', 'character_front.png', 'front', true);
    // Preload Back demo artwork
    this.loadImageFromUrl('/demo/assets/characters/sir_ronald_back.png', 'character_back.png', 'back', false);
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

  private updateHeaderTitle(): void {
    const titleEl = this.container.querySelector('.studio-title');
    if (titleEl) {
      titleEl.textContent = 'Character Rig Studio';
    }
  }
}
