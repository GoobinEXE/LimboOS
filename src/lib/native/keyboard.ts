import { Keyboard } from '@capacitor/keyboard';

/**
 * Teclado do app nativo (P11). capacitor.config.ts encolhe o <body> no iOS
 * (`resize: 'body'`) e corrige o redimensionamento do WebView em tela cheia no Android
 * (`resizeOnFullScreen`). Aqui o campo focado rola para o centro depois que o teclado
 * termina de subir. Só carregado no nativo, por import() em nativeShell.ts.
 *
 * Quem cuida da própria rolagem (o LCD do Nokia ouve visualViewport) marca um
 * ancestral com `data-keyboard-scroll="off"`.
 */

const NON_TEXT_INPUTS = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

let keyboardVisible = false;

function isTextField(target: EventTarget | null): target is HTMLElement {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest('[data-keyboard-scroll="off"]')) return false;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(target.type);
  return target.isContentEditable;
}

function revealFocusedField(): void {
  const field = document.activeElement;
  if (!isTextField(field)) return;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  field.scrollIntoView({ block: 'center', inline: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
}

export async function initKeyboard(): Promise<void> {
  await Keyboard.addListener('keyboardDidShow', () => {
    keyboardVisible = true;
    revealFocusedField();
  });
  await Keyboard.addListener('keyboardDidHide', () => {
    keyboardVisible = false;
  });

  // Com o teclado já aberto, trocar de campo não dispara keyboardDidShow de novo.
  document.addEventListener('focusin', (event) => {
    if (!keyboardVisible || !isTextField(event.target)) return;
    requestAnimationFrame(revealFocusedField);
  });
}
