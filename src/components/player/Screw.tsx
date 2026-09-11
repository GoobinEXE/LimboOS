import React from 'react';
import { analyticsTracker } from '../../services/AnalyticsTracker';
import { activityLogger } from '../../services/ActivityLogger';

export interface ScrewProps {
  key?: React.Key;
  className?: string;
  innerClassName?: string;
  onClick?: () => void;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export class ScrewBehavior {
  static registerClick() {
    analyticsTracker.incrementStat('screwClicks');
    analyticsTracker.incrementStat('fidgetClicks');
    activityLogger.logAction('fidget', 'Interação tátil (parafuso)');
  }
}

export default function Screw({ className = '', innerClassName = '', onClick, size = 'md' }: ScrewProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    ScrewBehavior.registerClick();
    if (onClick) onClick();
  };

  const sizeMap = {
    xs: 'w-2 h-2',
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-6 h-6',
  };

  const innerSizeMap = {
    xs: 'w-1 h-[0.5px]',
    sm: 'w-1.5 h-0.5',
    md: 'w-2 h-0.5',
    lg: 'w-3 h-1',
  };

  const outer = className.includes('w-')
    ? className
    : `${sizeMap[size]} rounded-full bg-radial-[at_35%_30%] from-surface-container-high to-surface-sunken border border-border-strong shadow-[inset_0_1px_2px_#000000aa,0_1px_0_#ffffff14] ${className}`;
  const inner = innerClassName || `${innerSizeMap[size]} bg-surface-container-highest rotate-45`;

  return (
    <div
      onClick={handleClick}
      className={`absolute flex items-center justify-center cursor-pointer hover:brightness-125 active:scale-90 transition-all duration-(--duration-fast) ease-limbo z-20 ${outer}`}
    >
      <div className={`pointer-events-none ${inner}`} />
    </div>
  );
}
