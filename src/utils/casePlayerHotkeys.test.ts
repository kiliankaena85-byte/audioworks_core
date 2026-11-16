import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CASE_PLAYER_SEEK_STEP_SEC,
  computeSeekRatioDelta,
  HotkeyTargetDescriptor,
  resolveFloatingPlayerHotkeyAction,
} from './casePlayerHotkeys';

const NEUTRAL_TARGET: HotkeyTargetDescriptor = {
  tagName: 'BODY',
  role: null,
  isContentEditable: false,
  insideDialog: false,
  insideEditable: false,
  insideInteractiveWidget: false,
};

test('computeSeekRatioDelta shifts playback position by ±5s and clamps safely to [0..0.992]', () => {
  // 20s track from 5s -> +5s = 10s -> 0.5
  assert.equal(
    computeSeekRatioDelta({ currentTimeSec: 5, durationSec: 20, deltaSec: CASE_PLAYER_SEEK_STEP_SEC }),
    0.5
  );

  // Seek backward below 0s clamps cleanly to 0
  assert.equal(
    computeSeekRatioDelta({ currentTimeSec: 2, durationSec: 20, deltaSec: -CASE_PLAYER_SEEK_STEP_SEC }),
    0
  );

  // Seek forward past duration clamps to maxRatio (0.992) to avoid skipping/ending abruptly
  assert.equal(
    computeSeekRatioDelta({ currentTimeSec: 18, durationSec: 20, deltaSec: CASE_PLAYER_SEEK_STEP_SEC }),
    0.992
  );

  // Guards against invalid duration or NaN inputs
  assert.equal(
    computeSeekRatioDelta({ currentTimeSec: Number.NaN, durationSec: 0, deltaSec: 5 }),
    0.992
  );
  assert.equal(
    computeSeekRatioDelta({ currentTimeSec: 4, durationSec: 20, deltaSec: Number.NaN }),
    0.2
  );
});

test('resolveFloatingPlayerHotkeyAction triggers Space/Arrows anywhere on neutral page elements when player is active', () => {
  assert.equal(
    resolveFloatingPlayerHotkeyAction({
      key: ' ',
      code: 'Space',
      repeat: false,
      isPlayerActive: true,
      target: NEUTRAL_TARGET,
    }),
    'toggle_play_pause'
  );

  assert.equal(
    resolveFloatingPlayerHotkeyAction({
      key: 'ArrowLeft',
      code: 'ArrowLeft',
      repeat: false,
      isPlayerActive: true,
      target: { ...NEUTRAL_TARGET, tagName: 'MAIN' },
    }),
    'seek_backward'
  );

  assert.equal(
    resolveFloatingPlayerHotkeyAction({
      key: 'ArrowRight',
      code: 'ArrowRight',
      repeat: true, // Held ArrowRight continues seeking
      isPlayerActive: true,
      target: { ...NEUTRAL_TARGET, tagName: 'SECTION' },
    }),
    'seek_forward'
  );

  // Held Space key-repeat must NOT rapid-fire play/pause toggles
  assert.equal(
    resolveFloatingPlayerHotkeyAction({
      key: ' ',
      code: 'Space',
      repeat: true,
      isPlayerActive: true,
      target: NEUTRAL_TARGET,
    }),
    null
  );
});

test('resolveFloatingPlayerHotkeyAction stays silent when FloatingCasePlayer is inactive or modifier keys are held', () => {
  assert.equal(
    resolveFloatingPlayerHotkeyAction({
      key: ' ',
      code: 'Space',
      isPlayerActive: false,
      target: NEUTRAL_TARGET,
    }),
    null
  );

  assert.equal(
    resolveFloatingPlayerHotkeyAction({
      key: 'ArrowLeft',
      code: 'ArrowLeft',
      altKey: true,
      isPlayerActive: true,
      target: NEUTRAL_TARGET,
    }),
    null
  );

  assert.equal(
    resolveFloatingPlayerHotkeyAction({
      key: ' ',
      code: 'Space',
      metaKey: true,
      isPlayerActive: true,
      target: NEUTRAL_TARGET,
    }),
    null
  );
});

test('resolveFloatingPlayerHotkeyAction never hijacks text inputs, dialogs, buttons (Space), or native sliders/tabs (Arrows)', () => {
  for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) {
    assert.equal(
      resolveFloatingPlayerHotkeyAction({
        key: ' ',
        code: 'Space',
        isPlayerActive: true,
        target: { ...NEUTRAL_TARGET, tagName },
      }),
      null
    );
    assert.equal(
      resolveFloatingPlayerHotkeyAction({
        key: 'ArrowRight',
        code: 'ArrowRight',
        isPlayerActive: true,
        target: { ...NEUTRAL_TARGET, tagName },
      }),
      null
    );
  }

  // ContentEditable or modal dialog
  assert.equal(
    resolveFloatingPlayerHotkeyAction({
      key: ' ',
      code: 'Space',
      isPlayerActive: true,
      target: { ...NEUTRAL_TARGET, isContentEditable: true },
    }),
    null
  );
  assert.equal(
    resolveFloatingPlayerHotkeyAction({
      key: 'ArrowLeft',
      code: 'ArrowLeft',
      isPlayerActive: true,
      target: { ...NEUTRAL_TARGET, insideDialog: true },
    }),
    null
  );

  // Focused <button> handles its own Space click natively; Arrows stay available globally
  assert.equal(
    resolveFloatingPlayerHotkeyAction({
      key: ' ',
      code: 'Space',
      isPlayerActive: true,
      target: { ...NEUTRAL_TARGET, tagName: 'BUTTON' },
    }),
    null
  );
  assert.equal(
    resolveFloatingPlayerHotkeyAction({
      key: 'ArrowRight',
      code: 'ArrowRight',
      isPlayerActive: true,
      target: { ...NEUTRAL_TARGET, tagName: 'BUTTON' },
    }),
    'seek_forward'
  );

  // Focused scrubber slider owns ArrowLeft/Right, while Space toggles play/pause globally
  assert.equal(
    resolveFloatingPlayerHotkeyAction({
      key: 'ArrowLeft',
      code: 'ArrowLeft',
      isPlayerActive: true,
      target: { ...NEUTRAL_TARGET, tagName: 'DIV', role: 'slider', insideInteractiveWidget: true },
    }),
    null
  );
  assert.equal(
    resolveFloatingPlayerHotkeyAction({
      key: ' ',
      code: 'Space',
      isPlayerActive: true,
      target: { ...NEUTRAL_TARGET, tagName: 'DIV', role: 'slider', insideInteractiveWidget: true },
    }),
    'toggle_play_pause'
  );
});
