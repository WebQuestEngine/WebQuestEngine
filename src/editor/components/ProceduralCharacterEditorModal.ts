import * as PIXI from 'pixi.js';
import { CharacterData, ProceduralVisualConfig, ProjectData } from '../../engine/types';
import { ProceduralCharacterVisualizer } from '../../engine/visualization/ProceduralCharacterVisualizer';
import { EventBus } from '../../engine/core/EventBus';

export class ProceduralCharacterEditorModal {
  public static open(opts: {
    character: CharacterData;
    project: ProjectData | null;
    onSave?: (savedConfig: ProceduralVisualConfig) => void;
  }): void {
    const { character: char, project, onSave } = opts;

    // Get initial config or create default
    const currentConfig: ProceduralVisualConfig = (char.visual && char.visual.type === 'procedural')
      ? JSON.parse(JSON.stringify(char.visual))
      : {
          type: 'procedural',
          archetype: 'humanoid',
          palette: {
            skin: '#fed7aa',
            hair: '#78350f',
            torso: '#2563eb',
            legs: '#1e293b',
            feet: '#0f172a',
            accent: '#e11d48',
            eyes: '#0f172a'
          },
          proportions: {
            headScale: 1,
            bodyWidth: 32,
            bodyHeight: 48,
            limbLength: 30,
            limbThickness: 10
          },
          features: {
            hat: false,
            glasses: false,
            beard: false,
            backpack: false
          }
        };

    const overlay = document.createElement('div');
    overlay.className = 'sprite-picker-overlay';

    overlay.innerHTML = `
      <div class="sprite-picker-modal" style="width: 860px; max-height: 92vh;">
        <div class="sprite-picker-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:1.2rem;">🧬</span>
            <span>Procedural Character Studio: ${char.name}</span>
          </div>
          <button class="btn btn-secondary btn-close-modal" style="padding:4px 8px;">✕</button>
        </div>

        <div class="sprite-picker-body" style="grid-template-columns: 1fr 340px; gap: 20px;">
          <!-- Controls Pane -->
          <div style="display:flex; flex-direction:column; gap:14px; max-height:65vh; overflow-y:auto; padding-right:8px;">
            
            <!-- Archetype Selection -->
            <div>
              <label style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Character Archetype</label>
              <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:6px; margin-top:6px;">
                <button type="button" class="btn btn-archetype ${currentConfig.archetype === 'humanoid' ? 'btn-primary' : 'btn-secondary'}" data-archetype="humanoid">👤 Human</button>
                <button type="button" class="btn btn-archetype ${currentConfig.archetype === 'robot' ? 'btn-primary' : 'btn-secondary'}" data-archetype="robot">🤖 Robot</button>
                <button type="button" class="btn btn-archetype ${currentConfig.archetype === 'chibi' ? 'btn-primary' : 'btn-secondary'}" data-archetype="chibi">🧸 Chibi</button>
                <button type="button" class="btn btn-archetype ${currentConfig.archetype === 'creature' ? 'btn-primary' : 'btn-secondary'}" data-archetype="creature">🐾 Beast</button>
              </div>
            </div>

            <!-- Quick Presets -->
            <div>
              <label style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Quick Presets</label>
              <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:6px;">
                <button type="button" class="btn btn-secondary btn-preset" data-preset="wizard" style="font-size:0.75rem; padding:4px 8px;">🧙 Wizard</button>
                <button type="button" class="btn btn-secondary btn-preset" data-preset="knight" style="font-size:0.75rem; padding:4px 8px;">🛡️ Knight</button>
                <button type="button" class="btn btn-secondary btn-preset" data-preset="android" style="font-size:0.75rem; padding:4px 8px;">🤖 Android</button>
                <button type="button" class="btn btn-secondary btn-preset" data-preset="adventurer" style="font-size:0.75rem; padding:4px 8px;">🧑 Adventurer</button>
                <button type="button" class="btn btn-secondary btn-preset" data-preset="rogue" style="font-size:0.75rem; padding:4px 8px;">🗡️ Rogue</button>
              </div>
            </div>

            <!-- Palette Colors -->
            <div style="background:#0f172a; padding:12px; border-radius:8px; border:1px solid var(--panel-border);">
              <label style="font-size:0.75rem; font-weight:700; color:#38bdf8; text-transform:uppercase; margin-bottom:8px; display:block;">🎨 Color Palette</label>
              <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px;">
                <div>
                  <label style="font-size:0.7rem; color:var(--text-muted);">Skin</label>
                  <input type="color" class="form-input col-skin" value="${currentConfig.palette.skin}" style="height:32px; padding:2px; width:100%; cursor:pointer;" />
                </div>
                <div>
                  <label style="font-size:0.7rem; color:var(--text-muted);">Hair</label>
                  <input type="color" class="form-input col-hair" value="${currentConfig.palette.hair}" style="height:32px; padding:2px; width:100%; cursor:pointer;" />
                </div>
                <div>
                  <label style="font-size:0.7rem; color:var(--text-muted);">Torso / Clothes</label>
                  <input type="color" class="form-input col-torso" value="${currentConfig.palette.torso}" style="height:32px; padding:2px; width:100%; cursor:pointer;" />
                </div>
                <div>
                  <label style="font-size:0.7rem; color:var(--text-muted);">Legs / Pants</label>
                  <input type="color" class="form-input col-legs" value="${currentConfig.palette.legs}" style="height:32px; padding:2px; width:100%; cursor:pointer;" />
                </div>
                <div>
                  <label style="font-size:0.7rem; color:var(--text-muted);">Feet / Boots</label>
                  <input type="color" class="form-input col-feet" value="${currentConfig.palette.feet}" style="height:32px; padding:2px; width:100%; cursor:pointer;" />
                </div>
                <div>
                  <label style="font-size:0.7rem; color:var(--text-muted);">Accent / Trim</label>
                  <input type="color" class="form-input col-accent" value="${currentConfig.palette.accent}" style="height:32px; padding:2px; width:100%; cursor:pointer;" />
                </div>
              </div>
            </div>

            <!-- Proportions -->
            <div style="background:#0f172a; padding:12px; border-radius:8px; border:1px solid var(--panel-border);">
              <label style="font-size:0.75rem; font-weight:700; color:#38bdf8; text-transform:uppercase; margin-bottom:8px; display:block;">📐 Body Proportions</label>
              <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                <div>
                  <div style="display:flex; justify-content:space-between; font-size:0.7rem; color:var(--text-muted);">
                    <span>Head Scale</span>
                    <span id="val-head-scale">${currentConfig.proportions.headScale}x</span>
                  </div>
                  <input type="range" min="0.6" max="1.8" step="0.05" class="prop-head-scale" value="${currentConfig.proportions.headScale}" style="width:100%;" />
                </div>
                <div>
                  <div style="display:flex; justify-content:space-between; font-size:0.7rem; color:var(--text-muted);">
                    <span>Body Width</span>
                    <span id="val-body-width">${currentConfig.proportions.bodyWidth}px</span>
                  </div>
                  <input type="range" min="20" max="52" step="2" class="prop-body-width" value="${currentConfig.proportions.bodyWidth}" style="width:100%;" />
                </div>
                <div>
                  <div style="display:flex; justify-content:space-between; font-size:0.7rem; color:var(--text-muted);">
                    <span>Body Height</span>
                    <span id="val-body-height">${currentConfig.proportions.bodyHeight}px</span>
                  </div>
                  <input type="range" min="30" max="68" step="2" class="prop-body-height" value="${currentConfig.proportions.bodyHeight}" style="width:100%;" />
                </div>
                <div>
                  <div style="display:flex; justify-content:space-between; font-size:0.7rem; color:var(--text-muted);">
                    <span>Limb Length</span>
                    <span id="val-limb-length">${currentConfig.proportions.limbLength}px</span>
                  </div>
                  <input type="range" min="16" max="44" step="2" class="prop-limb-length" value="${currentConfig.proportions.limbLength}" style="width:100%;" />
                </div>
              </div>
            </div>

            <!-- Features & Accessories -->
            <div style="background:#0f172a; padding:12px; border-radius:8px; border:1px solid var(--panel-border);">
              <label style="font-size:0.75rem; font-weight:700; color:#38bdf8; text-transform:uppercase; margin-bottom:8px; display:block;">🎒 Accessories & Features</label>
              <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:8px;">
                <label style="display:flex; align-items:center; gap:6px; font-size:0.75rem; cursor:pointer;">
                  <input type="checkbox" class="feat-hat" ${currentConfig.features?.hat ? 'checked' : ''} />
                  <span>🎩 Hat</span>
                </label>
                <label style="display:flex; align-items:center; gap:6px; font-size:0.75rem; cursor:pointer;">
                  <input type="checkbox" class="feat-glasses" ${currentConfig.features?.glasses ? 'checked' : ''} />
                  <span>👓 Glasses</span>
                </label>
                <label style="display:flex; align-items:center; gap:6px; font-size:0.75rem; cursor:pointer;">
                  <input type="checkbox" class="feat-beard" ${currentConfig.features?.beard ? 'checked' : ''} />
                  <span>🧔 Beard</span>
                </label>
                <label style="display:flex; align-items:center; gap:6px; font-size:0.75rem; cursor:pointer;">
                  <input type="checkbox" class="feat-backpack" ${currentConfig.features?.backpack ? 'checked' : ''} />
                  <span>🎒 Backpack</span>
                </label>
              </div>
            </div>

          </div>

          <!-- Preview & Animation Testing Pane -->
          <div style="display:flex; flex-direction:column; gap:12px;">
            <div style="background:#020617; border:1px solid var(--panel-border); border-radius:8px; height:320px; display:flex; align-items:center; justify-content:center; position:relative; overflow:hidden;">
              <div id="procedural-preview-container" style="width:100%; height:100%;"></div>
              <div style="position:absolute; bottom:8px; right:8px; font-size:0.65rem; color:#64748b;">Live Procedural Rig</div>
            </div>

            <!-- Animation Preview Controls -->
            <div style="background:#0f172a; padding:10px; border-radius:8px; border:1px solid var(--panel-border); display:flex; flex-direction:column; gap:8px;">
              <span style="font-size:0.7rem; color:var(--text-muted); font-weight:700;">TEST ANIMATION STATE</span>
              <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:6px;">
                <button type="button" class="btn btn-anim-state btn-primary" data-state="idle">⏸️ Idle</button>
                <button type="button" class="btn btn-anim-state btn-secondary" data-state="walking">🚶 Walk</button>
                <button type="button" class="btn btn-anim-state btn-secondary" data-state="talking">💬 Talk</button>
              </div>
            </div>
          </div>
        </div>

        <div style="padding:14px 18px; background:rgba(30,41,59,0.9); border-top:1px solid var(--panel-border); display:flex; justify-content:flex-end; gap:10px;">
          <button class="btn btn-secondary btn-cancel">Cancel</button>
          <button class="btn btn-primary btn-save" style="background:#2563eb; color:#ffffff; font-weight:700;">Save Procedural Character</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // PIXI Canvas Preview Setup
    const previewContainer = overlay.querySelector('#procedural-preview-container') as HTMLElement;
    let app: PIXI.Application | null = null;
    let visualizer: ProceduralCharacterVisualizer | null = null;
    let animState: 'idle' | 'walking' | 'talking' = 'idle';
    let tickerRef: any = null;

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

      visualizer = new ProceduralCharacterVisualizer(currentConfig);
      await visualizer.init();

      // Position in center bottom
      visualizer.container.x = 160;
      visualizer.container.y = 260;
      visualizer.container.scale.set(1.5);
      app.stage.addChild(visualizer.container);

      tickerRef = (ticker: any) => {
        if (!visualizer) return;
        const delta = ticker.deltaTime / 60;
        visualizer.update(delta, {
          state: animState,
          direction8Way: 'down',
          isFacingLeft: false,
          currentCustomAnimKey: null,
          scale: 1.5,
          depthY: 260
        });
      };
      app.ticker.add(tickerRef);
    };

    initPreview().catch(console.error);

    const refreshVisualizer = () => {
      if (!visualizer || !app) return;
      visualizer.config = currentConfig;
    };

    // UI Event Handlers
    // Archetype Switcher
    overlay.querySelectorAll('.btn-archetype').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('.btn-archetype').forEach(b => {
          b.classList.remove('btn-primary');
          b.classList.add('btn-secondary');
        });
        btn.classList.add('btn-primary');
        btn.classList.remove('btn-secondary');
        currentConfig.archetype = btn.getAttribute('data-archetype') as any;
        refreshVisualizer();
      });
    });

    // Presets
    overlay.querySelectorAll('.btn-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = btn.getAttribute('data-preset');
        if (preset === 'wizard') {
          currentConfig.archetype = 'humanoid';
          currentConfig.palette = { skin: '#fed7aa', hair: '#9333ea', torso: '#581c87', legs: '#3b0764', feet: '#0f172a', accent: '#f59e0b', eyes: '#0f172a' };
          currentConfig.features = { hat: true, glasses: false, beard: true, backpack: false };
        } else if (preset === 'knight') {
          currentConfig.archetype = 'humanoid';
          currentConfig.palette = { skin: '#fed7aa', hair: '#475569', torso: '#64748b', legs: '#334155', feet: '#1e293b', accent: '#38bdf8', eyes: '#0f172a' };
          currentConfig.features = { hat: true, glasses: false, beard: false, backpack: false };
        } else if (preset === 'android') {
          currentConfig.archetype = 'robot';
          currentConfig.palette = { skin: '#94a3b8', hair: '#0284c7', torso: '#0f172a', legs: '#1e293b', feet: '#0f172a', accent: '#06b6d4', eyes: '#06b6d4' };
          currentConfig.features = { hat: false, glasses: false, beard: false, backpack: false };
        } else if (preset === 'adventurer') {
          currentConfig.archetype = 'humanoid';
          currentConfig.palette = { skin: '#fed7aa', hair: '#78350f', torso: '#b45309', legs: '#1e3a8a', feet: '#451a03', accent: '#dc2626', eyes: '#0f172a' };
          currentConfig.features = { hat: false, glasses: false, beard: false, backpack: true };
        } else if (preset === 'rogue') {
          currentConfig.archetype = 'humanoid';
          currentConfig.palette = { skin: '#e2e8f0', hair: '#0f172a', torso: '#1e293b', legs: '#0f172a', feet: '#020617', accent: '#10b981', eyes: '#10b981' };
          currentConfig.features = { hat: true, glasses: false, beard: false, backpack: false };
        }

        // Update UI inputs
        (overlay.querySelector('.col-skin') as HTMLInputElement).value = currentConfig.palette.skin;
        (overlay.querySelector('.col-hair') as HTMLInputElement).value = currentConfig.palette.hair;
        (overlay.querySelector('.col-torso') as HTMLInputElement).value = currentConfig.palette.torso;
        (overlay.querySelector('.col-legs') as HTMLInputElement).value = currentConfig.palette.legs;
        (overlay.querySelector('.col-feet') as HTMLInputElement).value = currentConfig.palette.feet;
        (overlay.querySelector('.col-accent') as HTMLInputElement).value = currentConfig.palette.accent;
        (overlay.querySelector('.feat-hat') as HTMLInputElement).checked = !!currentConfig.features?.hat;
        (overlay.querySelector('.feat-glasses') as HTMLInputElement).checked = !!currentConfig.features?.glasses;
        (overlay.querySelector('.feat-beard') as HTMLInputElement).checked = !!currentConfig.features?.beard;
        (overlay.querySelector('.feat-backpack') as HTMLInputElement).checked = !!currentConfig.features?.backpack;

        refreshVisualizer();
      });
    });

    // Color Pickers
    const bindColor = (selector: string, key: keyof typeof currentConfig.palette) => {
      const el = overlay.querySelector(selector) as HTMLInputElement;
      el?.addEventListener('input', () => {
        currentConfig.palette[key] = el.value;
        refreshVisualizer();
      });
    };
    bindColor('.col-skin', 'skin');
    bindColor('.col-hair', 'hair');
    bindColor('.col-torso', 'torso');
    bindColor('.col-legs', 'legs');
    bindColor('.col-feet', 'feet');
    bindColor('.col-accent', 'accent');

    // Proportion Sliders
    const bindRange = (selector: string, key: keyof typeof currentConfig.proportions, valLabelId: string, unit: string) => {
      const el = overlay.querySelector(selector) as HTMLInputElement;
      const lbl = overlay.querySelector(valLabelId) as HTMLElement;
      el?.addEventListener('input', () => {
        const val = parseFloat(el.value);
        currentConfig.proportions[key] = val;
        if (lbl) lbl.textContent = `${val}${unit}`;
        refreshVisualizer();
      });
    };
    bindRange('.prop-head-scale', 'headScale', '#val-head-scale', 'x');
    bindRange('.prop-body-width', 'bodyWidth', '#val-body-width', 'px');
    bindRange('.prop-body-height', 'bodyHeight', '#val-body-height', 'px');
    bindRange('.prop-limb-length', 'limbLength', '#val-limb-length', 'px');

    // Accessories
    const bindFeat = (selector: string, key: 'hat' | 'glasses' | 'beard' | 'backpack') => {
      const el = overlay.querySelector(selector) as HTMLInputElement;
      el?.addEventListener('change', () => {
        if (!currentConfig.features) currentConfig.features = {};
        currentConfig.features[key] = el.checked;
        refreshVisualizer();
      });
    };
    bindFeat('.feat-hat', 'hat');
    bindFeat('.feat-glasses', 'glasses');
    bindFeat('.feat-beard', 'beard');
    bindFeat('.feat-backpack', 'backpack');

    // Animation state tester
    overlay.querySelectorAll('.btn-anim-state').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('.btn-anim-state').forEach(b => {
          b.classList.remove('btn-primary');
          b.classList.add('btn-secondary');
        });
        btn.classList.add('btn-primary');
        btn.classList.remove('btn-secondary');
        animState = btn.getAttribute('data-state') as any;
      });
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
      char.visual = currentConfig;
      char.spriteSheetUrl = `procedural:${currentConfig.archetype}`;

      if (project?.characters) {
        const found = project.characters.find(c => c.id === char.id);
        if (found) {
          found.visual = currentConfig;
          found.spriteSheetUrl = `procedural:${currentConfig.archetype}`;
        }
      }

      if (onSave) onSave(currentConfig);
      EventBus.getInstance().emit('ENTITY_SELECTED', { type: 'character', id: char.id, character: char });
      closeModal();
    });
  }
}
