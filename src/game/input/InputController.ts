import type { ActionState, InputHijackState } from '../types';

const keyMap: Record<string, keyof ActionState> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'jump',
  KeyW: 'jump',
  Space: 'jump',
  ShiftLeft: 'dash',
  ShiftRight: 'dash',
  KeyK: 'dash',
  ArrowDown: 'down',
  KeyS: 'down'
};

const blankActions = (): ActionState => ({
  left: false,
  right: false,
  jump: false,
  dash: false,
  down: false
});

export class InputController {
  private keyboardState: ActionState = blankActions();
  private touchState: ActionState = blankActions();
  private lastJump = false;
  private lastDash = false;

  constructor(private readonly documentRef: Document) {
    this.bindKeyboard();
    this.bindTouch();
  }

  snapshot(hijack: InputHijackState | null, nowMs: number): ActionState {
    const combined: ActionState = {
      left: this.keyboardState.left || this.touchState.left,
      right: this.keyboardState.right || this.touchState.right,
      jump: this.keyboardState.jump || this.touchState.jump,
      dash: this.keyboardState.dash || this.touchState.dash,
      down: this.keyboardState.down || this.touchState.down
    };

    if (!hijack?.active || (hijack.expires_at_ms && hijack.expires_at_ms < nowMs)) {
      return combined;
    }

    return this.applyHijack(combined, hijack);
  }

  consumeJumpPressed(actions: ActionState) {
    const pressed = actions.jump && !this.lastJump;
    this.lastJump = actions.jump;
    return pressed;
  }

  consumeDashPressed(actions: ActionState) {
    const pressed = actions.dash && !this.lastDash;
    this.lastDash = actions.dash;
    return pressed;
  }

  resetEdges() {
    this.lastJump = false;
    this.lastDash = false;
  }

  releaseAll() {
    this.keyboardState = blankActions();
    this.touchState = blankActions();
    this.resetEdges();
  }

  private bindKeyboard() {
    window.addEventListener('keydown', (event) => {
      const action = keyMap[event.code];
      if (!action) return;
      event.preventDefault();
      this.keyboardState[action] = true;
    });

    window.addEventListener('keyup', (event) => {
      const action = keyMap[event.code];
      if (!action) return;
      event.preventDefault();
      this.keyboardState[action] = false;
    });

    window.addEventListener('blur', () => {
      this.releaseAll();
    });
  }

  private bindTouch() {
    this.documentRef.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => {
      const action = button.dataset.action as keyof ActionState | undefined;
      if (!action) return;

      const activate = (event: Event) => {
        event.preventDefault();
        if (event instanceof PointerEvent) button.setPointerCapture?.(event.pointerId);
        this.touchState[action] = true;
      };
      const release = (event: Event) => {
        event.preventDefault();
        if (event instanceof PointerEvent && button.hasPointerCapture?.(event.pointerId)) {
          button.releasePointerCapture?.(event.pointerId);
        }
        this.touchState[action] = false;
      };

      button.addEventListener('pointerdown', activate);
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('pointerleave', release);
      button.addEventListener('contextmenu', release);
      button.addEventListener('selectstart', (event) => event.preventDefault());
    });
  }

  private applyHijack(actions: ActionState, hijack: InputHijackState): ActionState {
    const mapped = { ...actions };
    const original = { ...actions };

    for (const [source, target] of Object.entries(hijack.mapping)) {
      if (source === 'move_left' && target === 'move_right') mapped.left = original.right;
      if (source === 'move_right' && target === 'move_left') mapped.right = original.left;
      if (source === 'jump_button' && target === 'action_dash') mapped.jump = false;
      if (source === 'jump_button' && target === 'action_dash') mapped.dash = original.jump || original.dash;
      if (source === 'action_dash' && target === 'jump_button') mapped.jump = original.dash || original.jump;
    }

    return mapped;
  }
}
