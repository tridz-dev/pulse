import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Upload, X, RotateCcw, ScanLine, Focus } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { toast } from 'sonner';
import { OCROverlay } from './OCROverlay';

interface DocumentScannerProps {
  onCapture: (imageData: string) => void;
  onCancel: () => void;
  autoCapture?: boolean;
  preferredCamera?: 'environment' | 'user';
}

export function DocumentScanner({
  onCapture,
  onCancel,
  autoCapture = true,
  preferredCamera = 'environment',
}: DocumentScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  
  const [isStreaming, setIsStreaming] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isDocumentDetected, setIsDocumentDetected] = useState(false);
  const [focusLevel, setFocusLevel] = useState(0);
  const [isAutoCapturing, setIsAutoCapturing] = useState(false);

  // Initialize camera
  const startCamera = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: preferredCamera,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsStreaming(true);
        setHasPermission(true);
        
        // Start document detection
        if (autoCapture) {
          startDocumentDetection();
        }
      }
    } catch (error) {
      console.error('Camera access denied:', error);
      setHasPermission(false);
      toast.error('Camera access denied. Please upload an image instead.');
    }
  }, [preferredCamera, autoCapture]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setIsStreaming(false);
    setIsDocumentDetected(false);
    setFocusLevel(0);
  }, []);

  // Simple document detection using edge detection simulation
  const detectDocument = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !isStreaming) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    if (!ctx) return;

    // Set canvas to video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get image data for analysis
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Simple edge detection and contrast analysis
    let edgeCount = 0;
    let contrastSum = 0;
    const sampleStep = 10; // Sample every 10th pixel for performance

    for (let y = 0; y < canvas.height; y += sampleStep) {
      for (let x = 0; x < canvas.width; x += sampleStep) {
        const idx = (y * canvas.width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // Convert to grayscale
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;

        // Check contrast with neighboring pixel
        if (x + sampleStep < canvas.width) {
          const nextIdx = (y * canvas.width + x + sampleStep) * 4;
          const nextGray = 0.299 * data[nextIdx] + 0.587 * data[nextIdx + 1] + 0.114 * data[nextIdx + 2];
          const diff = Math.abs(gray - nextGray);
          if (diff > 30) edgeCount++;
          contrastSum += diff;
        }
      }
    }

    const totalSamples = (canvas.width / sampleStep) * (canvas.height / sampleStep);
    const edgeRatio = edgeCount / totalSamples;
    const avgContrast = contrastSum / totalSamples;

    // Document detected if we have good edges and contrast
    const detected = edgeRatio > 0.05 && avgContrast > 20;
    const focus = Math.min(100, (edgeRatio * 1000 + avgContrast) / 2);

    setIsDocumentDetected(detected);
    setFocusLevel(Math.round(focus));

    // Auto-capture if document is well-positioned
    if (detected && focus > 70 && autoCapture && !isAutoCapturing && !capturedImage) {
      setIsAutoCapturing(true);
      setTimeout(() => {
        captureImage();
        setIsAutoCapturing(false);
      }, 500);
    }
  }, [isStreaming, autoCapture, isAutoCapturing, capturedImage]);

  // Start document detection loop
  const startDocumentDetection = useCallback(() => {
    const detect = () => {
      detectDocument();
      animationRef.current = requestAnimationFrame(detect);
    };
    animationRef.current = requestAnimationFrame(detect);
  }, [detectDocument]);

  // Capture image from video
  const captureImage = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to data URL with good quality
    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(imageData);
    stopCamera();
  }, [stopCamera]);

  // Handle file upload
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setCapturedImage(result);
    };
    reader.readAsDataURL(file);
  }, []);

  // Retake photo
  const handleRetake = useCallback(() => {
    setCapturedImage(null);
    startCamera();
  }, [startCamera]);

  // Confirm capture
  const handleConfirm = useCallback(() => {
    if (capturedImage) {
      onCapture(capturedImage);
    }
  }, [capturedImage, onCapture]);

  // Initialize on mount
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-zinc-900">
        <h2 className="text-lg font-semibold text-white">Document Scanner</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onCancel}
          className="text-zinc-400 hover:text-white"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Main content */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {!capturedImage ? (
          <>
            {/* Camera feed */}
            {hasPermission !== false ? (
              <>
                <video
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-cover"
                  playsInline
                  muted
                />
                <canvas
                  ref={canvasRef}
                  className="hidden"
                />
                
                {/* Document detection overlay */}
                <OCROverlay
                  isDetecting={isStreaming}
                  isDocumentDetected={isDocumentDetected}
                  focusLevel={focusLevel}
                  isProcessing={isAutoCapturing}
                />

                {/* Upload fallback button */}
                <div className="absolute bottom-24 left-4">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-zinc-800/80 backdrop-blur-sm"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>
              </>
            ) : (
              /* Upload only view when no camera permission */
              <div className="text-center p-8">
                <Camera className="h-16 w-16 text-zinc-600 mx-auto mb-4" />
                <p className="text-zinc-400 mb-4">Camera access not available</p>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Document
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
            )}
          </>
        ) : (
          /* Preview captured image */
          <div className="relative w-full h-full">
            <img
              src={capturedImage}
              alt="Captured document"
              className="w-full h-full object-contain bg-black"
            />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-6 bg-zinc-900 flex items-center justify-center gap-4">
        {!capturedImage ? (
          /* Capture controls */
          <>
            <Button
              size="lg"
              className="rounded-full w-16 h-16 bg-white hover:bg-zinc-200 text-black"
              onClick={captureImage}
              disabled={!isStreaming}
            >
              <ScanLine className="h-6 w-6" />
            </Button>
            {isDocumentDetected && (
              <div className="absolute bottom-20 bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm flex items-center gap-1">
                <Focus className="h-3 w-3" />
                Document detected
              </div>
            )}
          </>
        ) : (
          /* Preview controls */
          <>
            <Button
              variant="outline"
              size="lg"
              onClick={handleRetake}
              className="border-zinc-700 text-zinc-300"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Retake
            </Button>
            <Button
              size="lg"
              onClick={handleConfirm}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              Use This Photo
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export default DocumentScanner;
