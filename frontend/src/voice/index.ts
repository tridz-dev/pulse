/**
 * Voice Commands Module
 * 
 * Hands-free SOP operation using Web Speech API.
 * 
 * @example
 * ```tsx
 * // Wrap your app with the provider
 * <VoiceCommandProvider>
 *   <App />
 * </VoiceCommandProvider>
 * 
 * // Use voice commands in components
 * const { startListening, isListening } = useVoiceCommands();
 * 
 * // Show the command palette
 * <CommandPalette isOpen={isOpen} onClose={() => setIsOpen(false)} />
 * 
 * // Show status indicator
 * <VoiceIndicator onClick={() => setIsOpen(true)} />
 * ```
 */

// Provider
export { VoiceCommandProvider, useVoiceCommandContext } from './VoiceCommandProvider';
export type { VoiceCommandContextType, VoiceState, CommandHistoryItem } from './VoiceCommandProvider';

// Hook
export { useVoiceCommands } from './useVoiceCommands';
export type { UseVoiceCommandsReturn } from './useVoiceCommands';

// Components
export { CommandPalette } from './CommandPalette';

// Command registry
export { 
  availableCommands, 
  findMatchingCommand, 
  executeCommand 
} from './commandRegistry';
export type { 
  VoiceCommand, 
  VoiceCommandAction, 
  VoiceCommandResult,
  CommandContext 
} from './commandRegistry';
