import React from 'react';

interface RetroSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function RetroSpinner({ size = 'md', className = '' }: RetroSpinnerProps) {
  const dimensions = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16'
  }[size];

  const borderSize = {
    sm: 'border-2',
    md: 'border-[3px]',
    lg: 'border-4'
  }[size];

  const dotSize = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-3 h-3'
  }[size];

  return (
    <div className={`relative flex items-center justify-center ${className}`} aria-hidden>
      <div className={`${dimensions} relative flex items-center justify-center`}>
        <div className={`absolute inset-0 rounded-full ${borderSize} border-border`} />
        {/* Carretel: giro um pouco mais rápido que 1s faz a espera parecer menor */}
        <div className={`absolute inset-0 rounded-full ${borderSize} border-transparent border-t-accent animate-[spin_0.8s_linear_infinite]`} />
        <div className={`${dotSize} bg-accent rounded-full animate-led`} />
      </div>
    </div>
  );
}
