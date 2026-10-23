import { createRoot } from 'react-dom/client';
import { useAppStore } from '../store/useAppStore';
import { createDesktopBridge } from './bridge';
import { DesktopCameraNotice } from './DesktopCameraNotice';

/**
 * Starts the desktop shell's side of the web app. Loaded by src/main.tsx with a
 * dynamic import, and only when `window.desktop` exists (the packaged Electron
 * app, or `electron:dev`), so a browser never downloads or runs any of this.
 *
 * The notice gets its own React root: the camera can be requested from the
 * landing demo as well as from the signed-in app, and the explanation has to be
 * able to appear on either.
 */
export function mountDesktopHost(): void {
  const api = window.desktop;
  if (!api) return;

  createDesktopBridge({
    api,
    target: window,
    getApp: () => {
      const { cameraEnabled, detecting } = useAppStore.getState();
      return { cameraEnabled, detecting };
    },
    subscribeApp: (listener) => useAppStore.subscribe(listener),
    setCameraEnabled: (enabled) => useAppStore.getState().setCameraEnabled(enabled),
  });

  const container = document.createElement('div');
  container.id = 'desktop-host';
  document.body.appendChild(container);
  createRoot(container).render(<DesktopCameraNotice api={api} />);
}
