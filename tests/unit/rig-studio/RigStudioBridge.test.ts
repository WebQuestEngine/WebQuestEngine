import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RigStudioBridge } from '../../../src/rig-studio/RigStudioBridge';
import { SpineDocument } from '../../../src/rig-studio/types';

describe('RigStudioBridge postMessage Communication', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('detects embedded mode when query param mode=embedded is set', () => {
    // Mock window.location.search
    delete (window as any).location;
    window.location = new URL('http://localhost:3000/rig-studio.html?mode=embedded') as any;

    const bridge = new RigStudioBridge();
    expect(bridge.isEmbeddedMode).toBe(true);
  });

  it('handles STUDIO_INIT message from host', () => {
    delete (window as any).location;
    window.location = new URL('http://localhost:3000/rig-studio.html?mode=embedded') as any;

    const bridge = new RigStudioBridge();
    let initReceived: any = null;

    bridge.onInit((data) => {
      initReceived = data;
    });

    const mockSpine: SpineDocument = {
      skeleton: { spine: '3.8.99' },
      bones: [{ name: 'root', x: 0, y: 0 }],
      slots: [],
      skins: [],
      animations: {}
    };

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: 'STUDIO_INIT',
          payload: {
            characterName: 'Hero Knight',
            textureUrl: 'sprites/hero.png',
            spineData: mockSpine
          }
        }
      })
    );

    expect(initReceived).not.toBeNull();
    expect(initReceived.characterName).toBe('Hero Knight');
    expect(initReceived.textureUrl).toBe('sprites/hero.png');
    expect(initReceived.spineData.skeleton.spine).toBe('3.8.99');
  });

  it('handles STUDIO_REQUEST_SAVE message from host', () => {
    delete (window as any).location;
    window.location = new URL('http://localhost:3000/rig-studio.html?mode=embedded') as any;

    const bridge = new RigStudioBridge();
    let saveRequested = false;

    bridge.onSaveRequested(() => {
      saveRequested = true;
    });

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: 'STUDIO_REQUEST_SAVE'
        }
      })
    );

    expect(saveRequested).toBe(true);
  });
});
