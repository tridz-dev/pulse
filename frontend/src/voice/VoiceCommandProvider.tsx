/**
 * Voice Command Provider
 * 
 * Context provider for Web Speech API integration.
 * Manages voice recognition state, command execution, and history tracking.
 */

import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/store/AuthContext';
import type { 
  VoiceCommand, 
  VoiceCommandResult,
  CommandContext
} from './commandRegistry';
import { 
  findMatchingCommand, 
  executeCommand,
  availableCommands
} from './commandRegistry';

// Web Speech API types
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

export type VoiceState = 'idle' | 'listening' | 'processing' | 'executing' | 'error';

export interface CommandHistoryItem {
  id: string;
  timestamp: Date;
  transcript: string;
  confidence: number;
  result: VoiceCommandResult;
  command?: VoiceCommand;
}

export interface VoiceCommandContextType {
  // State
  state: VoiceState;
  transcript: string;
  interimTranscript: string;
  confidence: number;
  lastCommand: CommandHistoryItem | null;
  commandHistory: CommandHistoryItem[];
  isSupported: boolean;
  error: string | null;
  
  // Commands
  availableCommands: typeof availableCommands;
  
  // Actions
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  clearHistory: () => void;
  clearError: () => void;
}

const VoiceCommandContext = createContext<VoiceCommandContextType | undefined>(undefined);

interface VoiceCommandProviderProps {
  children: ReactNode;
}

export function VoiceCommandProvider({ children }: VoiceCommandProviderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();
  
  // State
  const [state, setState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [commandHistory, setCommandHistory] = useState<CommandHistoryItem[]>([]);
  const [lastCommand, setLastCommand] = useState<CommandHistoryItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Refs
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isSupportedRef = useRef(false);
  
  // Check browser support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    isSupportedRef.current = !!SpeechRecognition;
    
    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser. Try Chrome, Edge, or Safari.');
    }
  }, []);
  
  // Initialize recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;
    
    recognition.onstart = () => {
      setState('listening');
      setError(null);
    };
    
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interim = '';
      let maxConfidence = 0;
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const alternative = result[0];
        
        if (result.isFinal) {
          finalTranscript += alternative.transcript;
          maxConfidence = Math.max(maxConfidence, alternative.confidence);
        } else {
          interim += alternative.transcript;
        }
      }
      
      if (finalTranscript) {
        setTranscript(finalTranscript.trim());
        setConfidence(maxConfidence);
        setInterimTranscript('');
        
        // Process the command
        processVoiceCommand(finalTranscript.trim(), maxConfidence);
      } else if (interim) {
        setInterimTranscript(interim.trim());
      }
    };
    
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error, event.message);
      
      let errorMessage = 'An error occurred during speech recognition';
      switch (event.error) {
        case 'no-speech':
          errorMessage = 'No speech detected. Please try again.';
          break;
        case 'audio-capture':
          errorMessage = 'No microphone found or microphone is not working.';
          break;
        case 'not-allowed':
          errorMessage = 'Microphone permission denied. Please allow microphone access.';
          break;
        case 'network':
          errorMessage = 'Network error occurred. Please check your connection.';
          break;
        case 'aborted':
          // User stopped listening, not an error
          return;
        default:
          errorMessage = `Speech recognition error: ${event.error}`;
      }
      
      setError(errorMessage);
      setState('error');
    };
    
    recognition.onend = () => {
      // Only reset to idle if we're not processing
      if (state !== 'processing' && state !== 'executing') {
        setState('idle');
      }
    };
    
    recognitionRef.current = recognition;
    
    return () => {
      recognition.abort();
    };
  }, []); // Initialize once
  
  // Process voice command
  const processVoiceCommand = useCallback(async (text: string, cmdConfidence: number) => {
    setState('processing');
    
    const commandContext: CommandContext = {
      navigate,
      queryClient,
      currentUser,
      currentPath: location.pathname
    };
    
    // Find matching command
    const match = findMatchingCommand(text);
    
    let result: VoiceCommandResult;
    
    if (match) {
      setState('executing');
      result = await executeCommand(match.command, match.matches, commandContext);
    } else {
      result = {
        success: false,
        action: 'SHOW_HELP',
        message: `I didn't understand "${text}"`,
        error: 'No matching command found. Say "help" to see available commands.'
      };
    }
    
    // Create history item
    const historyItem: CommandHistoryItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      transcript: text,
      confidence: cmdConfidence,
      result,
      command: match?.command
    };
    
    // Update history
    setCommandHistory(prev => [historyItem, ...prev].slice(0, 50)); // Keep last 50
    setLastCommand(historyItem);
    setState('idle');
    
    // Log to backend
    try {
      await fetch('/api/method/pulse.api.voice.log_voice_command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: text,
          result: result.success ? 'success' : 'failure',
          action: result.action,
          confidence: cmdConfidence,
          error: result.error || null
        })
      });
    } catch (e) {
      // Silently fail logging
      console.warn('Failed to log voice command:', e);
    }
  }, [navigate, queryClient, currentUser, location.pathname]);
  
  // Start listening
  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      setError('Speech recognition is not supported in this browser');
      return;
    }
    
    // Reset state
    setTranscript('');
    setInterimTranscript('');
    setConfidence(0);
    setError(null);
    
    try {
      recognitionRef.current.start();
    } catch (e) {
      // Already started, stop and restart
      try {
        recognitionRef.current.stop();
        setTimeout(() => recognitionRef.current?.start(), 100);
      } catch (stopError) {
        console.error('Failed to restart recognition:', stopError);
      }
    }
  }, []);
  
  // Stop listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn('Error stopping recognition:', e);
      }
    }
    setState('idle');
  }, []);
  
  // Toggle listening
  const toggleListening = useCallback(() => {
    if (state === 'listening') {
      stopListening();
    } else {
      startListening();
    }
  }, [state, startListening, stopListening]);
  
  // Clear history
  const clearHistory = useCallback(() => {
    setCommandHistory([]);
    setLastCommand(null);
  }, []);
  
  // Clear error
  const clearError = useCallback(() => {
    setError(null);
    if (state === 'error') {
      setState('idle');
    }
  }, [state]);
  
  const value: VoiceCommandContextType = {
    state,
    transcript,
    interimTranscript,
    confidence,
    lastCommand,
    commandHistory,
    isSupported: isSupportedRef.current,
    error,
    availableCommands,
    startListening,
    stopListening,
    toggleListening,
    clearHistory,
    clearError
  };
  
  return (
    <VoiceCommandContext.Provider value={value}>
      {children}
    </VoiceCommandContext.Provider>
  );
}

export function useVoiceCommandContext(): VoiceCommandContextType {
  const context = useContext(VoiceCommandContext);
  if (context === undefined) {
    throw new Error('useVoiceCommandContext must be used within a VoiceCommandProvider');
  }
  return context;
}
