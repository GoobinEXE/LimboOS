import { enUS, ptBR } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import { useTranslation } from 'react-i18next';
import i18n from './index';

export function getDateFnsLocale(lng?: string): Locale {
  const lang = (lng ?? i18n.language ?? 'pt-BR').toLowerCase();
  return lang.startsWith('en') ? enUS : ptBR;
}

export function getIntlLocale(lng?: string): string {
  const lang = (lng ?? i18n.language ?? 'pt-BR').toLowerCase();
  return lang.startsWith('en') ? 'en-US' : 'pt-BR';
}

export function useDateLocale(): Locale {
  const { i18n: i18nInstance } = useTranslation();
  return getDateFnsLocale(i18nInstance.language);
}

export function useIntlLocale(): string {
  const { i18n: i18nInstance } = useTranslation();
  return getIntlLocale(i18nInstance.language);
}
