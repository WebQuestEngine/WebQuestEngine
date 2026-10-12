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
  ANATOMICAL_BONES,
  ANATOMICAL_JOINTS,
  DEFAULT_ENVELOPES,
  convertJointsToSpineBones,
  copyJointsFromFront,
  getDefaultJointPositions
} from './rigging/AnatomicalRig';
import { RigStudioCanvas } from './rigging/RigStudioCanvas';

export interface RigPartItem {
  id: string;
  name: string;
  imageUrl: string;
  image: HTMLImageElement;
  width: number;
  height: number;
  assignedBoneId?: AnatomicalJointId | null;
}

export class RigStudioApp {
  private container: HTMLElement;
  private bridge: RigStudioBridge;

  private characterName = 'Character';
  private activeView: StudioView = 'front';
  private activeRightTab: 'bones' | 'parts' | 'layers' = 'bones';
  private partsLibrary: RigPartItem[] = [];

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
        <!-- Hidden input for batch uploading multiple parts -->
        <input type="file" id="input-batch-part-upload" multiple accept="image/*" style="display:none;" />
        <!-- Hidden input for importing library images -->
        <input type="file" id="input-library-files-upload" multiple accept="image/*" style="display:none;" />
        <!-- Hidden input for multi-part spritesheet auto-slicing -->
        <input type="file" id="input-spritesheet-upload" accept="image/*" style="display:none;" />

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

            <div class="studio-toggle-row">
              <span class="toggle-label">Ghost (Rest)</span>
              <label class="studio-switch">
                <input type="checkbox" id="toggle-show-ghost" ${this.canvas?.getShowGhost() ? 'checked' : ''} />
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

  public attachPartToBone(boneId: AnatomicalJointId, partData: { id?: string; name?: string; imageUrl: string }): void {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const currentArt = this.views[this.activeView];
      const part: BonePartAttachment = {
        boneId,
        image: img,
        imageUrl: partData.imageUrl,
        fileName: partData.name || `${boneId}_part.png`,
        scale: 1.0,
        offsetX: 0,
        offsetY: 0
      };

      currentArt.parts[boneId] = part;
      this.canvas?.setPart(boneId, part);

      if (partData.id) {
        const libItem = this.partsLibrary.find(p => p.id === partData.id);
        if (libItem) libItem.assignedBoneId = boneId;
      }

      this.selectedJointId = boneId;
      this.renderRightSidebar();
    };
    img.src = partData.imageUrl;
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

