import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import NimiqQrScanner from 'qr-scanner';
import qrScannerWorkerPath from 'qr-scanner/qr-scanner-worker.min.js?url';

NimiqQrScanner.WORKER_PATH = qrScannerWorkerPath;

interface QrScannerProps {
  onDetected: (code: string) => void;
  onCancel: () => void;
}

function calculateScanRegion(video: HTMLVideoElement): NimiqQrScanner.ScanRegion {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) {
    return {
      x: 0,
      y: 0,
      width: 400,
      height: 400,
      downScaledWidth: 400,
      downScaledHeight: 400,
    };
  }
  const side = Math.round(0.92 * Math.min(w, h));
  const x = Math.round((w - side) / 2);
  const y = Math.round((h - side) / 2);
  const down = Math.min(900, side);
  return {
    x,
    y,
    width: side,
    height: side,
    downScaledWidth: down,
    downScaledHeight: down,
  };
}

function cameraErrorMessage(err: unknown, t: (key: string) => string): string {
  const name = err instanceof Error ? err.name : '';
  const msg = err instanceof Error ? err.message : String(err ?? '');
  if (
    name === 'NotAllowedError' ||
    name === 'PermissionDeniedError' ||
    /permission|notallowed|denied/i.test(msg)
  ) {
    return t('qr.cameraDenied');
  }
  if (
    name === 'NotFoundError' ||
    name === 'DevicesNotFoundError' ||
    /no camera|notfound|requested device/i.test(msg)
  ) {
    return t('qr.cameraMissing');
  }
  if (!window.isSecureContext) {
    return t('qr.cameraInsecure');
  }
  return t('qr.cameraFailed');
}

export default function QrScanner({ onDetected, onCancel }: QrScannerProps) {
  const { t } = useTranslation('player');
  const onDetectedRef = useRef(onDetected);
  const onCancelRef = useRef(onCancel);
  onDetectedRef.current = onDetected;
  onCancelRef.current = onCancel;
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<NimiqQrScanner | null>(null);
  const detectedRef = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scanBoxSize, setScanBoxSize] = useState(200);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr?.width || !cr?.height) return;
      const m = Math.min(cr.width, cr.height);
      setScanBoxSize(Math.max(120, Math.floor(m * 0.82)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    detectedRef.current = false;
    setError(null);

    // Safari iOS: atributos explícitos além do que a lib já seta
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.muted = true;
    video.playsInline = true;

    const scanner = new NimiqQrScanner(
      video,
      (result) => {
        if (detectedRef.current) return;
        detectedRef.current = true;
        const code = result.data;
        scannerRef.current?.destroy();
        scannerRef.current = null;
        onDetectedRef.current(code);
      },
      {
        returnDetailedScanResult: true,
        preferredCamera: 'environment',
        maxScansPerSecond: 8,
        calculateScanRegion,
        onDecodeError: () => {},
      }
    );
    scannerRef.current = scanner;
    scanner
      .start()
      .then(() => {
        if (cancelled) {
          scanner.destroy();
          scannerRef.current = null;
        }
      })
      .catch((err) => {
        console.error('QR scanner failed to start:', err);
        scannerRef.current = null;
        if (!cancelled) {
          setError(cameraErrorMessage(err, t));
        }
      });
    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        try {
          s.destroy();
        } catch {
          // ignore
        }
      }
    };
  }, [retryToken, t]);

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        borderRadius: 'var(--radius-card, 12px)',
        background: '#000',
      }}
    >
      <style>{`
        .qr-scanner-video {
          position: absolute !important;
          inset: 0 !important;
          z-index: 2 !important;
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
        }
      `}</style>
      <video
        ref={videoRef}
        className="qr-scanner-video"
        muted
        playsInline
        autoPlay
      />
      {error ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 20,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: 16,
            background: 'rgba(0,0,0,0.85)',
            textAlign: 'center',
          }}
        >
          <p className="text-accent text-[11px] font-bold uppercase tracking-widest leading-relaxed">
            {error}
          </p>
          <button
            type="button"
            onClick={() => setRetryToken((n) => n + 1)}
            className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest rounded-sm border border-border-accent text-accent hover:bg-accent/10"
          >
            {t('qr.retry')}
          </button>
        </div>
      ) : (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            background: 'rgba(0,0,0,0.3)',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: `${scanBoxSize}px`,
              height: `${scanBoxSize}px`,
              boxShadow: '0 0 0 4000px rgba(0, 0, 0, 0.4)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '30px',
                height: '30px',
                borderTop: '4px solid var(--color-accent, #ff8c00)',
                borderLeft: '4px solid var(--color-accent, #ff8c00)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: '30px',
                height: '30px',
                borderTop: '4px solid var(--color-accent, #ff8c00)',
                borderRight: '4px solid var(--color-accent, #ff8c00)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                width: '30px',
                height: '30px',
                borderBottom: '4px solid var(--color-accent, #ff8c00)',
                borderLeft: '4px solid var(--color-accent, #ff8c00)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: '30px',
                height: '30px',
                borderBottom: '4px solid var(--color-accent, #ff8c00)',
                borderRight: '4px solid var(--color-accent, #ff8c00)',
              }}
            />
            <motion.div
              animate={{ y: [0, scanBoxSize - 2, 0] }}
              transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
              style={{
                position: 'absolute',
                left: 4,
                right: 4,
                height: '2px',
                background: 'var(--color-accent, #ff8c00)',
                boxShadow: '0 0 12px rgba(255, 140, 0, 0.8)',
                top: 0,
              }}
            />
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={onCancel}
        aria-label={t('qr.cancelAria')}
        className="absolute bottom-5 right-5 w-10 h-10 z-30 flex items-center justify-center rounded-full cursor-pointer bg-black/60 border border-border-strong backdrop-blur-md text-white transition-colors duration-150 hover:border-border-accent hover:text-accent active:bg-black/80"
      >
        <X size={24} />
      </button>
    </div>
  );
}
