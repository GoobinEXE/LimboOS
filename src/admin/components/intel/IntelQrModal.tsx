import React from 'react';
import QRCode from 'react-qr-code';
import type { IntelItem } from '../../../types/intel';
import OverlayPortal from '../OverlayPortal';

interface IntelQrModalProps {
  item: IntelItem | null;
  onClose: () => void;
  onFeedback: (fb: { type: 'success' | 'error'; text: string }) => void;
}

export default function IntelQrModal({ item, onClose, onFeedback }: IntelQrModalProps) {
  const getQrCodeSvgDataUri = () => {
    const container = document.getElementById('qr-code-container-intel');
    if (!container) return null;
    const svgElement = container.querySelector('svg');
    if (!svgElement) return null;
    const svgData = new XMLSerializer().serializeToString(svgElement);
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handleDownloadQrCode = () => {
    const dataUri = getQrCodeSvgDataUri();
    if (!dataUri) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const padding = 20;
      canvas.width = img.width + padding * 2;
      canvas.height = img.height + padding * 2;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, padding, padding);
        const pngFile = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.download = `qrcode_${item?.id || 'intel'}.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
      }
    };
    img.src = dataUri;
  };

  const handleCopyQrCode = () => {
    const dataUri = getQrCodeSvgDataUri();
    if (!dataUri) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const padding = 20;
      canvas.width = img.width + padding * 2;
      canvas.height = img.height + padding * 2;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, padding, padding);
        canvas.toBlob(async (blob) => {
          if (blob) {
            try {
              await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
              onFeedback({ type: 'success', text: '✓ QR Code copiado para a área de transferência!' });
            } catch (err) {
              console.error('Failed to copy', err);
              onFeedback({ type: 'error', text: 'Falha ao copiar QR Code. Verifique as permissões.' });
            }
          }
        }, 'image/png');
      }
    };
    img.src = dataUri;
  };

  return (
    <OverlayPortal open={!!item} onClose={onClose}>
      {item && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 p-4 backdrop-blur-md">
          <div className="bg-surface-container-low border border-primary/30 p-8 w-full max-w-sm rounded-sm shadow-2xl flex flex-col items-center relative">
            <div className="absolute -top-3 left-6 bg-primary px-2 py-0.5 text-[10px] font-display font-bold text-black tracking-widest uppercase">
              ASSINATURA-DIGITAL-INTEL
            </div>
            <h3 className="font-display font-bold text-xl mb-2 text-white uppercase tracking-widest text-center mt-2">
              Gerar QR desta <span className="text-primary">Intel</span>
            </h3>
            <p className="text-[9px] font-display font-bold text-industrial-silver/40 uppercase tracking-widest text-center mb-6">
              Valor = ID da intel · Para mapear QR físico errado → Sistema → QR & Links
            </p>
            <div id="qr-code-container-intel" className="bg-white p-6 rounded-sm mb-8 shadow-inner ring-4 ring-primary/20">
              <QRCode value={item.id} size={200} />
            </div>
            <div className="w-full bg-black/40 p-3 rounded-sm border border-primary/10 mb-8 text-center">
              <p className="text-[9px] font-display font-bold text-industrial-silver/40 uppercase tracking-[0.2em] mb-1">
                Identificador Único
              </p>
              <p className="font-mono text-[10px] text-primary tracking-widest break-all font-bold">{item.id}</p>
            </div>
            <div className="flex gap-3 mb-6 w-full">
              <button
                type="button"
                onClick={handleCopyQrCode}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-[10px] font-display font-bold border border-primary/20 text-industrial-silver/60 hover:text-primary hover:bg-primary/5 transition-all rounded-sm uppercase tracking-widest"
              >
                <span className="material-symbols-outlined text-base">content_copy</span>
                Copiar
              </button>
              <button
                type="button"
                onClick={handleDownloadQrCode}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-[10px] font-display font-bold border border-primary/20 text-industrial-silver/60 hover:text-primary hover:bg-primary/5 transition-all rounded-sm uppercase tracking-widest"
              >
                <span className="material-symbols-outlined text-base">download</span>
                Salvar
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-10 py-4 text-[11px] font-display font-bold text-industrial-silver/40 hover:text-white transition-all w-full border-t border-primary/5 uppercase tracking-[0.3em]"
            >
              Fechar Terminal
            </button>
          </div>
        </div>
      )}
    </OverlayPortal>
  );
}