  public loadRonaldDemoParts(): void {
    const demoUrl = '/demo/assets/characters/sir_ronald_parts.png';
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const ronaldElements: { name: string; boneId?: AnatomicalJointId; bounds: { x: number; y: number; width: number; height: number } }[] = [
        { name: 'Head (f_head)', boneId: 'head', bounds: { x: 16, y: 166, width: 211, height: 216 } },
        { name: 'Torso (f_torso)', boneId: 'neck', bounds: { x: 249, y: 168, width: 252, height: 173 } },
        { name: 'Hip / Pelvis (f_hip)', bounds: { x: 292, y: 336, width: 168, height: 81 } },
        { name: 'Left Upper Arm (f_arm_upper_l)', boneId: 'shoulder_l', bounds: { x: 673, y: 197, width: 97, height: 117 } },
        { name: 'Left Forearm (f_arm_lower_l)', boneId: 'elbow_l', bounds: { x: 706, y: 312, width: 69, height: 66 } },
        { name: 'Left Hand (f_hand_l)', boneId: 'wrist_l', bounds: { x: 673, y: 354, width: 91, height: 75 } },
        { name: 'Right Upper Arm (f_arm_upper_r)', boneId: 'shoulder_r', bounds: { x: 529, y: 197, width: 90, height: 117 } },
        { name: 'Right Forearm (f_arm_lower_r)', boneId: 'elbow_r', bounds: { x: 520, y: 304, width: 69, height: 81 } },
        { name: 'Right Hand (f_hand_r)', boneId: 'wrist_r', bounds: { x: 533, y: 349, width: 88, height: 80 } },
        { name: 'Left Thigh (f_leg_upper_l)', boneId: 'hip_l', bounds: { x: 973, y: 158, width: 95, height: 123 } },
        { name: 'Left Calf (f_leg_lower_l)', boneId: 'knee_l', bounds: { x: 981, y: 278, width: 87, height: 92 } },
        { name: 'Left Boot (f_foot_l)', boneId: 'ankle_l', bounds: { x: 995, y: 370, width: 94, height: 80 } },
        { name: 'Right Thigh (f_leg_upper_r)', boneId: 'hip_r', bounds: { x: 829, y: 160, width: 92, height: 128 } },
        { name: 'Right Calf (f_leg_lower_r)', boneId: 'knee_r', bounds: { x: 828, y: 286, width: 86, height: 99 } },
        { name: 'Right Boot (f_foot_r)', boneId: 'ankle_r', bounds: { x: 813, y: 382, width: 89, height: 70 } },
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
        partImg.src = dataUrl;

        this.partsLibrary.push({
          id: `ronald_${elem.name.replace(/\W+/g, '_')}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: elem.name,
          imageUrl: dataUrl,
          image: partImg,
          width: elem.bounds.width,
          height: elem.bounds.height,
          assignedBoneId: null
        });
      }

      this.activeRightTab = 'parts';
      this.renderRightSidebar();
    };
    img.src = demoUrl;
  }

  private renderRightSidebar(): void {
    const sidebar = this.container.querySelector('#right-sidebar') as HTMLElement;
    if (!sidebar) return;

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
                      <div style="display:flex; align-items:center; gap:8px; background:rgba(0,0,0,0.35); border-radius:4px; padding:4px 6px; border:1px solid rgba(56, 189, 248, 0.2);">
                        <img src="${part.imageUrl}" style="width:32px; height:32px; object-fit:contain; border-radius:3px; background:rgba(255,255,255,0.05);" />
                        <div style="flex:1; min-width:0;">
                          <div style="font-size:0.68rem; color:#e2e8f0; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${part.fileName}">
                            ${part.fileName}
                          </div>
                          <div style="display:flex; align-items:center; gap:4px; margin-top:2px;">
                            <span style="font-size:0.6rem; color:#94a3b8;">Scale:</span>
                            <input type="range" class="part-scale-slider" data-bone-id="${bone.id}" min="0.5" max="2.0" step="0.05" value="${part.scale || 1.0}" style="width:55px; height:4px;" />
                            <span class="part-scale-label" data-bone-id="${bone.id}" style="font-size:0.6rem; color:#38bdf8;">${((part.scale || 1.0) * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                        <button class="btn-danger-part btn-remove-bone-part" data-bone-id="${bone.id}" style="padding:2px 5px; font-size:0.65rem;" title="Remove graphic from this bone">✕</button>
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

            <!-- Toolbar Actions -->
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px;">
              <button class="btn-studio" id="btn-import-lib-images" style="font-size:0.7rem; padding:6px 4px; justify-content:center;" title="Select one or more PNG image files from your computer">
                📁 Import Images...
              </button>
              <button class="btn-studio" id="btn-import-lib-spritesheet" style="font-size:0.7rem; padding:6px 4px; justify-content:center;" title="Select a multi-part character spritesheet to automatically extract all islands into parts">
                ✂️ Spritesheet Slice...
              </button>
            </div>

            <button class="btn-studio btn-studio-primary" id="btn-load-ronald-parts" style="font-size:0.72rem; padding:6px; justify-content:center;" title="Load all pre-cut Ronald parts from demo assets">
              ⚔️ Load Ronald Demo Parts
            </button>

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

    // Scale slider event
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

    // Parts Library Actions
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
            height: item.height
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
    // Pre-populate Ronald demo parts in Parts Library if empty
    if (this.partsLibrary.length === 0) {
      this.loadRonaldDemoParts();
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

  private updateHeaderTitle(): void {
    const titleEl = this.container.querySelector('.studio-title');
    if (titleEl) {
      titleEl.textContent = 'Character Rig Studio';
    }
  }
}
