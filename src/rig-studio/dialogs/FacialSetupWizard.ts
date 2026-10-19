import { EyeRigConfig, EyeRigMode, MouthRigConfig, MouthRigMode, VisemePreset } from '../types';

export const EYE_MODE_DESCRIPTIONS: Record<EyeRigMode, { title: string; subtitle: string; icon: string; features: string[] }> = {
  sprite_swap: {
    title: 'Frame-by-Frame Sprite Swap',
    subtitle: 'Classic Hand-Drawn / Pixel Style',
    icon: '🖼️',
    features: [
      '3 sliced states (Open, Half-lid, Shut)',
      'Exact pixel-perfect fidelity',
      'Perfect for anime and pixel art'
    ]
  },
  sclera_window: {
    title: 'Sclera Window Clipping Mask',
    subtitle: 'Automated Continuous Sliding Eyelid',
    icon: '🪟',
    features: [
      '1 Eyeball + 1 Eyelid Flap',
      '100% smooth 60 FPS morphing',
      'Clips cleanly inside eye socket'
    ]
  },
  procedural: {
    title: 'Procedural Vector Eyes',
    subtitle: 'Built-in Fallback Sclera & Pupils',
    icon: '✏️',
    features: [
      'Zero sliced graphics required',
      'Instant setup & rapid prototyping',
      'Anti-aliased vector rendering'
    ]
  }
};

export const MOUTH_MODE_DESCRIPTIONS: Record<MouthRigMode, { title: string; subtitle: string; icon: string; features: string[] }> = {
  viseme_library: {
    title: 'Sliced Viseme Library',
    subtitle: 'Classic Adventure Game Standard',
    icon: '🗂️',
    features: [
      'Uses 3–8 sliced mouth sprites',
      'Frame swaps + dynamic stretch/squash',
      'Ideal for pixel & retro adventure games'
    ]
  },
  cavity_sandwich: {
    title: 'Masked Cavity Sandwich Rig',
    subtitle: 'Modern 2D Cutout Rig (Spine style)',
    icon: '🥪',
    features: [
      'Upper lip, lower lip & cavity',
      'Continuous jaw drop opening',
      'Masked teeth and tongue reveal'
    ]
  },
  mesh_warp: {
    title: 'Single-Sprite Mesh Warp',
    subtitle: 'Fast 1-Sprite Deformation',
    icon: '🕸️',
    features: [
      'Uses only 1 custom mouth sprite',
      '4-point quad corner/jaw warp',
      'Smooth smile / open morphing'
    ]
  },
  procedural: {
    title: 'Procedural Vector Lips',
    subtitle: 'Built-in Anti-Aliased Bezier Curves',
    icon: '✏️',
    features: [
      'Zero sliced sprites required',
      '100% vector morphing & teeth',
      'Instant setup, perfect fallback'
    ]
  }
};

/**
 * Universal Mode-Change Warning Modal
 */
