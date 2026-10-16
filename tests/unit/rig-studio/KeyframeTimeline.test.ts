import { describe, it, expect, beforeEach } from 'vitest';
import { KeyframeTimeline } from '../../../src/rig-studio/timeline/KeyframeTimeline';
import { getDefaultJointPositions } from '../../../src/rig-studio/rigging/AnatomicalRig';
import { StudioAnimationDefinition } from '../../../src/rig-studio/types';

describe('KeyframeTimeline - Copy, Paste, Close Cycle and Kinematics', () => {
  let container: HTMLDivElement;
  let restJoints: any;
  let animations: Record<string, StudioAnimationDefinition>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    restJoints = getDefaultJointPositions('front', 200, 400);

    animations = {
      walk: {
        name: 'walk',
        relevantSides: ['front', 'left', 'right'],
        tracks: {
          front: {
            duration: 1.0,
            keyframes: [
              {
                time: 0.0,
                name: 'Contact L',
                joints: {
                  ...restJoints,
                  foot_l: { x: restJoints.foot_l.x + 20, y: restJoints.foot_l.y - 10 }
                }
              },
              {
                time: 0.5,
                name: 'Pass L',
                joints: {
                  ...restJoints,
                  foot_l: { x: restJoints.foot_l.x - 15, y: restJoints.foot_l.y }
                }
              }
            ]
          }
        }
      }
    };
  });

  it('copies and pastes keyframes across timestamps', () => {
    let pastedTime: number | null = null;
    const timeline = new KeyframeTimeline(
      container,
      animations,
      'walk',
      'front',
      restJoints,
      {
        onKeyframePasted: (t) => {
          pastedTime = t;
        }
      }
    );

    // Copy the keyframe at index 0 (time 0.0s)
    const copied = timeline.copyKeyframe(0);
    expect(copied).toBe(true);

    const clipboard = KeyframeTimeline.getClipboard();
    expect(clipboard).toBeDefined();
    expect(clipboard?.name).toBe('Contact L');
    expect(clipboard?.joints.foot_l.x).toBe(restJoints.foot_l.x + 20);

    // Set playhead time to 0.75s and paste
    timeline.setTime(0.75);
    const pasted = timeline.pasteKeyframe();
    expect(pasted).toBe(true);
    expect(pastedTime).toBe(0.75);

    const track = animations.walk.tracks.front!;
    expect(track.keyframes.length).toBe(3);
    const kfAt75 = track.keyframes.find(k => Math.abs(k.time - 0.75) < 0.01);
    expect(kfAt75).toBeDefined();
    expect(kfAt75?.joints.foot_l.x).toBe(restJoints.foot_l.x + 20);

    timeline.destroy();
  });

  it('closes walk cycle loop by copying 0.00s initial pose to duration end', () => {
    let closedDuration: number | null = null;
    const timeline = new KeyframeTimeline(
      container,
      animations,
      'walk',
      'front',
      restJoints,
      {
        onCycleClosed: (dur) => {
          closedDuration = dur;
        }
      }
    );

    const track = animations.walk.tracks.front!;
    expect(track.keyframes.length).toBe(2);

    // Close the cycle
    const closed = timeline.closeCycle();
    expect(closed).toBe(true);
    expect(closedDuration).toBe(1.0);

    // Track should now have keyframe at 1.0s matching initial 0.00s contact pose
    expect(track.keyframes.length).toBe(3);
    const endKey = track.keyframes.find(k => Math.abs(k.time - 1.0) < 0.01);
    expect(endKey).toBeDefined();
    expect(endKey?.name).toContain('Contact L');
    expect(endKey?.joints.foot_l.x).toBe(track.keyframes[0].joints.foot_l.x);
    expect(endKey?.joints.foot_l.y).toBe(track.keyframes[0].joints.foot_l.y);

    timeline.destroy();
  });

  it('manages Kinematics Mode (IK / FK) toggle and notification', () => {
    let modeNotified: string | null = null;
    const timeline = new KeyframeTimeline(
      container,
      animations,
      'walk',
      'front',
      restJoints,
      {
        onKinematicsModeChanged: (mode) => {
          modeNotified = mode;
        }
      }
    );

    expect(timeline.getKinematicsMode()).toBe('ik');

    timeline.setKinematicsMode('fk');
    expect(timeline.getKinematicsMode()).toBe('fk');

    timeline.setKinematicsMode('ik');
    expect(timeline.getKinematicsMode()).toBe('ik');

    timeline.destroy();
  });
});
