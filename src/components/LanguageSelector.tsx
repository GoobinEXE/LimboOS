import { useTranslation } from 'react-i18next';
import { setAppLanguage, type AppLanguage } from '../i18n';
import clsx from 'clsx';

type Variant = 'deck' | 'admin' | 'nokia';

interface LanguageSelectorProps {
  variant?: Variant;
  className?: string;
}

const OPTIONS: { value: AppLanguage; label: string }[] = [
  { value: 'pt-BR', label: 'PT' },
  { value: 'en', label: 'EN' },
];

export default function LanguageSelector({ variant = 'deck', className }: LanguageSelectorProps) {
  const { t, i18n } = useTranslation('common');
  const current: AppLanguage = i18n.language?.toLowerCase().startsWith('en') ? 'en' : 'pt-BR';

  const labelCls =
    variant === 'admin'
      ? 'font-display uppercase font-bold tracking-[0.15em] text-[9px] text-ash-500 hidden xl:inline'
      : variant === 'nokia'
        ? 'font-mono text-[8px] text-lcd-ink/70'
        : 'font-display uppercase tracking-[0.15em] text-[9px] text-ash-500';

  const btnBase =
    variant === 'admin'
      ? 'font-display uppercase font-bold tracking-[0.12em] text-[9px] h-8 px-2.5 border -ml-px first:ml-0 first:rounded-l-inset last:rounded-r-inset transition-colors'
      : variant === 'nokia'
        ? 'font-mono text-[8px] px-1.5 py-0.5 border transition-colors'
        : 'font-display uppercase font-bold tracking-[0.12em] text-[9px] px-2 py-0.5 border transition-colors';

  const activeCls =
    variant === 'nokia'
      ? 'border-lcd-ink bg-lcd-ink text-lcd-paper'
      : 'relative z-10 border-accent-60 bg-accent-10 text-primary';

  const idleCls =
    variant === 'nokia'
      ? 'border-lcd-ink/40 text-lcd-ink/60 hover:bg-lcd-ink/10'
      : 'border-border text-ash-500 hover:text-bone hover:bg-white/[0.03]';

  return (
    <div className={clsx('flex items-center gap-2', className)} role="group" aria-label={t('language.label')}>
      <span className={labelCls}>{t('language.label')}</span>
      <div className={clsx('flex items-center', variant === 'admin' ? 'gap-0' : 'gap-0.5')}>
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => void setAppLanguage(opt.value)}
            className={clsx(btnBase, current === opt.value ? activeCls : idleCls)}
            aria-pressed={current === opt.value}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
