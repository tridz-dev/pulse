/**
 * Voice Command Registry
 * 
 * Defines all available voice commands with their patterns and handlers.
 * Commands are matched using regex patterns against transcribed speech.
 */

import type { NavigateFunction } from 'react-router-dom';
import type { QueryClient } from '@tanstack/react-query';

export type VoiceCommandAction = 
  | 'COMPLETE_TASK'
  | 'START_RUN'
  | 'NAVIGATE'
  | 'GET_SCORE'
  | 'CREATE_CA'
  | 'SEARCH'
  | 'SHOW_HELP'
  | 'OPEN_PAGE'
  | 'GO_BACK'
  | 'REFRESH_DATA';

export interface VoiceCommandResult {
  success: boolean;
  action: VoiceCommandAction;
  message: string;
  data?: Record<string, unknown>;
  error?: string;
}

export interface VoiceCommand {
  action: VoiceCommandAction;
  name: string;
  description: string;
  patterns: RegExp[];
  handler: (matches: RegExpMatchArray, context: CommandContext) => Promise<VoiceCommandResult> | VoiceCommandResult;
  examples: string[];
}

export interface CommandContext {
  navigate: NavigateFunction;
  queryClient: QueryClient;
  currentUser: { name: string; role: string } | null;
  currentPath: string;
}

