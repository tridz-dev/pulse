import { useEffect, useState } from 'react';
import { Loader2, Scan, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OCROverlayProps {
  isDetecting: boolean;
  isDocumentDetected: boolean;
  focusLevel: number;
  isProcessing?: boolean;
  showCorners?: boolean;
  showGuides?: boolean;
}

export function OCROverlay({
  isDetecting,
  isDocumentDetected,
  focusLevel,
  isProcessing = false,
  showCorners = true,
  showGuides = true,
}: OCROverlayProps) {
  const [cornerPositions, setCornerPositions] = useState({
    tl: { x: 20, y: 25 },
    tr: { x: 80, y: 25 },
    bl: { x: 20, y: 75 },
    br: { x: 80, y: 75 },
  });

  // Animate corners when document is detected
  useEffect(() => {
    if (isDocumentDetected) {
      // Corners snap to detected document position
      setCornerPositions({
        tl: { x: 15, y: 20 },
        tr: { x: 85, y: 20 },
        bl: { x: 15, y: 80 },
        br: { x: 85, y: 80 },
      });
    } else {
      // Reset to default
      setCornerPositions({
        tl: { x: 20, y: 25 },
        tr: { x: 80, y: 25 },
        bl: { x: 20, y: 75 },
        br: { x: 80, y: 75 },
      });
    }
  }, [isDocumentDetected]);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Dark overlay outside document area */}
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <mask id="document-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={`${cornerPositions.tl.x}%`}
              y={`${cornerPositions.tl.y}%`}
              width={`${cornerPositions.tr.x - cornerPositions.tl.x}%`}
              height={`${cornerPositions.bl.y - cornerPositions.tl.y}%`}
              fill="black"
              rx="8"
            />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.5)"
          mask="url(#document-mask)"
        />
      </svg>

      {/* Document frame corners */}
      {showCorners && (
        <>
          {/* Top-left corner */}
          <div
            className={cn(
              "absolute w-12 h-12 border-l-4 border-t-4 transition-all duration-300",
              isDocumentDetected
                ? "border-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)]"
                : "border-white/70"
            )}
            style={{
              left: `${cornerPositions.tl.x}%`,
              top: `${cornerPositions.tl.y}%`,
              transform: 'translate(-2px, -2px)',
            }}
          />
          {/* Top-right corner */}
          <div
            className={cn(
              "absolute w-12 h-12 border-r-4 border-t-4 transition-all duration-300",
              isDocumentDetected
                ? "border-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)]"
                : "border-white/70"
            )}
            style={{
              right: `${100 - cornerPositions.tr.x}%`,
              top: `${cornerPositions.tr.y}%`,
              transform: 'translate(2px, -2px)',
            }}
          />
          {/* Bottom-left corner */}
          <div
            className={cn(
              "absolute w-12 h-12 border-l-4 border-b-4 transition-all duration-300",
              isDocumentDetected
                ? "border-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)]"
                : "border-white/70"
            )}
            style={{
              left: `${cornerPositions.bl.x}%`,
              bottom: `${100 - cornerPositions.bl.y}%`,
              transform: 'translate(-2px, 2px)',
            }}
          />
          {/* Bottom-right corner */}
          <div
            className={cn(
              "absolute w-12 h-12 border-r-4 border-b-4 transition-all duration-300",
              isDocumentDetected
                ? "border-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)]"
                : "border-white/70"
            )}
            style={{
              right: `${100 - cornerPositions.br.x}%`,
              bottom: `${100 - cornerPositions.br.y}%`,
              transform: 'translate(2px, 2px)',
            }}
          />
        </>
      )}

      {/* Focus guide lines */}
      {showGuides && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className={cn(
              "absolute w-px h-full transition-opacity duration-300",
              isDocumentDetected ? "bg-green-400/30" : "bg-white/20"
            )}
          />
          <div
            className={cn(
              "absolute h-px w-full transition-opacity duration-300",
              isDocumentDetected ? "bg-green-400/30" : "bg-white/20"
            )}
          />
        </div>
      )}

      {/* Focus indicator */}
      <div className="absolute bottom-32 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
        {/* Focus meter */}
        <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5">
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 text-indigo-400 animate-spin" />
              <span className="text-xs text-white">Processing...</span>
            </>
          ) : isDocumentDetected ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              <span className="text-xs text-white">Document ready</span>
            </>
          ) : (
            <>
              <Scan className="h-4 w-4 text-zinc-400" />
              <span className="text-xs text-zinc-300">Align document</span>
            </>
          )}
        </div>

        {/* Focus bar */}
        {!isProcessing && (
          <div className="w-32 h-1 bg-zinc-700 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-300",
                focusLevel > 70
                  ? "bg-green-400"
                  : focusLevel > 40
                  ? "bg-yellow-400"
                  : "bg-red-400"
              )}
              style={{ width: `${focusLevel}%` }}
            />
          </div>
        )}
      </div>

      {/* Document type hint */}
      {isDocumentDetected && !isProcessing && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-green-500/20 text-green-400 px-4 py-2 rounded-full text-sm backdrop-blur-sm animate-in fade-in slide-in-from-top-2">
          Hold steady...
        </div>
      )}

      {/* Scanning animation */}
      {isDetecting && (
        <div className="absolute inset-x-0 top-0 h-0.5">
          <div className="h-full bg-gradient-to-r from-transparent via-indigo-400 to-transparent animate-scan" />
        </div>
      )}
    </div>
  );
}

// CSS animation for scanning line
const scanAnimation = `
@keyframes scan {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.animate-scan {
  animation: scan 2s linear infinite;
}
`;

// Add animation styles to document if not already present
if (typeof document !== 'undefined') {
  const styleId = 'ocr-overlay-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = scanAnimation;
    document.head.appendChild(style);
  }
}

export default OCROverlay;
