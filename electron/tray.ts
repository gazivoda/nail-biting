import { app, Menu, nativeImage, Tray, type MenuItemConstructorOptions } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { buildTrayMenu, trayTooltip, type TrayItemId, type TrayMenuItem, type TrayModelInput } from '../src/desktop/trayModel';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** electron/assets in dev, Resources/tray in the packaged app (see "extraResources"). */
function trayAssetDir(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'tray')
    : path.join(__dirname, '..', 'electron', 'assets');
}

/**
 * macOS: the black-and-alpha template image, which the system recolours for the
 * light, dark and highlighted menu bar. (A coloured icon used as a template
 * renders as a white square, which is what the earlier tray did.)
 * Windows and Linux: the brand icon.
 */
function loadTrayImage() {
  if (process.platform === 'darwin') {
    const template = path.join(trayAssetDir(), 'trayTemplate.png');
    if (existsSync(template)) {
      const img = nativeImage.createFromPath(template);
      img.setTemplateImage(true);
      return img;
    }
  }
  const brand = app.isPackaged
    ? path.join(__dirname, '..', 'dist', 'icons', 'icon-32x32.png')
    : path.join(__dirname, '..', 'public', 'icons', 'icon-32x32.png');
  return existsSync(brand) ? nativeImage.createFromPath(brand) : nativeImage.createEmpty();
}

function toTemplate(items: TrayMenuItem[], onAction: (id: TrayItemId) => void): MenuItemConstructorOptions[] {
  return items.map((item): MenuItemConstructorOptions => {
    if (item.type === 'separator') return { type: 'separator' };
    return {
      label: item.label,
      type: item.type,
      enabled: item.enabled,
      checked: item.checked,
      click: () => onAction(item.id),
    };
  });
}

export type TrayController = {
  update(input: TrayModelInput): void;
  /** Windows: a one-off balloon from the tray icon. */
  balloon(title: string, content: string): void;
};

/** The system tray icon and its menu. All menu content comes from trayModel.ts. */
export function createTray(opts: {
  onAction: (id: TrayItemId) => void;
  onClick: () => void;
  initial: TrayModelInput;
}): TrayController {
  const tray = new Tray(loadTrayImage());

  const update = (input: TrayModelInput) => {
    tray.setToolTip(trayTooltip(input.state, input.now));
    tray.setContextMenu(Menu.buildFromTemplate(toTemplate(buildTrayMenu(input), opts.onAction)));
  };
  update(opts.initial);

  // macOS opens the menu on click; on Windows and Linux a click opens the app.
  tray.on('click', opts.onClick);

  return {
    update,
    balloon: (title, content) => {
      if (process.platform === 'win32') tray.displayBalloon({ title, content });
    },
  };
}
