import { useState, useCallback, useRef } from 'react';
import { createWorker, type Worker } from 'tesseract.js';
import { toast } from 'sonner';

export interface OCRResult {
  text: string;
  confidence: number;
  words: Array<{
    text: string;
    confidence: number;
    bbox: {
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    };
  }>;
}

export interface ExtractedField {
  name: string;
  value: string;
  confidence: number;
  type: 'text' | 'date' | 'number' | 'array' | 'boolean';
}

export interface OCRTemplate {
  name: string;
  fields: Array<{
    name: string;
    type: 'text' | 'date' | 'number' | 'array' | 'boolean';
    patterns: string[];
    required?: boolean;
  }>;
}

interface UseOCRReturn {
  isProcessing: boolean;
  isInitializing: boolean;
  progress: number;
  scanDocument: (imageData: string | Blob) => Promise<OCRResult | null>;
  extractText: (imageData: string | Blob) => Promise<string>;
  extractFormData: (
    imageData: string | Blob,
    template?: OCRTemplate
  ) => Promise<ExtractedField[]>;
  reset: () => void;
}

export function useOCR(): UseOCRReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [progress, setProgress] = useState(0);
  const workerRef = useRef<Worker | null>(null);
  const initPromiseRef = useRef<Promise<void> | null>(null);

  const initializeWorker = useCallback(async (): Promise<void> => {
    if (workerRef.current) return;
    
    if (initPromiseRef.current) {
      return initPromiseRef.current;
    }

    initPromiseRef.current = (async () => {
      setIsInitializing(true);
      try {
        const worker = await createWorker('eng', 1, {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              setProgress(Math.round(m.progress * 100));
            }
          },
        });
        workerRef.current = worker;
      } catch (error) {
        console.error('Failed to initialize Tesseract worker:', error);
        toast.error('Failed to initialize OCR engine');
        throw error;
      } finally {
        setIsInitializing(false);
      }
    })();

    return initPromiseRef.current;
  }, []);

  const scanDocument = useCallback(async (
    imageData: string | Blob
  ): Promise<OCRResult | null> => {
    setIsProcessing(true);
    setProgress(0);

    try {
      await initializeWorker();
      
      if (!workerRef.current) {
        throw new Error('OCR worker not initialized');
      }

      const imageUrl = typeof imageData === 'string' 
        ? imageData 
        : URL.createObjectURL(imageData);

      const result = await workerRef.current.recognize(imageUrl);

      if (typeof imageData !== 'string') {
        URL.revokeObjectURL(imageUrl);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyResult = result.data as any;
      return {
        text: result.data.text,
        confidence: result.data.confidence,
        words: (anyResult.words || []).map((w: { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } }) => ({
          text: w.text,
          confidence: w.confidence,
          bbox: w.bbox,
        })),
      };
    } catch (error) {
      console.error('OCR scan failed:', error);
      toast.error('Failed to scan document');
      return null;
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  }, [initializeWorker]);

  const extractText = useCallback(async (
    imageData: string | Blob
  ): Promise<string> => {
    const result = await scanDocument(imageData);
    return result?.text || '';
  }, [scanDocument]);

  const extractFormData = useCallback(async (
    imageData: string | Blob,
    template?: OCRTemplate
  ): Promise<ExtractedField[]> => {
    const result = await scanDocument(imageData);
    if (!result) return [];

    const extractedFields: ExtractedField[] = [];
    const text = result.text;

    if (template) {
      // Use template patterns to extract fields
      for (const field of template.fields) {
        for (const pattern of field.patterns) {
          const regex = new RegExp(
            `${pattern}\\s*[:=]?\\s*([^\\n]+)`,
            'i'
          );
          const match = text.match(regex);
          
          if (match) {
            let value = match[1].trim();
            let confidence = result.confidence;

            // Parse based on field type
            if (field.type === 'date') {
              const dateMatch = value.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
              if (dateMatch) {
                value = `${dateMatch[3].length === 2 ? '20' + dateMatch[3] : dateMatch[3]}-${dateMatch[1].padStart(2, '0')}-${dateMatch[2].padStart(2, '0')}`;
              }
            } else if (field.type === 'boolean') {
              const checked = /\[[x✓✔]\]/i.test(value) || /yes|true/i.test(value);
              value = checked ? 'true' : 'false';
            } else if (field.type === 'array') {
              // Extract array items (comma-separated or list format)
              value = value.split(/,|\n/).map(v => v.trim()).filter(Boolean).join(', ');
            }

            extractedFields.push({
              name: field.name,
              value,
              confidence,
              type: field.type,
            });
            break;
          }
        }
      }
    } else {
      // No template - extract common patterns
      const commonPatterns = [
        { name: 'date', regex: /(?:date|Date|DATE)[\s:]*([\d\/\-\.]+)/i, type: 'date' as const },
        { name: 'name', regex: /(?:name|Name|employee|Employee)[\s:]*([^\n]+)/i, type: 'text' as const },
        { name: 'location', regex: /(?:location|branch|Branch|site)[\s:]*([^\n]+)/i, type: 'text' as const },
        { name: 'id', regex: /(?:id|ID|number|#)[\s:]*(\w+)/i, type: 'text' as const },
      ];

      for (const pattern of commonPatterns) {
        const match = text.match(pattern.regex);
        if (match) {
          extractedFields.push({
            name: pattern.name,
            value: match[1].trim(),
            confidence: result.confidence,
            type: pattern.type,
          });
        }
      }

      // Extract checklist items (items with [ ], [x], [✓])
      const checklistItems = text.match(/^\s*[\[\(]\s*[x✓✔\s]?\s*[\]\)]\s*(.+)$/gm);
      if (checklistItems) {
        const completedItems: string[] = [];
        checklistItems.forEach((item) => {
          const isChecked = /\[[x✓✔]\]/i.test(item);
          const itemText = item.replace(/^\s*[\[\(]\s*[x✓✔\s]?\s*[\]\)]\s*/, '').trim();
          if (isChecked) {
            completedItems.push(itemText);
          }
        });
        
        extractedFields.push({
          name: 'completed_items',
          value: completedItems.join(', '),
          confidence: result.confidence,
          type: 'array',
        });
      }
    }

    return extractedFields;
  }, [scanDocument]);

  const reset = useCallback(() => {
    setIsProcessing(false);
    setIsInitializing(false);
    setProgress(0);
  }, []);

  return {
    isProcessing,
    isInitializing,
    progress,
    scanDocument,
    extractText,
    extractFormData,
    reset,
  };
}

export default useOCR;
