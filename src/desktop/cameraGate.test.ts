import { describe, expect, it } from 'vitest';
import type { CameraAccess } from './ipc';
import { cameraGate, cameraSettingsUrl, wantsVideo } from './cameraGate';

describe('cameraGate', () => {
  it('macOS holds the first request for the explanation, before the system prompt', () => {
    expect(cameraGate('darwin', 'not-determined')).toBe('explain');
  });

  it('macOS lets a granted camera through and refuses a switched-off one', () => {
    expect(cameraGate('darwin', 'granted')).toBe('allow');
    expect(cameraGate('darwin', 'denied')).toBe('blocked');
    expect(cameraGate('darwin', 'restricted')).toBe('blocked');
  });

  it('macOS does not trap the user on an answer it cannot read', () => {
    expect(cameraGate('darwin', 'unknown')).toBe('allow');
  });

  it('Windows has no per-app prompt, only a privacy switch', () => {
    expect(cameraGate('win32', 'not-determined')).toBe('allow');
    expect(cameraGate('win32', 'granted')).toBe('allow');
    expect(cameraGate('win32', 'denied')).toBe('blocked');
  });

  it('Linux is never gated', () => {
    const all: CameraAccess[] = ['granted', 'denied', 'not-determined', 'restricted', 'unknown'];
    for (const access of all) expect(cameraGate('linux', access)).toBe('allow');
  });
});

describe('wantsVideo', () => {
  it('a request that names video, or names nothing, is a camera request', () => {
    expect(wantsVideo({ mediaTypes: ['video'] })).toBe(true);
    expect(wantsVideo({ mediaTypes: ['audio', 'video'] })).toBe(true);
    expect(wantsVideo({ mediaTypes: [] })).toBe(true);
    expect(wantsVideo({})).toBe(true);
    expect(wantsVideo(undefined)).toBe(true);
  });

  it('audio only is not', () => {
    expect(wantsVideo({ mediaTypes: ['audio'] })).toBe(false);
  });
});

describe('cameraSettingsUrl', () => {
  it('has a page to open on macOS and Windows only', () => {
    expect(cameraSettingsUrl('darwin')).toContain('Privacy_Camera');
    expect(cameraSettingsUrl('win32')).toBe('ms-settings:privacy-webcam');
    expect(cameraSettingsUrl('linux')).toBeNull();
  });
});
