import React, { useEffect, useRef } from 'react';
import { useAnimate } from 'motion/react';
import { ADMIN_FADE } from '../lib/motion';

interface AdminTabPanelProps {
  active: boolean;
  children: React.ReactNode;
}

/**
 * Keep-alive tab wrapper: stays mounted (hidden when inactive) and plays
 * a one-shot enter animation whenever the tab becomes active — without
 * remounting children (Firestore listeners stay alive).
 */
export default function AdminTabPanel({ active, children }: AdminTabPanelProps) {
  const [scope, animate] = useAnimate();
  const wasActive = useRef(active);
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      wasActive.current = active;
      return;
    }
    if (active && !wasActive.current && scope.current) {
      // Troca de aba é frequente (e via ⌘1–5): deslocamento mínimo, sem atraso perceptível
      void animate(
        scope.current,
        { opacity: [0, 1], transform: ['translateY(4px)', 'translateY(0px)'] },
        ADMIN_FADE
      );
    }
    wasActive.current = active;
  }, [active, animate, scope]);

  return (
    <div className={active ? 'block' : 'hidden'} aria-hidden={!active}>
      <div ref={scope}>{children}</div>
    </div>
  );
}
