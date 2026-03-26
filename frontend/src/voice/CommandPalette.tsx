/**
 * Command Palette
 * 
 * Floating command palette UI for voice commands.
 * Features microphone button with pulsing animation, transcript display,
 * command suggestions, and keyboard shortcut support.
 */

import { useEffect, useState, useRef } from 'react';
import { Mic, MicOff, X, Command, AlertCircle, CheckCircle, Loader2, HelpCircle } from 'lucide-react';
import { useVoiceCommands } from './useVoiceCommands';
import type { VoiceCommand } from './commandRegistry';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const {
    isListening,
    isProcessing,
    isExecuting,
    hasError,
    transcript,
    interimTranscript,
    confidence,
    commands,
    lastCommand,
    isSupported,
    error,
    startListening,
    stopListening
  } = useVoiceCommands();
  
  const [spacePressed, setSpacePressed] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const spaceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Handle space key hold for voice
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Only trigger if not in an input field
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
        
        e.preventDefault();
        setSpacePressed(true);
        
        // Start listening after a short delay to distinguish from tap
        spaceTimeoutRef.current = setTimeout(() => {
          if (isSupported && !isListening) {
            startListening();
          }
        }, 200);
      }
      
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpacePressed(false);
        
        if (spaceTimeoutRef.current) {
          clearTimeout(spaceTimeoutRef.current);
          spaceTimeoutRef.current = null;
        }
        
        if (isListening) {
          stopListening();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (spaceTimeoutRef.current) {
        clearTimeout(spaceTimeoutRef.current);
      }
    };
  }, [isOpen, isListening, isSupported, startListening, stopListening, onClose]);
  
  // Auto-show help on first open if no commands executed
  useEffect(() => {
    if (isOpen && !lastCommand && !isListening) {
      const timer = setTimeout(() => setShowHelp(true), 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, lastCommand, isListening]);
  
  // Get status color
  const getStatusColor = () => {
    if (hasError) return 'text-red-500';
    if (isExecuting) return 'text-emerald-500';
    if (isProcessing) return 'text-amber-500';
    if (isListening) return 'text-indigo-500';
    return 'text-zinc-500';
  };
  
  // Get status text
  const getStatusText = () => {
    if (hasError) return 'Error';
    if (isExecuting) return 'Executing...';
    if (isProcessing) return 'Processing...';
    if (isListening) return 'Listening...';
    if (spacePressed) return 'Hold space to talk';
    return 'Ready';
  };
  
  // Get confidence color
  const getConfidenceColor = (c: number) => {
    if (c >= 0.9) return 'text-emerald-500';
    if (c >= 0.7) return 'text-amber-500';
    return 'text-red-500';
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 pointer-events-none">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/20 backdrop-blur-sm pointer-events-auto"
        onClick={onClose}
      />
      
      {/* Palette */}
      <div className="relative w-full max-w-lg mx-4 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl pointer-events-auto overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Command className="h-4 w-4 text-indigo-400" />
            <span className="text-sm font-medium text-zinc-200">Voice Commands</span>
            {!isSupported && (
              <span className="text-xs text-red-400 bg-red-400/10 px-2 py-0.5 rounded">Not Supported</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
              title="Toggle help"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="p-6">
          {/* Microphone Button */}
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={isListening ? stopListening : startListening}
              disabled={!isSupported || isProcessing || isExecuting}
              className={`
                relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300
                ${isListening 
                  ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/50' 
                  : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                }
                ${!isSupported ? 'opacity-50 cursor-not-allowed' : ''}
                ${spacePressed && !isListening ? 'scale-95' : ''}
              `}
            >
              {/* Pulsing rings when listening */}
              {isListening && (
                <>
                  <span className="absolute inset-0 rounded-full bg-indigo-500 animate-ping opacity-20" />
                  <span className="absolute inset-[-8px] rounded-full border-2 border-indigo-500/30 animate-pulse" />
                  <span className="absolute inset-[-16px] rounded-full border border-indigo-500/20 animate-pulse delay-75" />
                </>
              )}
              
              {isProcessing || isExecuting ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : isListening ? (
                <Mic className="h-8 w-8" />
              ) : (
                <MicOff className="h-8 w-8" />
              )}
            </button>
            
            {/* Status */}
            <div className="text-center">
              <p className={`text-sm font-medium ${getStatusColor()}`}>
                {getStatusText()}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                {isSupported 
                  ? isListening 
                    ? 'Click or release space to stop'
                    : 'Click or hold space to talk'
                  : 'Use Chrome, Edge, or Safari for voice commands'
                }
              </p>
            </div>
          </div>
          
          {/* Transcript Display */}
          <div className="mt-6 min-h-[60px]">
            {transcript ? (
              <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">You said</span>
                  {confidence > 0 && (
                    <span className={`text-xs ${getConfidenceColor(confidence)}`}>
                      {Math.round(confidence * 100)}% confidence
                    </span>
                  )}
                </div>
                <p className="text-zinc-200">&ldquo;{transcript}&rdquo;</p>
              </div>
            ) : interimTranscript ? (
              <div className="bg-zinc-900/30 rounded-lg p-4 border border-zinc-800/50">
                <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Listening...</span>
                <p className="text-zinc-400 italic">{interimTranscript}</p>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[60px] text-zinc-600 text-sm">
                {hasError ? (
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertCircle className="h-4 w-4" />
                    <span>{error}</span>
                  </div>
                ) : (
                  <span>Say a command or hold space to speak</span>
                )}
              </div>
            )}
          </div>
          
          {/* Last Command Result */}
          {lastCommand && (
            <div className={`
              mt-4 p-3 rounded-lg border text-sm
              ${lastCommand.result.success 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200' 
                : 'bg-red-500/10 border-red-500/20 text-red-200'
              }
            `}>
              <div className="flex items-start gap-2">
                {lastCommand.result.success ? (
                  <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                )}
                <div>
                  <p className="font-medium">{lastCommand.result.message}</p>
                  {lastCommand.result.error && (
                    <p className="text-xs opacity-80 mt-1">{lastCommand.result.error}</p>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Help Panel */}
          {showHelp && (
            <div className="mt-4 pt-4 border-t border-zinc-800">
              <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
                Available Commands
              </h4>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {commands.slice(0, 6).map((cmd) => (
                  <CommandSuggestion key={cmd.action} command={cmd} />
                ))}
              </div>
              <p className="text-xs text-zinc-600 mt-3">
                Say &ldquo;help&rdquo; for all available commands
              </p>
            </div>
          )}
        </div>
        
        {/* Footer with keyboard shortcut */}
        <div className="px-4 py-2 bg-zinc-900/50 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono">Space</kbd>
            <span>hold to talk</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono">Esc</kbd>
            <span>close</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Command suggestion component
function CommandSuggestion({ command }: { command: VoiceCommand }) {
  return (
    <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-zinc-900 transition-colors">
      <div className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center shrink-0">
        <Command className="h-3 w-3 text-zinc-500" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-300">{command.name}</p>
        <p className="text-xs text-zinc-500">{command.description}</p>
        <p className="text-xs text-zinc-600 mt-1">
          &ldquo;{command.examples[0]}&rdquo;
        </p>
      </div>
    </div>
  );
}
