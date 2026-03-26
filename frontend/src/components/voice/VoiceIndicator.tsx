/**
 * Voice Indicator
 * 
 * Status indicator component that shows in the Topbar when voice is active.
 * Indicates listening/processing/idle states and allows opening CommandPalette.
 */

import { Mic, MicOff, Loader2, AlertCircle } from 'lucide-react';
import { useVoiceCommands } from '@/voice/useVoiceCommands';
import { cn } from '@/lib/utils';

interface VoiceIndicatorProps {
  onClick?: () => void;
  className?: string;
}

export function VoiceIndicator({ onClick, className }: VoiceIndicatorProps) {
  const { 
    isListening, 
    isProcessing, 
    isExecuting, 
    hasError, 
    isSupported,
    lastCommand 
  } = useVoiceCommands();
  
  // Don't show if voice is not supported and there's no error to show
  if (!isSupported && !hasError) {
    return null;
  }
  
  // Determine state for styling
  const getStateStyles = () => {
    if (hasError) {
      return {
        container: 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20',
        icon: 'text-red-400',
        pulse: false
      };
    }
    if (isExecuting) {
      return {
        container: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20',
        icon: 'text-emerald-400',
        pulse: false
      };
    }
    if (isProcessing) {
      return {
        container: 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20',
        icon: 'text-amber-400',
        pulse: false
      };
    }
    if (isListening) {
      return {
        container: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20',
        icon: 'text-indigo-400',
        pulse: true
      };
    }
    // Idle state
    return {
      container: 'bg-zinc-800/50 border-zinc-700/50 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300',
      icon: 'text-zinc-500',
      pulse: false
    };
  };
  
  const styles = getStateStyles();
  
  // Get status icon
  const StatusIcon = () => {
    if (hasError) return <AlertCircle className="h-3.5 w-3.5" />;
    if (isProcessing || isExecuting) return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
    if (isListening) return <Mic className="h-3.5 w-3.5" />;
    return <MicOff className="h-3.5 w-3.5" />;
  };
  
  // Get tooltip text
  const getTooltip = () => {
    if (hasError) return 'Voice command error - click to retry';
    if (isExecuting) return 'Executing command...';
    if (isProcessing) return 'Processing voice command...';
    if (isListening) return 'Listening - click to stop';
    if (lastCommand?.result.success) return 'Voice ready - click to speak';
    return 'Voice commands - click to speak';
  };
  
  return (
    <button
      onClick={onClick}
      disabled={isProcessing || isExecuting}
      className={cn(
        'relative flex items-center gap-1.5 px-2 py-1 rounded-md border transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:ring-offset-2 focus:ring-offset-zinc-950',
        styles.container,
        (isProcessing || isExecuting) && 'cursor-wait',
        className
      )}
      title={getTooltip()}
    >
      {/* Pulsing indicator when listening */}
      {styles.pulse && (
        <>
          <span className="absolute inset-0 rounded-md bg-indigo-500/20 animate-ping" />
          <span className="absolute -inset-0.5 rounded-lg bg-indigo-500/10 animate-pulse" />
        </>
      )}
      
      {/* Icon */}
      <span className={cn('relative', styles.icon)}>
        <StatusIcon />
      </span>
      
      {/* Text label (hidden on small screens) */}
      <span className="hidden sm:inline text-xs font-medium relative">
        {isListening ? 'Listening' : isProcessing ? 'Processing' : isExecuting ? 'Executing' : 'Voice'}
      </span>
      
      {/* Success indicator dot */}
      {lastCommand?.result.success && !isListening && !isProcessing && !isExecuting && !hasError && (
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full" />
      )}
    </button>
  );
}

// Compact version for tight spaces
export function VoiceIndicatorCompact({ onClick, className }: VoiceIndicatorProps) {
  const { isListening, isProcessing, isExecuting, hasError, isSupported } = useVoiceCommands();
  
  if (!isSupported) return null;
  
  const getIconAndColor = () => {
    if (hasError) return { Icon: AlertCircle, color: 'text-red-400' };
    if (isProcessing || isExecuting) return { Icon: Loader2, color: 'text-amber-400 animate-spin' };
    if (isListening) return { Icon: Mic, color: 'text-indigo-400' };
    return { Icon: MicOff, color: 'text-zinc-500 hover:text-zinc-300' };
  };
  
  const { Icon, color } = getIconAndColor();
  
  return (
    <button
      onClick={onClick}
      disabled={isProcessing || isExecuting}
      className={cn(
        'p-1.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50',
        color,
        className
      )}
      title="Voice commands"
    >
      <Icon className="h-4 w-4" />
      
      {/* Listening indicator */}
      {isListening && (
        <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
      )}
    </button>
  );
}
