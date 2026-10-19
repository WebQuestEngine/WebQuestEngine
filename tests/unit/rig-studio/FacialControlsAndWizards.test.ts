import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  openEyeSetupWizard,
  openMouthSetupWizard,
  showModeChangeWarningModal,
  EYE_MODE_DESCRIPTIONS,
  MOUTH_MODE_DESCRIPTIONS
} from '../../../src/rig-studio/dialogs/FacialSetupWizard';
import { KeyframeTimeline, interpolateFacialPose } from '../../../src/rig-studio/timeline/KeyframeTimeline';
import { RigStudioApp } from '../../../src/rig-studio/RigStudioApp';
import { FacialPoseData, EyeRigConfig, MouthRigConfig } from '../../../src/rig-studio/types';

describe('Facial Controls & Setup Wizards', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('FacialSetupWizard - Eye & Mouth Setup Wizards', () => {
    it('renders Eye Setup Wizard with all 3 architecture modes and description cards', () => {
      let savedConfig: EyeRigConfig | null = null;
      openEyeSetupWizard({
        slicedParts: [
          { id: 'part_eye_open', name: 'Eye Open' },
          { id: 'part_eye_closed', name: 'Eye Closed' }
        ],
        onSave: (cfg) => {
          savedConfig = cfg;
        }
      });

      const modal = document.querySelector('.wizard-modal');
      expect(modal).not.toBeNull();
      expect(modal?.textContent).toContain('Eye Rig Setup Wizard');

      const modeCards = modal?.querySelectorAll('.wizard-mode-card');
      expect(modeCards?.length).toBe(3);

      // Verify descriptions match technical proposal
      expect(modal?.textContent).toContain('Frame-by-Frame Sprite Swap');
      expect(modal?.textContent).toContain('Sclera Window Clipping Mask');
      expect(modal?.textContent).toContain('Procedural Vector Eyes');

      // Click Skip Wizard to test skip button
      const skipBtn = modal?.querySelector('.btn-wizard-skip') as HTMLButtonElement;
      expect(skipBtn).not.toBeNull();
      skipBtn.click();

      // Modal closed and savedConfig is generated
      expect(document.querySelector('.wizard-modal')).toBeNull();
      expect(savedConfig).not.toBeNull();
      expect(savedConfig?.mode).toBe('sclera_window');
    });

    it('navigates Eye Setup Wizard through steps to bind slots and finish', () => {
      let savedConfig: EyeRigConfig | null = null;
      openEyeSetupWizard({
        slicedParts: [
          { id: 'sclera_1', name: 'Sclera Base' },
          { id: 'pupil_1', name: 'Eye Pupil' },
          { id: 'lid_1', name: 'Upper Eyelid' }
        ],
        onSave: (cfg) => {
          savedConfig = cfg;
        }
      });

      let modal = document.querySelector('.wizard-modal');
      // Select Mode 2: Sclera Window
      const scleraCard = modal?.querySelector('[data-mode="sclera_window"]') as HTMLElement;
      scleraCard.click();

      // Next step
      modal = document.querySelector('.wizard-modal');
      const nextBtn = modal?.querySelector('.btn-wizard-next') as HTMLButtonElement;
      nextBtn.click();

      modal = document.querySelector('.wizard-modal');
      expect(modal?.textContent).toContain('Step 2 of 2');

      // Finish wizard
      const finishBtn = modal?.querySelector('.btn-wizard-finish') as HTMLButtonElement;
      finishBtn.click();

      expect(savedConfig).not.toBeNull();
      expect(savedConfig?.mode).toBe('sclera_window');
    });

    it('renders Mouth Setup Wizard and allows interactive jaw/smile preview calibration', () => {
      let savedConfig: MouthRigConfig | null = null;
      openMouthSetupWizard({
        slicedParts: [
          { id: 'vis_rest', name: 'Mouth Rest' },
          { id: 'vis_smile', name: 'Mouth Smile' }
        ],
        onSave: (cfg) => {
          savedConfig = cfg;
        }
      });

      const modal = document.querySelector('.wizard-modal');
      expect(modal).not.toBeNull();
      expect(modal?.textContent).toContain('Mouth Rig Setup Wizard');

      const modeCards = modal?.querySelectorAll('.wizard-mode-card');
      expect(modeCards?.length).toBe(4);

      // Verify modes
      expect(modal?.textContent).toContain('Sliced Viseme Library');
      expect(modal?.textContent).toContain('Masked Cavity Sandwich');
      expect(modal?.textContent).toContain('Single-Sprite Mesh Warp');
      expect(modal?.textContent).toContain('Procedural Vector Lips');

      // Click Skip
      const skipBtn = modal?.querySelector('.btn-wizard-skip') as HTMLButtonElement;
      skipBtn.click();

      expect(savedConfig).not.toBeNull();
      expect(savedConfig?.mode).toBe('viseme_library');
    });

    it('prompts mode change warning modal when switching between distinct architectures', () => {
      let confirmed = false;
      showModeChangeWarningModal({
        feature: 'Eye Rig',
        currentModeName: 'Sclera Window Clipping Mask',
        targetModeName: 'Frame-by-Frame Sprite Swap',
        onConfirm: () => {
          confirmed = true;
        }
      });

      const modal = document.querySelector('.studio-modal');
      expect(modal).not.toBeNull();
      expect(modal?.textContent).toContain('Warning: Switch Eye Rig Architecture?');
      expect(modal?.textContent).toContain('Reset graphic slot assignments');

      const confirmBtn = modal?.querySelector('.btn-warning-confirm') as HTMLButtonElement;
      confirmBtn.click();

      expect(confirmed).toBe(true);
    });
  });

  describe('KeyframeTimeline - Facial Pose Keyframing & Interpolation', () => {
    it('interpolates scalar facial channels smoothly across timestamps', () => {
      const poseA: FacialPoseData = {
        eyelids_blink_l: 0.0,
        eyelids_blink_r: 0.0,
        eyebrows_height_l: 0,
        lips_open: 0.0,
        lips_smile: 0.0,
        viseme: 'rest'
      };

      const poseB: FacialPoseData = {
        eyelids_blink_l: 1.0,
        eyelids_blink_r: 1.0,
        eyebrows_height_l: 10,
        lips_open: 0.8,
        lips_smile: 0.6,
        viseme: 'smile'
      };

      // Midpoint at t = 0.5
      const keyframes = [
        { time: 0.0, face: poseA },
        { time: 1.0, face: poseB }
      ];
      const mid = interpolateFacialPose(keyframes, 0.5, 1.0);
      expect(mid.eyelids_blink_l).toBeCloseTo(0.5, 2);
      expect(mid.eyelids_blink_r).toBeCloseTo(0.5, 2);
      expect(mid.eyebrows_height_l).toBeCloseTo(5, 1);
      expect(mid.lips_open).toBeCloseTo(0.4, 2);
      expect(mid.lips_smile).toBeCloseTo(0.3, 2);
      expect(mid.viseme).toBe('rest'); // Viseme stays with earlier keyframe until threshold
    });

    it('records and samples facial keyframes on the timeline', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const animations = {
        idle: {
          name: 'idle',
          relevantSides: ['front'],
          tracks: {
            front: {
              duration: 2.0,
              fps: 30,
              keyframes: [
                {
                  time: 0.0,
                  joints: { head: { x: 0, y: -312 }, neck: { x: 0, y: -260 } },
                  face: { eyelids_blink_l: 0, lips_open: 0, viseme: 'rest' }
                },
                {
                  time: 1.0,
                  joints: { head: { x: 0, y: -312 }, neck: { x: 0, y: -260 } },
                  face: { eyelids_blink_l: 1.0, lips_open: 0.5, viseme: 'ah' }
                }
              ]
            }
          }
        }
      };

      const timeline = new KeyframeTimeline(
        container,
        animations,
        'idle',
        'front',
        { head: { x: 0, y: -312 }, neck: { x: 0, y: -260 } } as any
      );

      // Sample at 0.5s
      timeline.setTime(0.5);
      const poseMid = timeline.getCurrentFacialPose();
      expect(poseMid.eyelids_blink_l).toBeCloseTo(0.5, 2);
      expect(poseMid.lips_open).toBeCloseTo(0.25, 2);

      // Add a custom keyframe at 1.5s
      timeline.addFacialKeyframe(1.5, { eyelids_blink_l: 0.2, lips_open: 0.9, viseme: 'oh' });
      timeline.setTime(1.5);
      const pose15 = timeline.getCurrentFacialPose();
      expect(pose15.viseme).toBe('oh');
      expect(pose15.lips_open).toBe(0.9);

      timeline.destroy();
    });
  });

  describe('RigStudioApp - Face Tab & Live Controls', () => {
    it('switches to Face tab and interacts with expression sliders', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const app = new RigStudioApp(container);
      const rightSidebar = container.querySelector('#right-sidebar') as HTMLElement;
      expect(rightSidebar).not.toBeNull();

      // Click Face tab button
      const faceTabBtn = rightSidebar.querySelector('[data-tab="face"]') as HTMLButtonElement;
      expect(faceTabBtn).not.toBeNull();
      faceTabBtn.click();

      // Verify Face tab content rendered
      expect(rightSidebar.textContent).toContain('Facial Rigging & Controls');
      expect(rightSidebar.querySelector('#btn-open-eye-wizard')).not.toBeNull();
      expect(rightSidebar.querySelector('#btn-open-mouth-wizard')).not.toBeNull();

      // Verify Viseme chips
      const chips = rightSidebar.querySelectorAll('.btn-face-viseme-chip');
      expect(chips.length).toBe(9);

      // Verify expression sliders
      const openSlider = rightSidebar.querySelector('[data-prop="lips_open"]') as HTMLInputElement;
      expect(openSlider).not.toBeNull();
      openSlider.value = '0.75';
      openSlider.dispatchEvent(new Event('input'));

      const openVal = rightSidebar.querySelector('#val-face-lips-open');
      expect(openVal?.textContent).toBe('75%');
    });
  });
});
