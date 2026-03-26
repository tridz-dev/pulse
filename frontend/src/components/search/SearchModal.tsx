import { useEffect, useState } from 'react';
import { Search, User, FileText, CheckSquare, Flag, ArrowRight, Command } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';

interface SearchResult {
  type: 'employee' | 'template' | 'run' | 'corrective_action';
  id: string;
  title: string;
  subtitle: string;
  url: string;
}

interface QuickAction {
  name: string;
  url: string;
  icon: string;
}

const typeIcons = {
  employee: User,
  template: FileText,
  run: CheckSquare,
  corrective_action: Flag
};

const typeLabels = {
  employee: 'Employee',
  template: 'Template',
  run: 'Run',
  corrective_action: 'Corrective Action'
};

interface SearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchModal({ open, onOpenChange }: SearchModalProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Load quick actions
  useEffect(() => {
    if (open) {
      fetchQuickActions();
    }
  }, [open]);

  // Search when query changes
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (query.length >= 2) {
        performSearch();
      } else {
        setResults([]);
      }
    }, 200);

    return () => clearTimeout(timeout);
  }, [query]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < results.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            handleSelect(results[selectedIndex]);
          }
          break;
        case 'Escape':
          onOpenChange(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, results, selectedIndex]);

  const fetchQuickActions = async () => {
    try {
      const response = await fetch('/api/method/pulse.api.search.get_quick_actions');
      const data = await response.json();
      if (data.message) {
        setQuickActions(data.message);
      }
    } catch (error) {
      console.error('Failed to load quick actions');
    }
  };

  const performSearch = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/method/pulse.api.search.global_search?query=${encodeURIComponent(query)}&limit=10`);
      const data = await response.json();
      if (data.message) {
        setResults(data.message.results || []);
        setSelectedIndex(0);
      }
    } catch (error) {
      console.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (result: SearchResult | QuickAction) => {
    navigate(result.url);
    onOpenChange(false);
    setQuery('');
    setResults([]);
  };

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'user-plus': return User;
      case 'file-plus': return FileText;
      case 'clipboard-plus': return CheckSquare;
      case 'flag': return Flag;
      case 'check-square': return CheckSquare;
      case 'bar-chart': return ArrowRight;
      default: return ArrowRight;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0">
        <DialogTitle className="sr-only">Search</DialogTitle>
        
        {/* Search Input */}
        <div className="flex items-center border-b px-4 py-3">
          <Search className="h-5 w-5 text-muted-foreground mr-3" />
          <Input
            placeholder="Search employees, templates, runs..."
            className="border-0 focus-visible:ring-0 text-lg"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <kbd className="px-1.5 py-0.5 rounded bg-muted border">ESC</kbd>
            <span>to close</span>
          </div>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : query.length >= 2 ? (
            results.length > 0 ? (
              <div className="py-2">
                <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase">
                  Results ({results.length})
                </div>
                {results.map((result, index) => {
                  const Icon = typeIcons[result.type];
                  return (
                    <button
                      key={`${result.type}-${result.id}`}
                      className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${
                        index === selectedIndex ? 'bg-accent' : 'hover:bg-accent/50'
                      }`}
                      onClick={() => handleSelect(result)}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{result.title}</div>
                        <div className="text-sm text-muted-foreground truncate">
                          {result.subtitle}
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {typeLabels[result.type]}
                      </Badge>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No results found for "{query}"</p>
                <p className="text-sm mt-1">Try a different search term</p>
              </div>
            )
          ) : (
            /* Quick Actions */
            <div className="py-2">
              <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase">
                Quick Actions
              </div>
              <div className="grid grid-cols-2 gap-2 p-2">
                {quickActions.map((action) => {
                  const Icon = getIcon(action.icon);
                  return (
                    <button
                      key={action.name}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent text-left transition-colors"
                      onClick={() => handleSelect(action)}
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{action.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Keyboard Shortcuts */}
              <div className="px-4 py-3 border-t mt-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                  Keyboard Shortcuts
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <kbd className="px-1.5 py-0.5 rounded bg-muted border">↑↓</kbd>
                    <span>Navigate</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <kbd className="px-1.5 py-0.5 rounded bg-muted border">↵</kbd>
                    <span>Select</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <kbd className="px-1.5 py-0.5 rounded bg-muted border text-xs">
                      <Command className="h-3 w-3 inline" />K
                    </kbd>
                    <span>Open search</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