// Command handlers
const completeTaskHandler = async (matches: RegExpMatchArray, context: CommandContext): Promise<VoiceCommandResult> => {
  const taskNumber = matches[1];
  
  // Call backend API to complete task
  try {
    const response = await fetch('/api/method/pulse.api.voice.process_voice_command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command_text: `complete task ${taskNumber}`,
        context: {
          user: context.currentUser?.name,
          path: context.currentPath,
          action: 'COMPLETE_TASK',
          params: { taskNumber }
        }
      })
    });
    const data = await response.json();
    
    if (data.message?.success) {
      // Invalidate relevant queries
      context.queryClient.invalidateQueries({ queryKey: ['pulse', 'myRuns'] });
      context.queryClient.invalidateQueries({ queryKey: ['pulse', 'goHomeSummary'] });
      
      return {
        success: true,
        action: 'COMPLETE_TASK',
        message: `Task ${taskNumber} marked as complete`,
        data: data.message.result
      };
    }
    
    throw new Error(data.message?.error || 'Failed to complete task');
  } catch (error) {
    return {
      success: false,
      action: 'COMPLETE_TASK',
      message: `Could not complete task ${taskNumber}`,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

const startRunHandler = async (matches: RegExpMatchArray, context: CommandContext): Promise<VoiceCommandResult> => {
  const templateName = matches[1];
  
  try {
    const response = await fetch('/api/method/pulse.api.voice.process_voice_command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command_text: `start run ${templateName}`,
        context: {
          user: context.currentUser?.name,
          path: context.currentPath,
          action: 'START_RUN',
          params: { templateName }
        }
      })
    });
    const data = await response.json();
    
    if (data.message?.success) {
      const runId = data.message.result?.run_id;
      if (runId) {
        context.navigate(`/go/checklists?run=${runId}`);
      }
      
      return {
        success: true,
        action: 'START_RUN',
        message: `Started ${templateName} run`,
        data: data.message.result
      };
    }
    
    throw new Error(data.message?.error || 'Failed to start run');
  } catch (error) {
    return {
      success: false,
      action: 'START_RUN',
      message: `Could not start run for ${templateName}`,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

const navigateHandler = (matches: RegExpMatchArray, context: CommandContext): VoiceCommandResult => {
  const page = matches[1].toLowerCase();
  
  const pageRoutes: Record<string, string> = {
    'dashboard': '/',
    'tasks': '/tasks',
    'team': '/team',
    'operations': '/operations',
    'templates': '/templates',
    'insights': '/insights',
    'analytics': '/analytics',
    'branches': '/admin/branches',
    'employees': '/admin/employees',
    'settings': '/admin/settings',
    'checklists': '/go/checklists',
    'alerts': '/go/alerts',
    'profile': '/go/me',
    'corrective actions': '/corrective-actions',
    'ca': '/corrective-actions',
  };
  
  const route = pageRoutes[page];
  if (route) {
    context.navigate(route);
    return {
      success: true,
      action: 'NAVIGATE',
      message: `Navigating to ${page}`,
      data: { route }
    };
  }
  
  return {
    success: false,
    action: 'NAVIGATE',
    message: `Unknown page: ${page}`,
    error: `Page "${page}" not found. Try: dashboard, tasks, team, operations, templates, insights, analytics, checklists, or corrective actions.`
  };
};

const getScoreHandler = async (_matches: RegExpMatchArray, context: CommandContext): Promise<VoiceCommandResult> => {
  try {
    const response = await fetch('/api/method/pulse.api.voice.process_voice_command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command_text: 'what is my score',
        context: {
          user: context.currentUser?.name,
          path: context.currentPath,
          action: 'GET_SCORE'
        }
      })
    });
    const data = await response.json();
    
    if (data.message?.success) {
      const result = data.message.result;
      return {
        success: true,
        action: 'GET_SCORE',
        message: `Your score is ${result.score}% with ${result.completion_rate}% completion rate`,
        data: result
      };
    }
    
    throw new Error(data.message?.error || 'Failed to get score');
  } catch (error) {
    return {
      success: false,
      action: 'GET_SCORE',
      message: 'Could not retrieve your score',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

const createCAHandler = (_matches: RegExpMatchArray, context: CommandContext): VoiceCommandResult => {
  context.navigate('/corrective-actions/new');
  return {
    success: true,
    action: 'CREATE_CA',
    message: 'Opening corrective action form',
    data: { route: '/corrective-actions/new' }
  };
};

const searchHandler = (matches: RegExpMatchArray, context: CommandContext): VoiceCommandResult => {
  const query = matches[1];
  context.navigate(`/?search=${encodeURIComponent(query)}`);
  return {
    success: true,
    action: 'SEARCH',
    message: `Searching for "${query}"`,
    data: { query }
  };
};

const showHelpHandler = (): VoiceCommandResult => {
  return {
    success: true,
    action: 'SHOW_HELP',
    message: 'Available commands: complete task [number], start run [template], show [page] dashboard, what is my score, create corrective action, search for [term], go back, refresh data',
    data: {
      commands: availableCommands.map(cmd => ({
        name: cmd.name,
        description: cmd.description,
        examples: cmd.examples
      }))
    }
  };
};

const openPageHandler = (matches: RegExpMatchArray, context: CommandContext): VoiceCommandResult => {
  return navigateHandler(matches, context);
};

const goBackHandler = (_matches: RegExpMatchArray, _context: CommandContext): VoiceCommandResult => {
  window.history.back();
  return {
    success: true,
    action: 'GO_BACK',
    message: 'Going back'
  };
};

const refreshDataHandler = async (_matches: RegExpMatchArray, context: CommandContext): Promise<VoiceCommandResult> => {
  await context.queryClient.invalidateQueries({ queryKey: ['pulse'] });
  return {
    success: true,
    action: 'REFRESH_DATA',
    message: 'Refreshing all data'
  };
};

// Command registry
export const availableCommands: VoiceCommand[] = [
  {
    action: 'COMPLETE_TASK',
    name: 'Complete Task',
    description: 'Mark a task as complete by its number',
    patterns: [
      /complete task (\d+)/i,
      /finish task (\d+)/i,
      /mark task (\d+) as complete/i,
      /done with task (\d+)/i,
      /task (\d+) complete/i,
    ],
    handler: completeTaskHandler,
    examples: ['complete task 3', 'finish task 5', 'task 2 complete']
  },
  {
    action: 'START_RUN',
    name: 'Start Run',
    description: 'Start a new SOP run from a template',
    patterns: [
      /start run (\w+)/i,
      /begin run (\w+)/i,
      /new run (\w+)/i,
      /create run (\w+)/i,
      /start (\w+) run/i,
    ],
    handler: startRunHandler,
    examples: ['start run daily', 'begin run weekly', 'new run inspection']
  },
  {
    action: 'NAVIGATE',
    name: 'Navigate',
    description: 'Navigate to a specific page',
    patterns: [
      /show (\w+) dashboard/i,
      /go to (\w+)/i,
      /open (\w+)/i,
      /navigate to (\w+)/i,
      /take me to (\w+)/i,
    ],
    handler: navigateHandler,
    examples: ['show dashboard', 'go to tasks', 'open analytics', 'show team dashboard']
  },
  {
    action: 'OPEN_PAGE',
    name: 'Open Page',
    description: 'Open a specific page directly',
    patterns: [
      /(dashboard|tasks|team|operations|templates|insights|analytics|checklists|alerts|profile)/i,
    ],
    handler: openPageHandler,
    examples: ['dashboard', 'tasks', 'team', 'checklists']
  },
  {
    action: 'GET_SCORE',
    name: 'Get Score',
    description: 'Get your current performance score',
    patterns: [
      /what is my score/i,
      /show my score/i,
      /my performance/i,
      /how am i doing/i,
      /get my score/i,
      /what's my score/i,
    ],
    handler: getScoreHandler,
    examples: ['what is my score', 'show my score', 'how am i doing']
  },
  {
    action: 'CREATE_CA',
    name: 'Create Corrective Action',
    description: 'Create a new corrective action',
    patterns: [
      /create corrective action/i,
      /new corrective action/i,
      /add corrective action/i,
      /create ca/i,
      /new ca/i,
    ],
    handler: createCAHandler,
    examples: ['create corrective action', 'new corrective action', 'create ca']
  },
  {
    action: 'SEARCH',
    name: 'Search',
    description: 'Search for items in the system',
    patterns: [
      /search for (.+)/i,
      /find (.+)/i,
      /look for (.+)/i,
      /search (.+)/i,
    ],
    handler: searchHandler,
    examples: ['search for John', 'find employee template', 'look for daily checklist']
  },
  {
    action: 'GO_BACK',
    name: 'Go Back',
    description: 'Navigate to the previous page',
    patterns: [
      /go back/i,
      /back/i,
      /previous page/i,
      /return/i,
    ],
    handler: goBackHandler,
    examples: ['go back', 'back', 'previous page']
  },
  {
    action: 'REFRESH_DATA',
    name: 'Refresh Data',
    description: 'Refresh all cached data',
    patterns: [
      /refresh data/i,
      /refresh/i,
      /reload/i,
      /update data/i,
      /sync/i,
    ],
    handler: refreshDataHandler,
    examples: ['refresh data', 'refresh', 'reload']
  },
  {
    action: 'SHOW_HELP',
    name: 'Help',
    description: 'Show available voice commands',
    patterns: [
      /help/i,
      /what can i say/i,
      /commands/i,
      /voice commands/i,
      /what are the commands/i,
    ],
    handler: showHelpHandler,
    examples: ['help', 'what can i say', 'commands']
  },
];

/**
 * Find matching command for a given transcript
 */
export function findMatchingCommand(transcript: string): { command: VoiceCommand; matches: RegExpMatchArray } | null {
  for (const command of availableCommands) {
    for (const pattern of command.patterns) {
      const matches = transcript.match(pattern);
      if (matches) {
        return { command, matches };
      }
    }
  }
  return null;
}

/**
 * Execute a matched command
 */
export async function executeCommand(
  command: VoiceCommand,
  matches: RegExpMatchArray,
  context: CommandContext
): Promise<VoiceCommandResult> {
  try {
    const result = await command.handler(matches, context);
    return result;
  } catch (error) {
    return {
      success: false,
      action: command.action,
      message: `Error executing ${command.name}`,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