export interface ModeChangeWarningOptions {
  feature?: string;
  featureName?: string;
  currentModeTitle?: string;
  currentModeName?: string;
  newModeTitle?: string;
  targetModeName?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

export function showModeChangeWarningModal(
  optionsOrFeature: string | ModeChangeWarningOptions,
  currentModeTitleParam?: string,
  newModeTitleParam?: string,
  onConfirmParam?: () => void,
  onCancelParam?: () => void
): void {
  let featureName = 'Feature';
  let currentModeTitle = '';
  let newModeTitle = '';
  let onConfirm: () => void = () => {};
  let onCancel: (() => void) | undefined = undefined;

  if (typeof optionsOrFeature === 'object' && optionsOrFeature !== null) {
    featureName = optionsOrFeature.feature || optionsOrFeature.featureName || 'Feature';
    currentModeTitle = optionsOrFeature.currentModeTitle || optionsOrFeature.currentModeName || '';
    newModeTitle = optionsOrFeature.newModeTitle || optionsOrFeature.targetModeName || '';
    onConfirm = optionsOrFeature.onConfirm || (() => {});
    onCancel = optionsOrFeature.onCancel;
  } else {
    featureName = optionsOrFeature || 'Feature';
    currentModeTitle = currentModeTitleParam || '';
    newModeTitle = newModeTitleParam || '';
    onConfirm = onConfirmParam || (() => {});
    onCancel = onCancelParam;
  }

  const existing = document.querySelector('.studio-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'studio-modal-overlay';
  overlay.innerHTML = `
    <div class="studio-modal" style="max-width: 460px;">
      <div class="studio-modal-header" style="background:#1e1b4b; border-bottom:1px solid #4338ca;">
        <span class="studio-modal-title" style="color:#fbbf24; display:flex; align-items:center; gap:6px;">
          <span>⚠️</span> Warning: Switch ${featureName} Architecture?
        </span>
        <button class="btn-studio btn-wizard-close" style="border:none; background:transparent; font-size:1rem; cursor:pointer; color:#94a3b8;">✕</button>
      </div>
      <div class="studio-modal-body">
        <div class="wizard-warning-box">
          <div style="font-weight:700; color:#fef08a;">You are about to change the ${featureName.toLowerCase()} rigging mode:</div>
          <div style="font-size:0.72rem; color:#cbd5e1; margin: 4px 0;">
            • Current Mode: <strong>${currentModeTitle}</strong><br/>
            • New Mode: <strong>${newModeTitle}</strong>
          </div>
          <div style="font-size:0.7rem; color:#fca5a5; line-height:1.4;">
            ⚠️ Reset graphic slot assignments and associated timeline keyframe channels for this character.
          </div>
        </div>
        <p style="font-size:0.72rem; color:#94a3b8; margin:0;">
          This action cannot be undone. Are you sure you wish to proceed with changing the mode?
        </p>
      </div>
      <div class="studio-modal-footer">
        <button class="btn-studio btn-wizard-cancel">Cancel</button>
        <button class="btn-studio btn-studio-primary btn-confirm-switch-mode btn-warning-confirm" style="background:#dc2626; border-color:#ef4444; color:#fff; font-weight:700;">
          Confirm & Switch Mode
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => {
    overlay.remove();
    onCancel?.();
  };

  overlay.querySelector('.btn-wizard-close')?.addEventListener('click', close);
  overlay.querySelector('.btn-wizard-cancel')?.addEventListener('click', close);
  overlay.querySelector('.btn-confirm-switch-mode')?.addEventListener('click', () => {
    overlay.remove();
    onConfirm();
  });
}

export interface EyeSetupWizardOptions {
  currentConfig?: EyeRigConfig;
  availableSlots?: string[];
  slicedParts?: { id: string; name?: string }[];
  onSave?: (config: EyeRigConfig) => void;
  onConfirm?: (config: EyeRigConfig) => void;
  onCancel?: () => void;
}

/**
 * Eye Setup Wizard Dialog
 */
export function openEyeSetupWizard(
  optionsOrConfig: EyeRigConfig | EyeSetupWizardOptions | undefined,
  availableSlotsParam?: string[],
  onConfirmParam?: (config: EyeRigConfig) => void,
  onCancelParam?: () => void
): void {
  let currentConfig: EyeRigConfig | undefined;
  let availableSlots: string[] = [];
  let onConfirm: (config: EyeRigConfig) => void = () => {};
  let onCancel: (() => void) | undefined = undefined;

  if (optionsOrConfig && typeof optionsOrConfig === 'object' && ('onSave' in optionsOrConfig || 'onConfirm' in optionsOrConfig || 'slicedParts' in optionsOrConfig)) {
    const opts = optionsOrConfig as EyeSetupWizardOptions;
    currentConfig = opts.currentConfig;
    availableSlots = opts.availableSlots || (opts.slicedParts ? opts.slicedParts.map(p => p.id) : []);
    onConfirm = opts.onSave || opts.onConfirm || (() => {});
    onCancel = opts.onCancel;
  } else {
    currentConfig = optionsOrConfig as EyeRigConfig | undefined;
    availableSlots = availableSlotsParam || [];
    onConfirm = onConfirmParam || (() => {});
    onCancel = onCancelParam;
  }

  let selectedMode: EyeRigMode = currentConfig?.mode || 'sclera_window';
  let step: 1 | 2 = 1;

  let eyeOpenSlot = currentConfig?.leftEyePartId || '';
  let eyeHalfSlot = currentConfig?.rightEyePartId || '';
  let eyeClosedSlot = '';
  let eyeballSlot = currentConfig?.scleraPartId || '';
  let eyelidUpperSlot = currentConfig?.eyelidUpperPartId || '';
  let eyelidLowerSlot = currentConfig?.eyelidLowerPartId || '';
  let browLSlot = '';
  let browRSlot = '';


  const renderModal = () => {
    const existing = document.querySelector('.studio-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'studio-modal-overlay';

    let bodyHtml = '';

    if (step === 1) {
      bodyHtml = `
        <div style="font-size:0.75rem; color:#94a3b8; margin-bottom:4px;">
          <strong>Step 1 of 2</strong>: Choose Eye Animation Mode
        </div>
        <div class="wizard-mode-grid">
          ${(Object.keys(EYE_MODE_DESCRIPTIONS) as EyeRigMode[]).map(m => {
            const def = EYE_MODE_DESCRIPTIONS[m];
            const isSel = selectedMode === m;
            return `
              <div class="wizard-mode-card ${isSel ? 'selected' : ''}" data-mode="${m}">
                <div class="wizard-mode-card-header">
                  <span>${def.icon}</span>
                  <span>${def.title}</span>
                </div>
                <div class="wizard-mode-card-subtitle">${def.subtitle}</div>
                <ul class="wizard-mode-card-features">
                  ${def.features.map(f => `<li>${f}</li>`).join('')}
                </ul>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else {
      // Step 2: Slot Assignment
      const slotOptions = (selected: string) => `
        <option value="">-- None / Default --</option>
        ${availableSlots.map(s => `<option value="${s}" ${s === selected ? 'selected' : ''}>${s}</option>`).join('')}
      `;

      bodyHtml = `
        <div style="font-size:0.75rem; color:#94a3b8; margin-bottom:4px;">
          <strong>Step 2 of 2</strong>: Graphic Slot Assignments [${EYE_MODE_DESCRIPTIONS[selectedMode].title}]
        </div>
        <div style="display:flex; flex-direction:column; gap:10px; font-size:0.75rem;">
      `;

      if (selectedMode === 'sprite_swap') {
        bodyHtml += `
          <div style="display:grid; grid-template-columns:140px 1fr; align-items:center; gap:8px;">
            <label>👁️ Eye Open Slot:</label>
            <select class="studio-select sel-eye-open" style="font-size:0.75rem;">${slotOptions(eyeOpenSlot)}</select>
          </div>
          <div style="display:grid; grid-template-columns:140px 1fr; align-items:center; gap:8px;">
            <label>😑 Eye Half Slot:</label>
            <select class="studio-select sel-eye-half" style="font-size:0.75rem;">${slotOptions(eyeHalfSlot)}</select>
          </div>
          <div style="display:grid; grid-template-columns:140px 1fr; align-items:center; gap:8px;">
            <label>😌 Eye Closed Slot:</label>
            <select class="studio-select sel-eye-closed" style="font-size:0.75rem;">${slotOptions(eyeClosedSlot)}</select>
          </div>
        `;
      } else if (selectedMode === 'sclera_window') {
        bodyHtml += `
          <div style="display:grid; grid-template-columns:140px 1fr; align-items:center; gap:8px;">
            <label>👁️ Eyeball Slot:</label>
            <select class="studio-select sel-eyeball" style="font-size:0.75rem;">${slotOptions(eyeballSlot)}</select>
          </div>
          <div style="display:grid; grid-template-columns:140px 1fr; align-items:center; gap:8px;">
            <label>🔽 Upper Eyelid Slot:</label>
            <select class="studio-select sel-eyelid-upper" style="font-size:0.75rem;">${slotOptions(eyelidUpperSlot)}</select>
          </div>
          <div style="display:grid; grid-template-columns:140px 1fr; align-items:center; gap:8px;">
            <label>🔼 Lower Eyelid Slot:</label>
            <select class="studio-select sel-eyelid-lower" style="font-size:0.75rem;">${slotOptions(eyelidLowerSlot)}</select>
          </div>
        `;
      } else {
        bodyHtml += `
          <div style="padding:10px; background:rgba(30,41,59,0.5); border-radius:6px; color:#cbd5e1;">
            ✏️ Procedural vector eyes use anti-aliased mathematical curves and do not require texture slots.
          </div>
        `;
      }

      bodyHtml += `
          <hr style="border:0; border-top:1px solid rgba(148,163,184,0.15); margin:6px 0;" />
          <div style="display:grid; grid-template-columns:140px 1fr; align-items:center; gap:8px;">
            <label>🤨 Left Eyebrow Slot:</label>
            <select class="studio-select sel-brow-l" style="font-size:0.75rem;">${slotOptions(browLSlot)}</select>
          </div>
          <div style="display:grid; grid-template-columns:140px 1fr; align-items:center; gap:8px;">
            <label>🤨 Right Eyebrow Slot:</label>
            <select class="studio-select sel-brow-r" style="font-size:0.75rem;">${slotOptions(browRSlot)}</select>
          </div>
        </div>
      `;
    }

    overlay.innerHTML = `
      <div class="studio-modal wizard-modal">
        <div class="studio-modal-header">
          <span class="studio-modal-title" style="display:flex; align-items:center; gap:6px;">
            <span>👀</span> Eye Rig Setup Wizard
          </span>
          <button class="btn-studio btn-wizard-close" style="border:none; background:transparent; font-size:1rem; cursor:pointer; color:#94a3b8;">✕</button>
        </div>
        <div class="studio-modal-body">
          ${bodyHtml}
        </div>
        <div class="studio-modal-footer" style="justify-content:space-between;">
          <button class="btn-studio btn-wizard-skip" style="color:#38bdf8; font-size:0.72rem; border-color:rgba(56,189,248,0.3);" title="Skip wizard and configure slots manually in Rig Inspector">
            Skip Wizard (Manual Setup)
          </button>
          <div style="display:flex; gap:8px;">
            <button class="btn-studio btn-wizard-cancel">Cancel</button>
            ${step === 1 ? `
              <button class="btn-studio btn-studio-primary btn-wizard-next">Next: Slots ➜</button>
            ` : `
              <button class="btn-studio btn-wizard-back">⬅ Back</button>
              <button class="btn-studio btn-studio-primary btn-wizard-finish" style="background:#10b981; border-color:#34d399; font-weight:700;">
                Finish & Apply Rig
              </button>
            `}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Event bindings
    overlay.querySelector('.btn-wizard-close')?.addEventListener('click', () => {
      overlay.remove();
      onCancel?.();
    });

    overlay.querySelector('.btn-wizard-cancel')?.addEventListener('click', () => {
      overlay.remove();
      onCancel?.();
    });

    overlay.querySelectorAll('.wizard-mode-card').forEach(card => {
      card.addEventListener('click', () => {
        const m = card.getAttribute('data-mode') as EyeRigMode;
        if (m) {
          selectedMode = m;
          renderModal();
        }
      });
    });

    const finishConfig = (mode: EyeRigMode) => {
      const config: EyeRigConfig = {
        mode,
        eyeOpenSlot: mode === 'sprite_swap' ? eyeOpenSlot : undefined,
        eyeHalfSlot: mode === 'sprite_swap' ? eyeHalfSlot : undefined,
        eyeClosedSlot: mode === 'sprite_swap' ? eyeClosedSlot : undefined,
        eyeballSlot: mode === 'sclera_window' ? eyeballSlot : undefined,
        eyelidUpperSlot: mode === 'sclera_window' ? eyelidUpperSlot : undefined,
        eyelidLowerSlot: mode === 'sclera_window' ? eyelidLowerSlot : undefined,
        browLSlot: browLSlot || undefined,
        browRSlot: browRSlot || undefined
      };

      if (currentConfig && currentConfig.mode && currentConfig.mode !== mode) {
        showModeChangeWarningModal(
          'Eye',
          EYE_MODE_DESCRIPTIONS[currentConfig.mode].title,
          EYE_MODE_DESCRIPTIONS[mode].title,
          () => {
            overlay.remove();
            onConfirm(config);
          }
        );
      } else {
        overlay.remove();
        onConfirm(config);
      }
    };

    overlay.querySelector('.btn-wizard-skip')?.addEventListener('click', () => {
      finishConfig(selectedMode);
    });

    overlay.querySelector('.btn-wizard-next')?.addEventListener('click', () => {
      step = 2;
      renderModal();
    });

    overlay.querySelector('.btn-wizard-back')?.addEventListener('click', () => {
      step = 1;
      renderModal();
    });

    overlay.querySelector('.btn-wizard-finish')?.addEventListener('click', () => {
      // Read selected slot inputs
      const selOpen = overlay.querySelector('.sel-eye-open') as HTMLSelectElement | null;
      if (selOpen) eyeOpenSlot = selOpen.value;
      const selHalf = overlay.querySelector('.sel-eye-half') as HTMLSelectElement | null;
      if (selHalf) eyeHalfSlot = selHalf.value;
      const selClosed = overlay.querySelector('.sel-eye-closed') as HTMLSelectElement | null;
      if (selClosed) eyeClosedSlot = selClosed.value;
      const selBall = overlay.querySelector('.sel-eyeball') as HTMLSelectElement | null;
      if (selBall) eyeballSlot = selBall.value;
      const selUp = overlay.querySelector('.sel-eyelid-upper') as HTMLSelectElement | null;
      if (selUp) eyelidUpperSlot = selUp.value;
      const selLow = overlay.querySelector('.sel-eyelid-lower') as HTMLSelectElement | null;
      if (selLow) eyelidLowerSlot = selLow.value;
      const selBL = overlay.querySelector('.sel-brow-l') as HTMLSelectElement | null;
      if (selBL) browLSlot = selBL.value;
      const selBR = overlay.querySelector('.sel-brow-r') as HTMLSelectElement | null;
      if (selBR) browRSlot = selBR.value;

      finishConfig(selectedMode);
    });
  };

  renderModal();
}

export interface MouthSetupWizardOptions {
  currentConfig?: MouthRigConfig;
  availableSlots?: string[];
  slicedParts?: { id: string; name?: string }[];
  onSave?: (config: MouthRigConfig) => void;
  onConfirm?: (config: MouthRigConfig) => void;
  onCancel?: () => void;
}

/**
 * Mouth Setup Wizard Dialog
 */
export function openMouthSetupWizard(
  optionsOrConfig: MouthRigConfig | MouthSetupWizardOptions | undefined,
  availableSlotsParam?: string[],
  onConfirmParam?: (config: MouthRigConfig) => void,
  onCancelParam?: () => void
): void {
  let currentConfig: MouthRigConfig | undefined;
  let availableSlots: string[] = [];
  let onConfirm: (config: MouthRigConfig) => void = () => {};
  let onCancel: (() => void) | undefined = undefined;

  if (optionsOrConfig && typeof optionsOrConfig === 'object' && ('onSave' in optionsOrConfig || 'onConfirm' in optionsOrConfig || 'slicedParts' in optionsOrConfig)) {
    const opts = optionsOrConfig as MouthSetupWizardOptions;
    currentConfig = opts.currentConfig;
    availableSlots = opts.availableSlots || (opts.slicedParts ? opts.slicedParts.map(p => p.id) : []);
    onConfirm = opts.onSave || opts.onConfirm || (() => {});
    onCancel = opts.onCancel;
  } else {
    currentConfig = optionsOrConfig as MouthRigConfig | undefined;
    availableSlots = availableSlotsParam || [];
    onConfirm = onConfirmParam || (() => {});
    onCancel = onCancelParam;
  }

  let selectedMode: MouthRigMode = currentConfig?.mode || 'viseme_library';
  let step: 1 | 2 | 3 = 1;

  const visemeSlots: Partial<Record<VisemePreset, string>> = { ...(currentConfig?.visemePartIds || currentConfig?.visemeSlots || {}) };
  let upperLipSlot = currentConfig?.lipUpperPartId || currentConfig?.upperLipSlot || '';
  let lowerLipSlot = currentConfig?.lipLowerPartId || currentConfig?.lowerLipSlot || '';
  let cavitySlot = currentConfig?.cavityPartId || currentConfig?.cavitySlot || '';
  let mouthSpriteSlot = currentConfig?.baseMouthPartId || currentConfig?.mouthSpriteSlot || '';

  const renderModal = () => {
    const existing = document.querySelector('.studio-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'studio-modal-overlay';

    let bodyHtml = '';

    if (step === 1) {
      bodyHtml = `
        <div style="font-size:0.75rem; color:#94a3b8; margin-bottom:4px;">
          <strong>Step 1 of 3</strong>: Choose Mouth Animation Mode
        </div>
        <div class="wizard-mode-grid">
          ${(Object.keys(MOUTH_MODE_DESCRIPTIONS) as MouthRigMode[]).map(m => {
            const def = MOUTH_MODE_DESCRIPTIONS[m];
            const isSel = selectedMode === m;
            return `
              <div class="wizard-mode-card ${isSel ? 'selected' : ''}" data-mode="${m}">
                <div class="wizard-mode-card-header">
                  <span>${def.icon}</span>
                  <span>${def.title}</span>
                </div>
                <div class="wizard-mode-card-subtitle">${def.subtitle}</div>
                <ul class="wizard-mode-card-features">
                  ${def.features.map(f => `<li>${f}</li>`).join('')}
                </ul>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else if (step === 2) {
      const slotOptions = (selected: string) => `
        <option value="">-- None / Default --</option>
        ${availableSlots.map(s => `<option value="${s}" ${s === selected ? 'selected' : ''}>${s}</option>`).join('')}
      `;

      bodyHtml = `
        <div style="font-size:0.75rem; color:#94a3b8; margin-bottom:4px;">
          <strong>Step 2 of 3</strong>: Graphic Slot Assignments [${MOUTH_MODE_DESCRIPTIONS[selectedMode].title}]
        </div>
        <div style="display:flex; flex-direction:column; gap:10px; font-size:0.75rem;">
      `;

      if (selectedMode === 'viseme_library') {
        const visemes: { key: VisemePreset; label: string; icon: string }[] = [
          { key: 'rest', label: 'Rest / Silence (M, B, P)', icon: '😐' },
          { key: 'smile', label: 'Smile / Joy', icon: '🙂' },
          { key: 'ah', label: 'Ah / Open (A, I)', icon: '😮' },
          { key: 'oh', label: 'Oh / Round (O)', icon: '⭕' },
          { key: 'ee', label: 'Ee / Teeth (E, C, T)', icon: '😬' },
          { key: 'frown', label: 'Frown / Grief', icon: '☹️' },
          { key: 'ooh', label: 'Ooh / Pucker (U, W)', icon: '😗' },
          { key: 'fv', label: 'F / V (Lip Tuck)', icon: '👄' }
        ];

        bodyHtml += `
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            ${visemes.map(v => `
              <div style="display:flex; flex-direction:column; gap:2px;">
                <label style="font-size:0.7rem; color:#94a3b8;">${v.icon} ${v.label}:</label>
                <select class="studio-select sel-viseme" data-viseme="${v.key}" style="font-size:0.72rem;">
                  ${slotOptions(visemeSlots[v.key] || '')}
                </select>
              </div>
            `).join('')}
          </div>
        `;
      } else if (selectedMode === 'cavity_sandwich') {
        bodyHtml += `
          <div style="display:grid; grid-template-columns:140px 1fr; align-items:center; gap:8px;">
            <label>👄 Upper Lip Slot:</label>
            <select class="studio-select sel-upper-lip" style="font-size:0.75rem;">${slotOptions(upperLipSlot)}</select>
          </div>
          <div style="display:grid; grid-template-columns:140px 1fr; align-items:center; gap:8px;">
            <label>🫦 Lower Lip Slot:</label>
            <select class="studio-select sel-lower-lip" style="font-size:0.75rem;">${slotOptions(lowerLipSlot)}</select>
          </div>
          <div style="display:grid; grid-template-columns:140px 1fr; align-items:center; gap:8px;">
            <label>🕳️ Mouth Cavity Slot:</label>
            <select class="studio-select sel-cavity" style="font-size:0.75rem;">${slotOptions(cavitySlot)}</select>
          </div>
        `;
      } else if (selectedMode === 'mesh_warp') {
        bodyHtml += `
          <div style="display:grid; grid-template-columns:140px 1fr; align-items:center; gap:8px;">
            <label>👄 Mouth Sprite Slot:</label>
            <select class="studio-select sel-mouth-sprite" style="font-size:0.75rem;">${slotOptions(mouthSpriteSlot)}</select>
          </div>
          <div style="font-size:0.7rem; color:#94a3b8; padding:6px; background:rgba(30,41,59,0.5); border-radius:4px;">
            Single-sprite warp uses 4 corner/jaw anchors to morph smiling and open jaw shapes.
          </div>
        `;
      } else {
        bodyHtml += `
          <div style="padding:10px; background:rgba(30,41,59,0.5); border-radius:6px; color:#cbd5e1;">
            ✏️ Procedural vector lips use mathematical Bezier curves with parametric sliders.
          </div>
        `;
      }

      bodyHtml += `</div>`;
    } else {
      // Step 3: Interactive Calibration preview
      bodyHtml = `
        <div style="font-size:0.75rem; color:#94a3b8; margin-bottom:4px;">
          <strong>Step 3 of 3</strong>: Calibration & Interactive Preview [${MOUTH_MODE_DESCRIPTIONS[selectedMode].title}]
        </div>
        <div style="background:#090e1a; border:1px solid #1e293b; border-radius:8px; padding:16px; display:flex; flex-direction:column; gap:14px;">
          <div style="display:flex; justify-content:center; align-items:center; height:90px; background:rgba(2,6,23,0.6); border-radius:6px; position:relative;" id="wizard-mouth-preview-box">
            <span style="font-size:2.8rem;" id="wizard-mouth-preview-glyph">👄</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:8px; font-size:0.75rem;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <label>Mouth Open (Jaw Drop):</label>
              <span id="preview-open-val" style="font-weight:700; color:#38bdf8;">0%</span>
            </div>
            <input type="range" id="preview-open-slider" min="0" max="100" value="0" style="width:100%; accent-color:#38bdf8;" />

            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
              <label>Smile / Frown Expression:</label>
              <span id="preview-smile-val" style="font-weight:700; color:#10b981;">0</span>
            </div>
            <input type="range" id="preview-smile-slider" min="-100" max="100" value="0" style="width:100%; accent-color:#10b981;" />
          </div>
        </div>
      `;
    }

    overlay.innerHTML = `
      <div class="studio-modal wizard-modal">
        <div class="studio-modal-header">
          <span class="studio-modal-title" style="display:flex; align-items:center; gap:6px;">
            <span>👄</span> Mouth Rig Setup Wizard
          </span>
          <button class="btn-studio btn-wizard-close" style="border:none; background:transparent; font-size:1rem; cursor:pointer; color:#94a3b8;">✕</button>
        </div>
        <div class="studio-modal-body">
          ${bodyHtml}
        </div>
        <div class="studio-modal-footer" style="justify-content:space-between;">
          <button class="btn-studio btn-wizard-skip" style="color:#38bdf8; font-size:0.72rem; border-color:rgba(56,189,248,0.3);" title="Skip wizard and configure slots manually in Rig Inspector">
            Skip Wizard (Manual Setup)
          </button>
          <div style="display:flex; gap:8px;">
            <button class="btn-studio btn-wizard-cancel">Cancel</button>
            ${step === 1 ? `
              <button class="btn-studio btn-studio-primary btn-wizard-next">Next: Slots ➜</button>
            ` : step === 2 ? `
              <button class="btn-studio btn-wizard-back">⬅ Back</button>
              <button class="btn-studio btn-studio-primary btn-wizard-next-step3">Next: Calibrate ➜</button>
            ` : `
              <button class="btn-studio btn-wizard-back-step2">⬅ Back</button>
              <button class="btn-studio btn-studio-primary btn-wizard-finish" style="background:#10b981; border-color:#34d399; font-weight:700;">
                Finish & Apply Rig
              </button>
            `}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('.btn-wizard-close')?.addEventListener('click', () => {
      overlay.remove();
      onCancel?.();
    });

    overlay.querySelector('.btn-wizard-cancel')?.addEventListener('click', () => {
      overlay.remove();
      onCancel?.();
    });

    overlay.querySelectorAll('.wizard-mode-card').forEach(card => {
      card.addEventListener('click', () => {
        const m = card.getAttribute('data-mode') as MouthRigMode;
        if (m) {
          selectedMode = m;
          renderModal();
        }
      });
    });

    const finishConfig = (mode: MouthRigMode) => {
      const config: MouthRigConfig = {
        mode,
        visemeSlots: mode === 'viseme_library' ? visemeSlots : undefined,
        upperLipSlot: mode === 'cavity_sandwich' ? upperLipSlot : undefined,
        lowerLipSlot: mode === 'cavity_sandwich' ? lowerLipSlot : undefined,
        cavitySlot: mode === 'cavity_sandwich' ? cavitySlot : undefined,
        mouthSpriteSlot: mode === 'mesh_warp' ? mouthSpriteSlot : undefined
      };

      if (currentConfig && currentConfig.mode && currentConfig.mode !== mode) {
        showModeChangeWarningModal(
          'Mouth',
          MOUTH_MODE_DESCRIPTIONS[currentConfig.mode].title,
          MOUTH_MODE_DESCRIPTIONS[mode].title,
          () => {
            overlay.remove();
            onConfirm(config);
          }
        );
      } else {
        overlay.remove();
        onConfirm(config);
      }
    };

    overlay.querySelector('.btn-wizard-skip')?.addEventListener('click', () => {
      finishConfig(selectedMode);
    });

    overlay.querySelector('.btn-wizard-next')?.addEventListener('click', () => {
      step = 2;
      renderModal();
    });

    overlay.querySelector('.btn-wizard-back')?.addEventListener('click', () => {
      step = 1;
      renderModal();
    });

    overlay.querySelector('.btn-wizard-next-step3')?.addEventListener('click', () => {
      // Save step 2 inputs
      overlay.querySelectorAll('.sel-viseme').forEach(el => {
        const sel = el as HTMLSelectElement;
        const vKey = sel.getAttribute('data-viseme') as VisemePreset;
        if (vKey) visemeSlots[vKey] = sel.value || undefined;
      });
      const selUpper = overlay.querySelector('.sel-upper-lip') as HTMLSelectElement | null;
      if (selUpper) upperLipSlot = selUpper.value;
      const selLower = overlay.querySelector('.sel-lower-lip') as HTMLSelectElement | null;
      if (selLower) lowerLipSlot = selLower.value;
      const selCavity = overlay.querySelector('.sel-cavity') as HTMLSelectElement | null;
      if (selCavity) cavitySlot = selCavity.value;
      const selMesh = overlay.querySelector('.sel-mouth-sprite') as HTMLSelectElement | null;
      if (selMesh) mouthSpriteSlot = selMesh.value;

      step = 3;
      renderModal();
    });

    overlay.querySelector('.btn-wizard-back-step2')?.addEventListener('click', () => {
      step = 2;
      renderModal();
    });

    // Preview sliders in Step 3
    if (step === 3) {
      const openSlider = overlay.querySelector('#preview-open-slider') as HTMLInputElement | null;
      const openVal = overlay.querySelector('#preview-open-val');
      const smileSlider = overlay.querySelector('#preview-smile-slider') as HTMLInputElement | null;
      const smileVal = overlay.querySelector('#preview-smile-val');
      const glyph = overlay.querySelector('#wizard-mouth-preview-glyph');

      const updateGlyph = () => {
        const o = parseInt(openSlider?.value || '0', 10);
        const s = parseInt(smileSlider?.value || '0', 10);
        if (openVal) openVal.textContent = `${o}%`;
        if (smileVal) smileVal.textContent = s > 0 ? `+${s}%` : `${s}%`;

        if (glyph) {
          if (o > 40) glyph.textContent = s > 20 ? '😃' : '😮';
          else if (s > 20) glyph.textContent = '🙂';
          else if (s < -20) glyph.textContent = '🙁';
          else glyph.textContent = '😐';
        }
      };

      openSlider?.addEventListener('input', updateGlyph);
      smileSlider?.addEventListener('input', updateGlyph);
    }

    overlay.querySelector('.btn-wizard-finish')?.addEventListener('click', () => {
      finishConfig(selectedMode);
    });
  };

  renderModal();
}
