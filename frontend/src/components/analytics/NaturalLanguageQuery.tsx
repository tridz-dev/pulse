import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Search, 
  Mic, 
  Sparkles, 
  Loader2, 
  TrendingDown, 
  GitCompare, 
  LineChart,
  AlertTriangle,
  Users,
  Trophy,
  TrendingUp,
  List,
  Flag,
  FileText,
  X,
  Send
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useNLPQuery, type NLPSuggestion } from '@/hooks/useNLPQuery';

interface NaturalLanguageQueryProps {
  onQuerySubmit?: (query: string) => void;
  className?: string;
  compact?: boolean;
}

const EXAMPLE_QUERIES = [
  { text: 'Show me underperforming branches', icon: TrendingDown, category: 'Performance' },
  { text: 'Compare Q1 vs Q2 scores', icon: GitCompare, category: 'Comparison' },
  { text: 'Find employees with low completion rates', icon: Users, category: 'Employees' },
  { text: 'What are the top performing departments?', icon: Trophy, category: 'Ranking' },
  { text: 'Show score trends for last 30 days', icon: LineChart, category: 'Trends' },
  { text: 'Identify anomalies in SOP compliance', icon: AlertTriangle, category: 'Anomalies' },
];

const CATEGORY_COLORS: Record<string, string> = {
  performance: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  comparison: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  anomaly: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  trend: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  employee: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  general: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

const getIconForCategory = (iconName: string) => {
  const iconMap: Record<string, React.ElementType> = {
    'trending-down': TrendingDown,
    'git-compare': GitCompare,
    'line-chart': LineChart,
    'alert-triangle': AlertTriangle,
    'trending-up': TrendingUp,
    'list': List,
    'flag': Flag,
    'file-text': FileText,
    'users': Users,
    'trophy': Trophy,
  };
  return iconMap[iconName] || Sparkles;
};

export function NaturalLanguageQuery({ 
  onQuerySubmit, 
  className,
  compact = false 
}: NaturalLanguageQueryProps) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<NLPSuggestion[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { query, getSuggestions, loading } = useNLPQuery();

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (inputValue.length >= 2) {
        const suggs = await getSuggestions(inputValue);
        setSuggestions(suggs);
        setShowSuggestions(suggs.length > 0);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    };

    const timeout = setTimeout(fetchSuggestions, 150);
    return () => clearTimeout(timeout);
  }, [inputValue, getSuggestions]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showSuggestions) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => prev < suggestions.length - 1 ? prev + 1 : prev);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSelectSuggestion(suggestions[selectedIndex].text);
        } else if (inputValue.trim()) {
          handleSubmit();
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
    }
  }, [showSuggestions, suggestions, selectedIndex, inputValue]);

  const handleSubmit = async () => {
    if (!inputValue.trim() || loading) return;
    
    setShowSuggestions(false);
    await query(inputValue);
    onQuerySubmit?.(inputValue);
  };

  const handleSelectSuggestion = (text: string) => {
    setInputValue(text);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleExampleClick = (text: string) => {
    setInputValue(text);
    inputRef.current?.focus();
  };

  const handleVoiceInput = () => {
    const win = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    if (!win.webkitSpeechRecognition && !win.SpeechRecognition) {
      alert('Voice input is not supported in your browser');
      return;
    }

    const SpeechRecognition = (win.SpeechRecognition || win.webkitSpeechRecognition) as { new (): {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onstart: (() => void) | null;
      onresult: ((event: { results: { transcript: string }[][] }) => void) | null;
      onerror: (() => void) | null;
      onend: (() => void) | null;
      start: () => void;
    }};
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results.map(r => r[0]?.transcript || '').join('');
      setInputValue(transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const clearInput = () => {
    setInputValue('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <div className={cn(
        'relative flex items-center gap-2 rounded-xl border bg-card shadow-sm transition-all',
        'focus-within:ring-2 focus-within:ring-ring/50 focus-within:border-ring',
        compact ? 'p-2' : 'p-3'
      )}>
        <div className="flex-shrink-0">
          {loading ? (
            <Loader2 className={cn('animate-spin text-primary', compact ? 'h-4 w-4' : 'h-5 w-5')} />
          ) : (
            <Search className={cn('text-muted-foreground', compact ? 'h-4 w-4' : 'h-5 w-5')} />
          )}
        </div>

        <Input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={compact ? "Ask about SOP data..." : "Ask anything about your SOP data..."}
          className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-0 text-base"
          disabled={loading}
        />

        {inputValue && (
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-6 w-6 rounded-full', compact && 'h-5 w-5')}
            onClick={clearInput}
          >
            <X className="h-3 w-3" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={handleVoiceInput}
          disabled={loading || isListening}
          className={cn(
            'flex-shrink-0 rounded-full transition-colors',
            isListening && 'bg-red-100 text-red-600 animate-pulse dark:bg-red-900/30',
            compact ? 'h-7 w-7' : 'h-8 w-8'
          )}
          title="Voice input"
        >
          <Mic className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        </Button>

        <Button
          onClick={handleSubmit}
          disabled={!inputValue.trim() || loading}
          size={compact ? 'sm' : 'default'}
          className="flex-shrink-0 gap-1.5"
        >
          <Send className={compact ? 'h-3 w-3' : 'h-4 w-4'} />
          {!compact && 'Ask'}
        </Button>
      </div>

      {showSuggestions && (
        <div className="absolute top-full left-0 right-0 mt-2 rounded-xl border bg-popover shadow-lg z-50 overflow-hidden">
          <div className="py-2">
            <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase">
              Suggestions
            </div>
            {suggestions.map((suggestion, index) => {
              const Icon = getIconForCategory(suggestion.icon);
              return (
                <button
                  key={`${suggestion.text}-${index}`}
                  onClick={() => handleSelectSuggestion(suggestion.text)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={cn(
                    'w-full px-3 py-2.5 flex items-center gap-3 text-left transition-colors',
                    index === selectedIndex ? 'bg-accent' : 'hover:bg-accent/50'
                  )}
                >
                  <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="flex-1 truncate">{suggestion.text}</span>
                  <Badge 
                    variant="secondary" 
                    className={cn('text-[10px] px-1.5 py-0', CATEGORY_COLORS[suggestion.category])}
                  >
                    {suggestion.category}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {loading && (
        <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
          </div>
          <span>AI is analyzing your query...</span>
        </div>
      )}

      {!inputValue && !loading && !compact && (
        <div className="mt-4">
          <div className="text-xs font-medium text-muted-foreground uppercase mb-2">
            Try asking
          </div>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUERIES.map((example, index) => {
              const Icon = example.icon;
              return (
                <button
                  key={index}
                  onClick={() => handleExampleClick(example.text)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 text-sm text-muted-foreground transition-colors"
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{example.text}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function NaturalLanguageQuerySkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn('space-y-4', compact && 'space-y-2')}>
      <div className={cn('w-full bg-muted animate-pulse rounded-lg', compact ? 'h-10' : 'h-14')} />
      {!compact && (
        <div className="flex flex-wrap gap-2">
          <div className="h-8 w-48 bg-muted animate-pulse rounded-full" />
          <div className="h-8 w-36 bg-muted animate-pulse rounded-full" />
          <div className="h-8 w-52 bg-muted animate-pulse rounded-full" />
        </div>
      )}
    </div>
  );
}
