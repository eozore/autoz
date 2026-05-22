import { useState, useEffect, useRef, useCallback } from 'react';

interface ImagePreviewCropProps {
  /** The selected image file */
  file: File | null;
  /** Aspect ratio for the crop (width / height). Default is 1 (square) */
  aspectRatio?: number;
  /** Size of the preview in pixels */
  previewSize?: number;
  /** Callback with the cropped blob when ready */
  onCropped?: (blob: Blob) => void;
}

/**
 * ImagePreviewCrop displays a preview of a selected image file
 * and auto-crops it to the specified aspect ratio (default 1:1 square)
 * using a center-crop approach on a canvas element.
 */
export function ImagePreviewCrop({
  file,
  aspectRatio = 1,
  previewSize = 200,
  onCropped,
}: ImagePreviewCropProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const cropImage = useCallback(
    (img: HTMLImageElement): string | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const outputSize = previewSize;
      canvas.width = outputSize;
      canvas.height = outputSize / aspectRatio;

      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      // Calculate center-crop dimensions
      const imgAspect = img.width / img.height;
      const targetAspect = aspectRatio;

      let srcX = 0;
      let srcY = 0;
      let srcW = img.width;
      let srcH = img.height;

      if (imgAspect > targetAspect) {
        // Image is wider than target — crop sides
        srcW = img.height * targetAspect;
        srcX = (img.width - srcW) / 2;
      } else {
        // Image is taller than target — crop top/bottom
        srcH = img.width / targetAspect;
        srcY = (img.height - srcH) / 2;
      }

      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);

      return canvas.toDataURL('image/jpeg', 0.9);
    },
    [aspectRatio, previewSize]
  );

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    setLoading(true);
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const croppedDataUrl = cropImage(img);
      setPreviewUrl(croppedDataUrl);
      setLoading(false);

      // Convert to blob and notify parent
      if (croppedDataUrl && onCropped) {
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.toBlob(
            (blob) => {
              if (blob) onCropped(blob);
            },
            'image/jpeg',
            0.9
          );
        }
      }

      URL.revokeObjectURL(objectUrl);
    };

    img.onerror = () => {
      setPreviewUrl(null);
      setLoading(false);
      URL.revokeObjectURL(objectUrl);
    };

    img.src = objectUrl;

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file, cropImage, onCropped]);

  if (!file) return null;

  return (
    <div style={containerStyle}>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      {loading && <p style={loadingStyle}>Processando imagem...</p>}
      {previewUrl && !loading && (
        <div style={previewContainerStyle}>
          <p style={labelStyle}>Pré-visualização (recortada 1:1)</p>
          <img
            src={previewUrl}
            alt="Pré-visualização do serviço"
            style={{
              width: previewSize,
              height: previewSize / aspectRatio,
              borderRadius: 'var(--ds-radius-md, 8px)',
              objectFit: 'cover',
              border: '1px solid var(--ds-color-border-base, #e2e8f0)',
            }}
          />
        </div>
      )}
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  marginTop: '0.5rem',
};

const previewContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  alignItems: 'flex-start',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: 'var(--ds-color-text-muted, #64748b)',
  margin: 0,
};

const loadingStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: 'var(--ds-color-text-muted, #64748b)',
  margin: 0,
};
