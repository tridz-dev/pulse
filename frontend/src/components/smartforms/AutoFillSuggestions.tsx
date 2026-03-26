import { useState } from 'react';
import { Check, X, Sparkles, ChevronRight, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface FieldSuggestion {
  fieldId: string;
  fieldName: string;
  suggestedValue: string;
  confidence: number;
  source: 'ocr' | 'ai' | 'history';
  reason?: string;
}

interface AutoFillSuggestionsProps {
  suggestions: FieldSuggestion[];
  onApply: (fieldId: string, value: string) => void;
  onApplyAll: () => void;
  onDismiss: (fieldId: string) => void;
  onDismissAll: () => void;
  className?: string;
}

export function AutoFillSuggestions({
  suggestions,
  onApply,
  onApplyAll,
  onDismiss,
  onDismissAll,
  className,
}: AutoFillSuggestionsProps) {
  const [expandedField, setExpandedField] = useState<string | null>(null);

  if (suggestions.length === 0) return null;

  const highConfidenceCount = suggestions.filter((s) => s.confidence >= 80).length;
  const avgConfidence = Math.round(
    suggestions.reduce((sum, s) => sum + s.confidence, 0) / suggestions.length
  );

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'bg-green-500/20 text-green-400 border-green-500/30';
    if (confidence >= 60) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    return 'bg-red-500/20 text-red-400 border-red-500/30';
  };

  const getSourceIcon = (source: FieldSuggestion['source']) => {
    switch (source) {
      case 'ocr':
        return '📄';
      case 'ai':
        return '🤖';
      case 'history':
        return '📜';
      default:
        return '✨';
    }
  };

  const getSourceLabel = (source: FieldSuggestion['source']) => {
    switch (source) {
      case 'ocr':
        return 'Scanned';
      case 'ai':
        return 'AI Predicted';
      case 'history':
        return 'From History';
      default:
        return 'Suggested';
    }
  };

  return (
    <Card className={cn('border-indigo-500/30 bg-indigo-950/10', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-400" />
            <CardTitle className="text-base text-white">
              AI Suggestions
            </CardTitle>
            <Badge
              variant="outline"
              className={cn(
                'text-xs',
                avgConfidence >= 80
                  ? 'border-green-500/30 text-green-400'
                  : 'border-yellow-500/30 text-yellow-400'
              )}
            >
              {avgConfidence}% avg confidence
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismissAll}
              className="h-8 text-zinc-400 hover:text-white"
            >
              <X className="h-4 w-4 mr-1" />
              Ignore All
            </Button>
            <Button
              size="sm"
              onClick={onApplyAll}
              className="h-8 bg-indigo-600 hover:bg-indigo-700"
            >
              <Check className="h-4 w-4 mr-1" />
              Accept All ({suggestions.length})
            </Button>
          </div>
        </div>
        <p className="text-xs text-zinc-400">
          {highConfidenceCount} high-confidence suggestions found
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {suggestions.map((suggestion) => (
          <div
            key={suggestion.fieldId}
            className={cn(
              'group relative rounded-lg border transition-all duration-200',
              'hover:border-indigo-500/50',
              expandedField === suggestion.fieldId
                ? 'bg-zinc-900/80 border-indigo-500/30'
                : 'bg-zinc-900/40 border-zinc-800'
            )}
          >
            <div
              className="flex items-center gap-3 p-3 cursor-pointer"
              onClick={() =>
                setExpandedField(
                  expandedField === suggestion.fieldId ? null : suggestion.fieldId
                )
              }
            >
              {/* Confidence indicator */}
              <div
                className={cn(
                  'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xs font-medium border',
                  getConfidenceColor(suggestion.confidence)
                )}
              >
                {suggestion.confidence}%
              </div>

              {/* Field info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-200">
                    {suggestion.fieldName}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {getSourceIcon(suggestion.source)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm text-zinc-400 truncate">
                    {suggestion.suggestedValue || '(empty)'}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-zinc-400 hover:text-red-400"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDismiss(suggestion.fieldId);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-zinc-400 hover:text-green-400"
                  onClick={(e) => {
                    e.stopPropagation();
                    onApply(suggestion.fieldId, suggestion.suggestedValue);
                  }}
                >
                  <Check className="h-4 w-4" />
                </Button>
              </div>

              <ChevronRight
                className={cn(
                  'h-4 w-4 text-zinc-600 transition-transform',
                  expandedField === suggestion.fieldId && 'rotate-90'
                )}
              />
            </div>

            {/* Expanded details */}
            {expandedField === suggestion.fieldId && (
              <div className="px-3 pb-3 pt-0 border-t border-zinc-800">
                <div className="pt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {getSourceLabel(suggestion.source)}
                    </Badge>
                    {suggestion.reason && (
                      <span className="text-xs text-zinc-400">
                        {suggestion.reason}
                      </span>
                    )}
                  </div>

                  {suggestion.confidence < 60 && (
                    <div className="flex items-center gap-2 text-amber-400 text-xs">
                      <AlertCircle className="h-3 w-3" />
                      <span>Low confidence - please verify this value</span>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 border-zinc-700"
                      onClick={() => onDismiss(suggestion.fieldId)}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Ignore
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                      onClick={() =>
                        onApply(suggestion.fieldId, suggestion.suggestedValue)
                      }
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Apply
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default AutoFillSuggestions;
