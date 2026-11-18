import { useEffect, useRef } from 'react';

interface Entry {
  id: object;
  run: () => void;
}
/** Pilha de módulo: o último registrado (modal do topo) é o único que responde. */
const stack: Entry[] = [];
let listening = false;

function onKeyDown(e: KeyboardEvent) {
  if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
  const isSave = e.key === 's' || e.key === 'S';
  const isEnter = e.key === 'Enter';
  if (!isSave && !isEnter) return;
  const top = stack[stack.length - 1];
  if (!top) return;
  e.preventDefault();
  e.stopPropagation();
  if (e.repeat) return;
  top.run();
}

function sync() {
  if (stack.length && !listening) {
    window.addEventListener('keydown', onKeyDown, true);
    listening = true;
  } else if (!stack.length && listening) {
    window.removeEventListener('keydown', onKeyDown, true);
    listening = false;
  }
}

/**
 * ⌘S / Ctrl+S e ⌘Enter / Ctrl+Enter chamam `onSave` enquanto `active` for true.
 * Com vários registros ativos, só o mais recente reage. Não colide com os atalhos
 * globais do Dashboard (⌘K, ⌘1 a ⌘5, ⌘\). `onSave` deve ignorar quando já está
 * salvando ou quando a validação falha.
 */
export function useSaveShortcut(active: boolean, onSave: () => void): void {
  const saveRef = useRef(onSave);
  saveRef.current = onSave;

  useEffect(() => {
    if (!active) return;
    const entry: Entry = { id: {}, run: () => saveRef.current() };
    stack.push(entry);
    sync();
    return () => {
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
      sync();
    };
  }, [active]);
}
