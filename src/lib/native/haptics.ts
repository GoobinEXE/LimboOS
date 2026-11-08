import { isNative } from './platform';

/**
 * Feedback tátil único para web e app nativo.
 * O iOS ignora navigator.vibrate; no app usamos o Taptic Engine via @capacitor/haptics.
 */
export type HapticKind = 'light' | 'medium' | 'heavy' | 'double';

const WEB_PATTERNS: Record<HapticKind, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 50,
  double: [50, 30, 50],
};

type HapticsModule = typeof import('@capacitor/haptics');
let hapticsModule: Promise<HapticsModule> | null = null;

function loadHaptics(): Promise<HapticsModule> {
  hapticsModule ??= import('@capacitor/haptics');
  return hapticsModule;
}

async function nativeHaptic(kind: HapticKind): Promise<void> {
  const { Haptics, ImpactStyle } = await loadHaptics();
  if (kind === 'double') {
    await Haptics.impact({ style: ImpactStyle.Heavy });
    await new Promise((resolve) => setTimeout(resolve, 80));
    await Haptics.impact({ style: ImpactStyle.Heavy });
    return;
  }
  const style = kind === 'light' ? ImpactStyle.Light : kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Heavy;
  await Haptics.impact({ style });
}

export function haptic(kind: HapticKind = 'light'): void {
  if (isNative()) {
    void nativeHaptic(kind).catch(() => {});
    return;
  }
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(WEB_PATTERNS[kind]);
  } catch {
    // Alguns navegadores bloqueiam vibrate sem gesto do usuário.
  }
}
