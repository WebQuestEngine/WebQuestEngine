import * as PIXI from 'pixi.js';
import { CharacterData, SkeletalVisualConfig, ProjectData } from '../../engine/types';
import { SkeletalImporter } from '../../engine/visualization/SkeletalImporter';
import { SkeletalCharacterVisualizer } from '../../engine/visualization/SkeletalCharacterVisualizer';
import { EventBus } from '../../engine/core/EventBus';

export class SkeletalCharacterModal {
  public static open(opts: {
    character: CharacterData;
    project: ProjectData | null;
    onSave?: (savedConfig: SkeletalVisualConfig) => void;
  }): void {
    const { character: char, project, onSave } = opts;

    // Load initial skeletal config or create default simple humanoid skeleton rig
    let currentConfig: SkeletalVisualConfig = (char.visual && char.visual.type === 'skeletal')
      ? JSON.parse(JSON.stringify(char.visual))
      : {
          type: 'skeletal',
          format: 'native',
          skeleton: {
            bones: [
              { name: 'root', x: 0, y: 0, rotation: 0 },
              { name: 'hip', parent: 'root', x: 0, y: -45, length: 15, rotation: 0 },
              { name: 'spine', parent: 'hip', x: 0, y: -20, length: 25, rotation: 0 },
              { name: 'head', parent: 'spine', x: 0, y: -30, length: 20, rotation: 0 },
              { name: 'left_arm', parent: 'spine', x: -16, y: -25, length: 22, rotation: 25 },
              { name: 'right_arm', parent: 'spine', x: 16, y: -25, length: 22, rotation: -25 },
              { name: 'left_leg', parent: 'hip', x: -10, y: 0, length: 35, rotation: 10 },
              { name: 'right_leg', parent: 'hip', x: 10, y: 0, length: 35, rotation: -10 }
            ],
            slots: [
              { name: 'head_slot', bone: 'head', color: '#f59e0b' },
              { name: 'body_slot', bone: 'spine', color: '#3b82f6' },
              { name: 'arm_l_slot', bone: 'left_arm', color: '#60a5fa' },
              { name: 'arm_r_slot', bone: 'right_arm', color: '#60a5fa' },
              { name: 'leg_l_slot', bone: 'left_leg', color: '#1e3a8a' },
              { name: 'leg_r_slot', bone: 'right_leg', color: '#1e3a8a' }
            ],
            attachments: {
              default: {
                head_slot: { name: 'head', x: 0, y: 0, width: 32, height: 32 },
                body_slot: { name: 'body', x: 0, y: 0, width: 36, height: 48 }
              }
            }
          },
          animations: {
            idle: {
              duration: 1.6,
              bones: {
                spine: { rotate: [{ time: 0, rotation: 0 }, { time: 0.8, rotation: 3 }, { time: 1.6, rotation: 0 }] },
                head: { rotate: [{ time: 0, rotation: 0 }, { time: 0.8, rotation: -2 }, { time: 1.6, rotation: 0 }] },
                left_arm: { rotate: [{ time: 0, rotation: 25 }, { time: 0.8, rotation: 20 }, { time: 1.6, rotation: 25 }] },
                right_arm: { rotate: [{ time: 0, rotation: -25 }, { time: 0.8, rotation: -20 }, { time: 1.6, rotation: -25 }] }
              }
            },
            walk: {
              duration: 0.8,
              bones: {
                left_leg: { rotate: [{ time: 0, rotation: -25 }, { time: 0.4, rotation: 25 }, { time: 0.8, rotation: -25 }] },
                right_leg: { rotate: [{ time: 0, rotation: 25 }, { time: 0.4, rotation: -25 }, { time: 0.8, rotation: 25 }] },
                left_arm: { rotate: [{ time: 0, rotation: 35 }, { time: 0.4, rotation: -20 }, { time: 0.8, rotation: 35 }] },
                right_arm: { rotate: [{ time: 0, rotation: -20 }, { time: 0.4, rotation: 35 }, { time: 0.8, rotation: -20 }] }
              }
            }
          },
          defaultAnimation: 'idle'
        };

    const overlay = document.createElement('div');
    overlay.className = 'sprite-picker-overlay';

    overlay.innerHTML = `
      <div class="sprite-picker-modal" style="width: 880px; max-height: 92vh;">
        <div class="sprite-picker-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:1.2rem;">🦴</span>
            <span>Skeletal Animation Studio: ${char.name}</span>
          </div>
          <button class="btn btn-secondary btn-close-modal" style="padding:4px 8px;">✕</button>
        </div>

        <div style="padding:12px 16px; background:#0f172a; border-bottom:1px solid var(--panel-border); display:flex; align-items:center; justify-content:space-between; gap:12px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <label class="btn btn-primary" style="cursor:pointer; font-size:0.8rem; padding:6px 12px; display:inline-flex; align-items:center; gap:6px;">
              📁 Import Spine (.json) / DragonBones
              <input type="file" class="file-skeleton-import" accept=".json" style="display:none;" />
            </label>
            <label class="btn btn-secondary" style="cursor:pointer; font-size:0.8rem; padding:6px 12px; display:inline-flex; align-items:center; gap:6px;">
              🖼️ Texture Image
              <input type="file" class="file-texture-import" accept="image/*" style="display:none;" />
            </label>
          </div>
          <div class="badge-format" style="font-size:0.75rem; padding:4px 8px; border-radius:4px; background:#1e293b; color:#38bdf8; font-weight:700;">
            Format: ${currentConfig.format ? currentConfig.format.toUpperCase() : 'NATIVE'}
          </div>
        </div>

        <div class="sprite-picker-body" style="grid-template-columns: 1fr 340px; gap: 20px;">
          <!-- Left Info Pane -->
          <div style="display:flex; flex-direction:column; gap:12px; max-height:65vh; overflow-y:auto; padding-right:8px;">
            
            <!-- Hierarchy Section -->
            <div style="background:#0f172a; padding:12px; border-radius:8px; border:1px solid var(--panel-border);">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <label style="font-size:0.75rem; font-weight:700; color:#38bdf8; text-transform:uppercase;">🦴 Bone Hierarchy (<span class="bone-count">${currentConfig.skeleton.bones.length}</span>)</label>
              </div>
              <div class="bone-hierarchy-list" style="max-height:160px; overflow-y:auto; font-family:monospace; font-size:0.75rem; color:#cbd5e1; display:flex; flex-direction:column; gap:3px;">
                <!-- Populated dynamically -->
              </div>
            </div>

            <!-- Animations Section -->
            <div style="background:#0f172a; padding:12px; border-radius:8px; border:1px solid var(--panel-border);">
              <label style="font-size:0.75rem; font-weight:700; color:#38bdf8; text-transform:uppercase; margin-bottom:8px; display:block;">🎬 Animation Clips</label>
              <div class="animation-clip-list" style="display:flex; flex-direction:column; gap:6px; max-height:140px; overflow-y:auto;">
                <!-- Populated dynamically -->
              </div>
            </div>

            <!-- Clip Mapping -->
            <div style="background:#0f172a; padding:12px; border-radius:8px; border:1px solid var(--panel-border);">
              <label style="font-size:0.75rem; font-weight:700; color:#38bdf8; text-transform:uppercase; margin-bottom:8px; display:block;">🎯 Engine State Mapping</label>
              <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
                <div>
                  <label style="font-size:0.7rem; color:var(--text-muted);">Idle Clip</label>
                  <select class="form-input select-anim-idle" style="width:100%; font-size:0.75rem;"></select>
                </div>
                <div>
                  <label style="font-size:0.7rem; color:var(--text-muted);">Walk Clip</label>
                  <select class="form-input select-anim-walk" style="width:100%; font-size:0.75rem;"></select>
                </div>
              </div>
            </div>

          </div>

          <!-- Preview & Animation Testing Pane -->
          <div style="display:flex; flex-direction:column; gap:12px;">
            <div style="background:#020617; border:1px solid var(--panel-border); border-radius:8px; height:320px; display:flex; align-items:center; justify-content:center; position:relative; overflow:hidden;">
              <div id="skeletal-preview-container" style="width:100%; height:100%;"></div>
              <div style="position:absolute; bottom:8px; right:8px; font-size:0.65rem; color:#64748b;">FK Skeletal Rig</div>
            </div>

            <!-- Playback Controls -->
            <div style="background:#0f172a; padding:10px; border-radius:8px; border:1px solid var(--panel-border); display:flex; flex-direction:column; gap:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:0.7rem; color:var(--text-muted); font-weight:700;">PLAYBACK SPEED</span>
                <span id="speed-label" style="font-size:0.7rem; color:#38bdf8;">1.0x</span>
              </div>
              <input type="range" min="0.2" max="2.5" step="0.1" value="1.0" class="input-speed" style="width:100%;" />
            </div>
          </div>
        </div>

        <div style="padding:14px 18px; background:rgba(30,41,59,0.9); border-top:1px solid var(--panel-border); display:flex; justify-content:flex-end; gap:10px;">
          <button class="btn btn-secondary btn-cancel">Cancel</button>
          <button class="btn btn-primary btn-save" style="background:#0284c7; color:#ffffff; font-weight:700;">Apply Skeletal Rig</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // PIXI Canvas Preview Setup
    const previewContainer = overlay.querySelector('#skeletal-preview-container') as HTMLElement;
    let app: PIXI.Application | null = null;
    let visualizer: SkeletalCharacterVisualizer | null = null;
    let playbackSpeed = 1.0;
    let tickerRef: any = null;

    const renderBoneList = () => {
      const listEl = overlay.querySelector('.bone-hierarchy-list') as HTMLElement;
      if (!listEl) return;
      const bones = currentConfig.skeleton.bones;
      listEl.innerHTML = bones.map(b => `
        <div style="padding:2px 4px; background:#1e293b; border-radius:4px;">
          ${b.parent ? '↳ ' : '● '}<strong>${b.name}</strong> ${b.parent ? `<span style="color:#64748b;">(parent: ${b.parent})</span>` : '<span style="color:#38bdf8;">[root]</span>'}
        </div>
      `).join('');
      (overlay.querySelector('.bone-count') as HTMLElement).textContent = `${bones.length}`;
    };

    const renderAnimationList = () => {
      const clipList = overlay.querySelector('.animation-clip-list') as HTMLElement;
      const selectIdle = overlay.querySelector('.select-anim-idle') as HTMLSelectElement;
      const selectWalk = overlay.querySelector('.select-anim-walk') as HTMLSelectElement;
      if (!clipList) return;

      const animKeys = Object.keys(currentConfig.animations || {});
      clipList.innerHTML = animKeys.map(k => `
        <button type="button" class="btn btn-secondary btn-play-anim" data-anim="${k}" style="font-size:0.75rem; text-align:left; padding:5px 8px; display:flex; justify-content:space-between;">
          <span>🎬 ${k}</span>
          <span style="color:var(--text-muted);">${(currentConfig.animations[k]?.duration || 1).toFixed(2)}s</span>
        </button>
      `).join('');

      selectIdle.innerHTML = animKeys.map(k => `<option value="${k}" ${k === 'idle' ? 'selected' : ''}>${k}</option>`).join('');
      selectWalk.innerHTML = animKeys.map(k => `<option value="${k}" ${k === 'walk' ? 'selected' : ''}>${k}</option>`).join('');

      clipList.querySelectorAll('.btn-play-anim').forEach(btn => {
        btn.addEventListener('click', () => {
          const anim = btn.getAttribute('data-anim') || 'idle';
          visualizer?.setAnimation(anim);
        });
      });
    };

    const initPreview = async () => {
      app = new PIXI.Application();
      await app.init({
        width: 320,
        height: 320,
        backgroundAlpha: 0,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true
      });
      previewContainer.appendChild(app.canvas);

      visualizer = new SkeletalCharacterVisualizer(currentConfig);
      await visualizer.init();

      visualizer.container.x = 160;
      visualizer.container.y = 260;
      visualizer.container.scale.set(1.5);
      app.stage.addChild(visualizer.container);

      tickerRef = (ticker: any) => {
        if (!visualizer) return;
        const delta = (ticker.deltaTime / 60) * playbackSpeed;
        visualizer.update(delta, {
          state: 'idle',
          direction8Way: 'down',
          isFacingLeft: false,
          currentCustomAnimKey: null,
          scale: 1.5,
          depthY: 260
        });
      };
      app.ticker.add(tickerRef);

      renderBoneList();
      renderAnimationList();
    };

    initPreview().catch(console.error);

    const reinitVisualizer = async () => {
      if (!app) return;
      if (visualizer) {
        app.stage.removeChild(visualizer.container);
        visualizer.destroy();
      }
      visualizer = new SkeletalCharacterVisualizer(currentConfig);
      await visualizer.init();
      visualizer.container.x = 160;
      visualizer.container.y = 260;
      visualizer.container.scale.set(1.5);
      app.stage.addChild(visualizer.container);

      renderBoneList();
      renderAnimationList();
      const formatBadge = overlay.querySelector('.badge-format') as HTMLElement;
      if (formatBadge) formatBadge.textContent = `Format: ${currentConfig.format.toUpperCase()}`;
    };

    // File Import Handlers
    const fileSkeletonInput = overlay.querySelector('.file-skeleton-import') as HTMLInputElement;
    fileSkeletonInput.addEventListener('change', async () => {
      const file = fileSkeletonInput.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const imported = SkeletalImporter.importFromContent(text);
        currentConfig = imported;
        await reinitVisualizer();
      } catch (err: any) {
        alert('Failed to parse skeletal file: ' + err.message);
      }
    });

    const fileTextureInput = overlay.querySelector('.file-texture-import') as HTMLInputElement;
    fileTextureInput.addEventListener('change', async () => {
      const file = fileTextureInput.files?.[0];
      if (!file) return;

      const url = URL.createObjectURL(file);
      currentConfig.textureUrl = url;
      await reinitVisualizer();
    });

    // Speed Slider
    const speedSlider = overlay.querySelector('.input-speed') as HTMLInputElement;
    const speedLabel = overlay.querySelector('#speed-label') as HTMLElement;
    speedSlider.addEventListener('input', () => {
      playbackSpeed = parseFloat(speedSlider.value);
      speedLabel.textContent = `${playbackSpeed.toFixed(1)}x`;
    });

    const closeModal = () => {
      if (app) {
        if (tickerRef) app.ticker.remove(tickerRef);
        app.destroy(true, { children: true });
      }
      overlay.remove();
    };

    overlay.querySelector('.btn-close-modal')?.addEventListener('click', closeModal);
    overlay.querySelector('.btn-cancel')?.addEventListener('click', closeModal);

    // Save
    overlay.querySelector('.btn-save')?.addEventListener('click', () => {
      const selectIdle = overlay.querySelector('.select-anim-idle') as HTMLSelectElement;
      if (selectIdle) currentConfig.defaultAnimation = selectIdle.value;

      char.visual = currentConfig;
      if (project?.characters) {
        const found = project.characters.find(c => c.id === char.id);
        if (found) {
          found.visual = currentConfig;
        }
      }

      if (onSave) onSave(currentConfig);
      EventBus.getInstance().emit('ENTITY_SELECTED', { type: 'character', id: char.id, character: char });
      closeModal();
    });
  }
}
