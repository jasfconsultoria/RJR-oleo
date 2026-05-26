export const SIGNATURE_CANVAS_CLASS = 'w-full h-48 sm:h-[180px] rounded-md bg-white touch-none';

export const SIGNATURE_CANVAS_WRAPPER_CLASS = 'mx-auto w-full max-w-[520px]';

export const resizeSignatureCanvasToDisplaySize = (signatureCanvasRef) => {
  const signatureCanvas = signatureCanvasRef.current;
  const canvas = signatureCanvas?.getCanvas?.();
  if (!canvas) return;

  const width = canvas.offsetWidth;
  const height = canvas.offsetHeight;
  if (!width || !height) return;

  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  const nextWidth = Math.round(width * ratio);
  const nextHeight = Math.round(height * ratio);

  if (canvas.width === nextWidth && canvas.height === nextHeight) return;

  canvas.width = nextWidth;
  canvas.height = nextHeight;
  canvas.getContext('2d').scale(ratio, ratio);
  signatureCanvas.clear();
};
