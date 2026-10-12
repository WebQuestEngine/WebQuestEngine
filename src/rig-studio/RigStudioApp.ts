import {
  AnatomicalJointDef,
  AnatomicalJointId,
  BonePartAttachment,
  JointToolMode,
  SpineDocument,
  StudioView,
  ViewArtworkData
} from './types';
import { RigStudioBridge } from './RigStudioBridge';
import {
  ANATOMICAL_JOINTS,
  DEFAULT_ENVELOPES,
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
        <!-- Hidden input for attaching individual bone parts -->
        <input type="file" id="input-part-upload" accept="image/*" style="display:none;" />

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

        <!-- Right Panel: Joints, Envelopes & Parts -->
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

    // Bone Part Upload via dedicated part file input
    const partInput = this.container.querySelector('#input-part-upload') as HTMLInputElement;
    partInput?.addEventListener('change', () => {
      if (partInput.files && partInput.files[0] && this.selectedJointId) {
        this.handlePartUpload(partInput.files[0], this.selectedJointId);
        partInput.value = '';
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

    // Update Canvas with view's joints, envelopes, and attached parts
    if (this.canvas) {
      this.canvas.setView(viewId, viewData.joints, viewData.envelopes, viewData.parts);
      this.canvas.setSourceImage(viewData.image, viewData.fileName);
    }

    this.renderLeftSidebar();
    this.renderRightSidebar();
  }

  private renderLeftSidebar(): void {
    const sidebar = this.container.querySelector('#left-sidebar') as HTMLElement;
    if (!sidebar) return;

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
    const selectedJoint = ANATOMICAL_JOINTS.find(j => j.id === this.selectedJointId);
    const attachedPart = this.selectedJointId ? currentArt.parts[this.selectedJointId] : null;
    const currentRadius = this.selectedJointId
      ? (currentArt.envelopes[this.selectedJointId] || this.canvas?.getEnvelopeRadius(this.selectedJointId) || 22)
      : 22;

    sidebar.innerHTML = `
      <div class="sidebar-tabs-header">
        <div class="sidebar-tab-toggle">
          <button class="sidebar-tab-btn ${this.activeRightTab === 'joints' ? 'active' : ''}" data-tab="joints">
            Joints
          </button>
          <button class="sidebar-tab-btn ${this.activeRightTab === 'layers' ? 'active' : ''}" data-tab="layers">
            Layers ${Object.keys(currentArt.parts).length > 0 ? `(${Object.keys(currentArt.parts).length + 1})` : ''}
          </button>
        </div>
      </div>

      <div class="sidebar-content" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:10px;">
        ${this.activeRightTab === 'joints' ? `
          <!-- Joints List (Step 3) -->
          <div class="joints-list">
            ${ANATOMICAL_JOINTS.map(joint => {
              const isSelected = this.selectedJointId === joint.id;
              const hasPart = !!currentArt.parts[joint.id];
              return `
                <div class="joint-item-row ${isSelected ? 'selected' : ''}" data-joint-id="${joint.id}">
                  <span class="joint-color-dot" style="background:${joint.color}; color:${joint.color};"></span>
                  <span style="flex:1;">${joint.name}</span>
                  ${hasPart ? '<span style="font-size:0.65rem; color:#38bdf8; font-weight:700;">PART</span>' : ''}
                </div>
              `;
            }).join('')}
          </div>

          <!-- Selected Bone Settings: Envelope & Part Attachment -->
          ${selectedJoint ? `
            <div class="bone-details-card">
              <div class="bone-details-header">
                <span style="display:flex; align-items:center; gap:6px;">
                  <span class="joint-color-dot" style="background:${selectedJoint.color}; color:${selectedJoint.color};"></span>
                  <span>${selectedJoint.name}</span>
                </span>
                <span style="font-size:0.68rem; color:#94a3b8;">Selected Bone</span>
              </div>

              <!-- Envelope Slider -->
              <div class="envelope-slider-group">
                <div class="envelope-slider-header">
                  <span>Envelope Width</span>
                  <span id="label-envelope-val" style="font-family:var(--studio-font-mono); color:#38bdf8; font-weight:700;">${currentRadius}px</span>
                </div>
                <input
                  type="range"
                  class="envelope-range-input"
                  id="input-envelope-radius"
                  min="8"
                  max="60"
                  step="1"
                  value="${currentRadius}"
                />
              </div>

              <!-- Dedicated Bone Part Attachment -->
              <div class="bone-part-section">
                <div style="font-size:0.72rem; color:var(--studio-text-muted); font-weight:600;">
                  Bone Artwork Part:
                </div>

                ${attachedPart ? `
                  <div class="bone-part-preview-box">
                    <img src="${attachedPart.imageUrl}" class="bone-part-preview-img" alt="${attachedPart.fileName}" />
                  </div>
                  <div style="display:flex; align-items:center; justify-content:space-between; font-size:0.72rem;">
                    <span style="color:#e2e8f0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:130px;" title="${attachedPart.fileName}">
                      ${attachedPart.fileName}
                    </span>
                    <button class="btn-danger-part" id="btn-remove-part" title="Remove part image">✕ Remove</button>
                  </div>
                  <button class="btn-attach-part" id="btn-replace-part" style="margin-top:2px;">
                    📁 Replace Part Image...
                  </button>
                ` : `
                  <div style="font-size:0.7rem; color:#64748b; line-height:1.3;">
                    Using whole-body artwork slice. You can attach an individual image (e.g. only this arm or foot).
                  </div>
                  <button class="btn-attach-part" id="btn-add-part">
                    ➕ Attach Part (${selectedJoint.name})...
                  </button>
                `}
              </div>
            </div>
          ` : ''}
        ` : `
          <!-- Layers List (Step 1, 2, 4, 5 + Individual Parts) -->
          <div class="layers-list">
            ${currentArt.image ? `
              <div class="layer-item-row selected">
                <button class="layer-eye-btn" title="Toggle visibility">👁</button>
                <span class="layer-name" title="${currentArt.fileName}">${currentArt.fileName} (Body)</span>
              </div>
            ` : `
              <div class="layers-empty-text">No body artwork loaded yet</div>
            `}

            <!-- Attached Parts Layers -->
            ${Object.entries(currentArt.parts).map(([bId, p]) => {
              const jDef = ANATOMICAL_JOINTS.find(j => j.id === bId);
              return `
                <div class="layer-item-row" data-part-bone="${bId}" style="border-left:3px solid ${jDef?.color || '#38bdf8'}; cursor:pointer;">
                  <button class="layer-eye-btn" title="Toggle visibility">👁</button>
                  <span class="layer-name" title="${p.fileName}">
                    <b style="color:#38bdf8;">${jDef?.name}:</b> ${p.fileName}
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

    // Envelope Radius Slider Event
    const radiusInput = sidebar.querySelector('#input-envelope-radius') as HTMLInputElement;
    radiusInput?.addEventListener('input', () => {
      const val = parseInt(radiusInput.value, 10);
      const valLabel = sidebar.querySelector('#label-envelope-val');
      if (valLabel) valLabel.textContent = `${val}px`;
      if (this.selectedJointId) {
        currentArt.envelopes[this.selectedJointId] = val;
        this.canvas?.setEnvelopeRadius(this.selectedJointId, val);
      }
    });

    // Attach / Replace Part Button
    const addPartBtn = sidebar.querySelector('#btn-add-part');
    addPartBtn?.addEventListener('click', () => {
      const partInput = this.container.querySelector('#input-part-upload') as HTMLInputElement;
      partInput?.click();
    });

    const replacePartBtn = sidebar.querySelector('#btn-replace-part');
    replacePartBtn?.addEventListener('click', () => {
      const partInput = this.container.querySelector('#input-part-upload') as HTMLInputElement;
      partInput?.click();
    });

    // Remove Part Button
    const removePartBtn = sidebar.querySelector('#btn-remove-part');
    removePartBtn?.addEventListener('click', () => {
      if (this.selectedJointId) {
        this.removePartFromBone(this.selectedJointId);
      }
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

    // Select bone when clicking layer row
    sidebar.querySelectorAll('.layer-item-row[data-part-bone]').forEach(row => {
      row.addEventListener('click', () => {
        const bId = row.getAttribute('data-part-bone') as AnatomicalJointId;
        if (bId) {
          this.selectedJointId = bId;
          this.canvas?.selectJoint(bId);
          this.activeRightTab = 'joints';
          this.renderRightSidebar();
        }
      });
    });
  }

  public setToolMode(mode: JointToolMode): void {
    this.toolMode = mode;
    this.canvas?.setToolMode(mode);

    if (mode === 'add_joint') {
      this.activeRightTab = 'joints';
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

        this.activeRightTab = 'joints';
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
