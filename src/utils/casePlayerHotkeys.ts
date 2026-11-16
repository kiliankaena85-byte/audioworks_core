export const CASE_PLAYER_SEEK_STEP_SEC = 5;

export interface HotkeyTargetDescriptor {
  tagName: string;
  role: string | null;
  isContentEditable: boolean;
  insideDialog: boolean;
  insideEditable: boolean;
  insideInteractiveWidget: boolean;
}

export type FloatingPlayerHotkeyAction =
  | 'toggle_play_pause'
  | 'seek_backward'
  | 'seek_forward';

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'OPTION']);
const SPACE_NATIVE_TAGS = new Set(['BUTTON', 'A', 'SUMMARY']);
const SPACE_NATIVE_ROLES = new Set([
  'button',
  'link',
  'tab',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'checkbox',
  'switch',
  'radio',
  'option',
]);
const ARROW_NATIVE_ROLES = new Set([
  'slider',
  'tab',
  'tablist',
  'radio',
  'radiogroup',
  'menu',
  'menubar',
  'menuitem',
  'listbox',
  'option',
  'spinbutton',
]);

export function computeSeekRatioDelta(params: {
  currentTimeSec: number;
  durationSec: number;
  deltaSec: number;
  maxRatio?: number;
}): number {
  const safeDuration =
    Number.isFinite(params.durationSec) && params.durationSec > 0
      ? params.durationSec
      : 1;
  const safeCurrent =
    Number.isFinite(params.currentTimeSec) && params.currentTimeSec > 0
      ? Math.min(safeDuration, params.currentTimeSec)
      : 0;
  const safeDelta = Number.isFinite(params.deltaSec) ? params.deltaSec : 0;
  const maxRatio =
    params.maxRatio !== undefined && Number.isFinite(params.maxRatio)
      ? Math.min(1, Math.max(0.1, params.maxRatio))
      : 0.992;

  const nextSec = Math.max(0, Math.min(safeDuration, safeCurrent + safeDelta));
  return Math.max(0, Math.min(maxRatio, nextSec / safeDuration));
}

export function resolveFloatingPlayerHotkeyAction(params: {
  key: string;
  code?: string;
  repeat?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  isPlayerActive: boolean;
  target: HotkeyTargetDescriptor;
}): FloatingPlayerHotkeyAction | null {
  if (!params.isPlayerActive) return null;
  if (params.ctrlKey || params.metaKey || params.altKey) return null;

  const { target } = params;
  if (target.insideDialog || target.insideEditable || target.isContentEditable) {
    return null;
  }

  const tag = target.tagName.toUpperCase();
  if (EDITABLE_TAGS.has(tag)) {
    return null;
  }

  const role = target.role?.toLowerCase() ?? null;
  const isSpace = params.code === 'Space' || params.key === ' ';
  if (isSpace) {
    if (params.repeat) return null;
    if (SPACE_NATIVE_TAGS.has(tag)) return null;
    if (role && SPACE_NATIVE_ROLES.has(role)) return null;
    return 'toggle_play_pause';
  }

  const isArrowLeft = params.code === 'ArrowLeft' || params.key === 'ArrowLeft';
  const isArrowRight = params.code === 'ArrowRight' || params.key === 'ArrowRight';
  if (!isArrowLeft && !isArrowRight) return null;

  if (target.insideInteractiveWidget) return null;
  if (role && ARROW_NATIVE_ROLES.has(role)) return null;

  return isArrowLeft ? 'seek_backward' : 'seek_forward';
}

export function extractHotkeyTargetDescriptor(
  eventTarget: EventTarget | null,
  activeElement: Element | null = null
): HotkeyTargetDescriptor {
  const raw =
    eventTarget && typeof (eventTarget as Element).tagName === 'string'
      ? (eventTarget as HTMLElement)
      : (activeElement as HTMLElement | null);

  if (!raw || typeof raw.tagName !== 'string') {
    return {
      tagName: 'BODY',
      role: null,
      isContentEditable: false,
      insideDialog: false,
      insideEditable: false,
      insideInteractiveWidget: false,
    };
  }

  const closestSafe = (selector: string): boolean =>
    typeof raw.closest === 'function' ? Boolean(raw.closest(selector)) : false;

  return {
    tagName: raw.tagName.toUpperCase(),
    role: typeof raw.getAttribute === 'function' ? raw.getAttribute('role') : null,
    isContentEditable: Boolean(raw.isContentEditable),
    insideDialog: closestSafe('[role="dialog"], dialog, [aria-modal="true"]'),
    insideEditable: closestSafe('input, textarea, select, [contenteditable="true"], [contenteditable=""]'),
    insideInteractiveWidget: closestSafe(
      '[role="slider"], [role="tablist"], [role="radiogroup"], [role="menu"], [role="listbox"]'
    ),
  };
}
