import { readdir, readFile, stat } from 'fs/promises';
import { join, sep, basename, isAbsolute, resolve } from 'path';
import { homedir } from 'os';
import type { Conversation, Message } from '../types.js';
import { extractMessageText, isToolResultContent } from './messageUtils.js';

/**
 * Get the Claude projects directory path.
 * Priority: CLAUDE_PROJECTS_DIR env var > default ~/.claude/projects
 */
function getClaudeProjectsDir(): string {
  const envDir = process.env.CLAUDE_PROJECTS_DIR;
  if (envDir?.trim()) {
    const trimmed = envDir.trim();
    // Convert relative paths to absolute
    return isAbsolute(trimmed) ? trimmed : resolve(trimmed);
  }
  return join(homedir(), '.claude', 'projects');
}

const CLAUDE_PROJECTS_DIR = getClaudeProjectsDir();

interface PaginationOptions {
  limit: number;
  offset: number;
  currentDirFilter?: string;
}



// Helper function to convert project path to Claude directory name
function pathToClaudeDir(path: string): string {
  // Claude's conversion: / or \ becomes -, and . also becomes -
  return path.replace(/[/\\.]/g, '-');
}

// Get paginated conversations with lazy loading
export async function getPaginatedConversations(options: PaginationOptions): Promise<{
  conversations: Conversation[];
  total: number;
}> {
  // First, just get file paths and stats without reading content
  const allFiles: Array<{path: string, dir: string, mtime: Date}> = [];
  
  try {
    const projectDirs = await readdir(CLAUDE_PROJECTS_DIR);
    
    // If filtering by directory, convert the filter path to Claude's directory name format
    const targetDir = options.currentDirFilter ? pathToClaudeDir(options.currentDirFilter) : null;
    
    for (const projectDir of projectDirs) {
      // Skip directories that don't match the filter early
      if (targetDir && projectDir !== targetDir) {
        continue;
      }
      
      const projectPath = join(CLAUDE_PROJECTS_DIR, projectDir);
      const dirFiles = await readdir(projectPath);
      // Match both UUID format and agent-* format files
      const jsonlFiles = dirFiles.filter(f => f.endsWith('.jsonl') &&
        (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$/i.test(f) ||
         /^agent-[0-9a-f]+\.jsonl$/i.test(f)));
      
      for (const file of jsonlFiles) {
        const filePath = join(projectPath, file);
        const stats = await stat(filePath);
        allFiles.push({
          path: filePath,
          dir: projectDir,
          mtime: stats.mtime
        });
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { conversations: [], total: 0 };
    }
    throw error;
  }
  
  // Sort by modification time (newest first)
  allFiles.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  
  const conversations: Conversation[] = [];
  let skippedCount = 0;
  let fileIndex = 0;
  
  // Skip files based on offset
  while (skippedCount < options.offset && fileIndex < allFiles.length) {
    const file = allFiles[fileIndex];
    const conversation = await readConversation(file.path, file.dir);
    
    if (conversation) {
      skippedCount++;
    }
    fileIndex++;
  }
  
  // Collect conversations for the current page
  while (conversations.length < options.limit && fileIndex < allFiles.length) {
    const file = allFiles[fileIndex];
    const conversation = await readConversation(file.path, file.dir);
    
    if (conversation) {
      conversations.push(conversation);
    }
    fileIndex++;
  }
  
  // For total count, we'll return -1 to indicate unknown
  // The UI can handle this by not showing total pages
  return { conversations, total: -1 };
}

export async function getAllConversations(currentDirFilter?: string): Promise<Conversation[]> {
  const conversations: Conversation[] = [];

  try {
    const projectDirs = await readdir(CLAUDE_PROJECTS_DIR);

    // Convert filter path to Claude's directory name format for early filtering
    const targetDir = currentDirFilter ? pathToClaudeDir(currentDirFilter) : null;

    for (const projectDir of projectDirs) {
      // Skip directories that don't match the filter early (same as getPaginatedConversations)
      if (targetDir && projectDir !== targetDir) {
        continue;
      }

      const projectPath = join(CLAUDE_PROJECTS_DIR, projectDir);
      const files = await readdir(projectPath);
      // Match both UUID format and agent-* format files
      const jsonlFiles = files.filter(f => f.endsWith('.jsonl') &&
        (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$/i.test(f) ||
         /^agent-[0-9a-f]+\.jsonl$/i.test(f)));

      for (const file of jsonlFiles) {
        const filePath = join(projectPath, file);
        const conversation = await readConversation(filePath, projectDir);
        if (conversation) {
          conversations.push(conversation);
        }
      }
    }

    const result = conversations
      .sort((a, b) => b.endTime.getTime() - a.endTime.getTime());

    return result;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function readConversation(filePath: string, projectDir: string): Promise<Conversation | null> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      return null;
    }
    
    // Extract session ID from filename or message content
    const filename = basename(filePath);
    const isAgentFile = filename.startsWith('agent-');
    const filenameSessionId = filename.replace('.jsonl', '');
    
    const messages: Message[] = [];
    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        // Only include messages with proper structure
        // Skip user messages that are tool results
        if (data && data.type && data.message && data.timestamp) {
          // Skip tool result messages from user
          if (data.type === 'user' && isToolResultContent(data.message.content)) {
            continue;
          }
          messages.push(data as Message);
        }
      } catch {
        continue;
      }
    }
    
    if (messages.length === 0) {
      return null;
    }
    
    const userMessages = messages.filter(m => m.type === 'user');

    const projectPath = messages[0].cwd || '';

    // Use basename of projectPath for projectName to avoid hyphen/separator ambiguity
    const projectName = projectPath ? basename(projectPath) : projectDir.replace(/^-/, '').split('-').join(sep);

    const startTime = new Date(messages[0].timestamp);
    const endTime = new Date(messages[messages.length - 1].timestamp);

    // Use session ID from filename for UUID files, or from message content for agent files
    // Agent files use the parent session's ID which is stored in the message's sessionId field
    let sessionId = filenameSessionId;
    if (isAgentFile && messages.length > 0) {
      // Get sessionId from the first message for agent files
      const firstLine = lines.find(line => {
        try {
          const data = JSON.parse(line);
          return data.sessionId;
        } catch {
          return false;
        }
      });
      if (firstLine) {
        try {
          const data = JSON.parse(firstLine);
          if (data.sessionId) {
            sessionId = data.sessionId;
          }
        } catch {
          // Keep filename-based sessionId as fallback
        }
      }
    }
    
    // Get gitBranch from the last line of the jsonl file
    // Branch info is stored in the last line by newer versions of Claude Code
    let gitBranch: string | null = null;
    try {
      const lastLine = lines[lines.length - 1];
      const lastData = JSON.parse(lastLine);
      if (lastData.gitBranch !== undefined) {
        // Preserve null/empty string values explicitly
        gitBranch = lastData.gitBranch === null || lastData.gitBranch === '' ? '-' : lastData.gitBranch;
      } else {
        gitBranch = '-';
      }
    } catch {
      gitBranch = '-';
    }
    
    return {
      sessionId,
      projectPath,
      projectName,
      gitBranch,
      messages,
      firstMessage: userMessages.length > 0 ? extractMessageText(userMessages[0].message?.content) : '',
      lastMessage: userMessages.length > 0 ? extractMessageText(userMessages[userMessages.length - 1].message?.content) : '',
      startTime,
      endTime
    };
  } catch (error) {
    console.error(`Error reading conversation file ${filePath}:`, error);
    return null;
  }
}

export function formatConversationSummary(conversation: Conversation): string {
  const firstMessagePreview = conversation.firstMessage
    .replace(/\n/g, ' ')
    .substring(0, 80)
    .trim();
    
  return `${firstMessagePreview}${conversation.firstMessage.length > 80 ? '...' : ''}`;
}