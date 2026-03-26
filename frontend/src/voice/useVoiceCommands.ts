/**
 * useVoiceCommands Hook
 * 
 * Custom hook for consuming voice command functionality.
 * Provides a simplified interface for components to interact with voice features.
 */

import { useVoiceCommandContext } from './VoiceCommandProvider';
import type { VoiceState, CommandHistoryItem } from './VoiceCommandProvider';
import type { VoiceCommand } from './commandRegistry';

export interface UseVoiceCommandsReturn {
  // State
  isListening: boolean;
  isProcessing: boolean;
  isExecuting: boolean;
  isIdle: boolean;
  hasError: boolean;
  state: VoiceState;
  
  // Transcript
  transcript: string;
  interimTranscript: string;
  confidence: number;
  
  // Commands
  commands: VoiceCommand[];
  lastCommand: CommandHistoryItem | null;
  commandHistory: CommandHistoryItem[];
  
  // Support
  isSupported: boolean;
  error: string | null;
  
  // Actions
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  clearHistory: () => void;
  clearError: () => void;
}

/**
 * Hook for using voice commands
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isListening, startListening, stopListening, transcript } = useVoiceCommands();
 *   
 *   return (
 *     <button onClick={toggleListening}>
 *       {isListening ? 'Stop' : 'Start'} Listening
 *     </button>
 *   );
 * }
 * ```
 */
export function useVoiceCommands(): UseVoiceCommandsReturn {
  const context = useVoiceCommandContext();
  
  return {
    // State helpers
    isListening: context.state === 'listening',
    isProcessing: context.state === 'processing',
    isExecuting: context.state === 'executing',
    isIdle: context.state === 'idle',
    hasError: context.state === 'error',
    state: context.state,
    
    // Transcript
    transcript: context.transcript,
    interimTranscript: context.interimTranscript,
    confidence: context.confidence,
    
    // Commands
    commands: context.availableCommands,
    lastCommand: context.lastCommand,
    commandHistory: context.commandHistory,
    
    // Support
    isSupported: context.isSupported,
    error: context.error,
    
    // Actions
    startListening: context.startListening,
    stopListening: context.stopListening,
    toggleListening: context.toggleListening,
    clearHistory: context.clearHistory,
    clearError: context.clearError
  };
}

export type { VoiceState, CommandHistoryItem };
export type { VoiceCommand } from './commandRegistry';
