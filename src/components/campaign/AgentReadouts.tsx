import React from 'react';

/** Rótulo de seção do perfil e do dossiê: título com ícone opcional, fio até a borda e ação à direita. */
export function SectionLabel({
  title,
  Icon,
  tone = 'text-primary',
  action,
  as: Tag = 'h3',
  className = '',
}: {
  title: string;
  Icon?: React.FC<{ size?: number; className?: string }>;
  tone?: string;
  action?: React.ReactNode;
  as?: 'h2' | 'h3';
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Tag className={`text-protocol flex items-center gap-2 ${tone}`}>
        {Icon && <Icon size={12} />}
        {title}
      </Tag>
      <span aria-hidden className="flex-1 h-px bg-border-subtle" />
      {action}
    </div>
  );
}

/** Leitura numérica (provas, conquistas, imagens) em uma faixa dividida. */
export function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="flex-1 flex flex-col items-center py-3 border-r border-border-subtle last:border-r-0">
      <span className="text-mono-ui text-xl font-semibold text-primary leading-none tabular-nums">{value}</span>
      <span className="text-protocol text-[10px] text-ash-500 mt-1.5">{label}</span>
    </div>
  );
}
