import { parse } from '@iarna/toml';
import { readFileSync, existsSync } from 'fs';
import { join, resolve, isAbsolute } from 'path';
import { homedir } from 'os';
import { Config, defaultConfig, KeyBindings } from '../types/config.js';

const CONFIG_FILE_NAME = 'config.toml';
const DEFAULT_CONFIG_DIR = 'ccresume';

/**
 * Sanitizes and validates a configuration directory path from environment variable.
 * @param dir - The directory path from environment variable
 * @returns Sanitized absolute path or null if invalid
 */
function sanitizeConfigDir(dir: string | undefined): string | null {
  if (!dir?.trim()) {
    return null;
  }

  // Remove leading/trailing whitespace and trailing slashes
  const sanitized = dir.trim().replace(/\/+$/, '');

  let absolutePath: string;
  if (!isAbsolute(sanitized)) {
    absolutePath = resolve(sanitized);
    console.warn(
      `Warning: ${sanitized} is not an absolute path. ` +
      `Using absolute path: ${absolutePath}`
    );
  } else {
    absolutePath = sanitized;
  }

  // Security: Validate that the resolved path doesn't traverse to sensitive directories
  const normalizedPath = resolve(absolutePath);

  // Block access to system directories (Unix and Windows)
  const blockedPaths = ['/etc', '/var', '/usr', '/bin', '/sbin', '/root', 'C:\\Windows', 'C:\\Program Files'];
  for (const blocked of blockedPaths) {
    if (normalizedPath.toLowerCase().startsWith(blocked.toLowerCase())) {
      console.warn(
        `Warning: Config path ${normalizedPath} points to a system directory. ` +
        `Using default config location.`
      );
      return null;
    }
  }

  // Also check for path traversal attempts (.. in the resolved path should be gone)
  if (normalizedPath.includes('..')) {
    console.warn(
      `Warning: Config path contains invalid path components. ` +
      `Using default config location.`
    );
    return null;
  }

  return normalizedPath;
}

/**
 * Validates XDG_CONFIG_HOME according to XDG Base Directory Specification.
 * XDG spec requires paths to be absolute; relative paths should be ignored.
 */
function validateXdgConfigHome(dir: string | undefined): string | null {
  if (!dir?.trim()) {
    return null;
  }

  const trimmed = dir.trim();

  // XDG spec: "All paths set in these environment variables must be absolute"
  if (!isAbsolute(trimmed)) {
    // According to XDG spec, ignore non-absolute paths
    return null;
  }

  // Apply same security checks as sanitizeConfigDir
  const normalizedPath = resolve(trimmed);
  const blockedPaths = ['/etc', '/var', '/usr', '/bin', '/sbin', '/root', 'C:\\Windows', 'C:\\Program Files'];
  for (const blocked of blockedPaths) {
    if (normalizedPath.toLowerCase().startsWith(blocked.toLowerCase())) {
      return null;
    }
  }

  return normalizedPath;
}

export function getConfigPath(): string {
  // Priority: CLAUDE_CONFIG_DIR > XDG_CONFIG_HOME/ccresume > ~/.config/ccresume
  const claudeConfigDir = sanitizeConfigDir(process.env.CLAUDE_CONFIG_DIR);
  if (claudeConfigDir) {
    return join(claudeConfigDir, CONFIG_FILE_NAME);
  }

  // Use XDG-compliant validation for XDG_CONFIG_HOME
  const xdgConfigHome = validateXdgConfigHome(process.env.XDG_CONFIG_HOME)
    || join(homedir(), '.config');
  return join(xdgConfigHome, DEFAULT_CONFIG_DIR, CONFIG_FILE_NAME);
}

export function loadConfig(): Config {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    return defaultConfig;
  }

  let tomlContent: string;
  try {
    tomlContent = readFileSync(configPath, 'utf-8');
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === 'EACCES') {
      console.error(`\n⚠️  Permission denied reading config file: ${configPath}`);
      console.error('   Please check file permissions.\n');
    } else if (nodeError.code === 'EISDIR') {
      console.error(`\n⚠️  Config path is a directory: ${configPath}`);
      console.error('   Expected a file.\n');
    } else {
      console.error(`\n⚠️  Failed to read config file ${configPath}:`, nodeError.message);
    }
    return defaultConfig;
  }

  try {
    const parsedConfig = parse(tomlContent) as Partial<Config>;

    // Merge with default config to ensure all keys exist
    const config = mergeConfigs(defaultConfig, parsedConfig);

    // Check for key conflicts and warn user
    const conflicts = checkKeyConflicts(config.keybindings);
    if (conflicts.length > 0) {
      console.error('\n⚠️  Key binding conflicts detected:');
      conflicts.forEach(conflict => console.error(`   - ${conflict}`));
      console.error('   Please update your config.toml to resolve conflicts.\n');
    }

    return config;
  } catch (error) {
    const parseError = error as Error;
    console.error(`\n⚠️  Failed to parse config file ${configPath}:`);
    console.error(`   ${parseError.message}`);
    console.error('   Please check your TOML syntax.\n');
    return defaultConfig;
  }
}

function mergeConfigs(defaultConf: Config, userConf: Partial<Config>): Config {
  const merged: Config = JSON.parse(JSON.stringify(defaultConf));

  // First, apply user configuration
  const userKeybindings = userConf.keybindings;
  if (userKeybindings) {
    Object.keys(userKeybindings).forEach((key) => {
      const bindingKey = key as keyof typeof userKeybindings;
      const userBinding = userKeybindings[bindingKey];
      if (userBinding) {
        merged.keybindings[bindingKey] = userBinding;
      }
    });
  }

  // Then migrate config with conflict detection based on the merged result
  return migrateConfig(merged, userConf);
}

function migrateConfig(config: Config, userConf: Partial<Config>): Config {
  // Only migrate if user hasn't explicitly configured startNewSession
  const userHasStartNewSession = userConf.keybindings && 'startNewSession' in userConf.keybindings;
  
  if (!userHasStartNewSession) {
    // Check if 'n' is already used by another keybinding
    const isNKeyUsed = isKeyAlreadyAssigned(config.keybindings, 'n');
    
    if (!isNKeyUsed) {
      // Only assign 'n' if it's not already in use
      config.keybindings.startNewSession = ['n'];
    } else {
      // If 'n' is taken, don't assign any default key
      // User must configure it manually in config.toml
      config.keybindings.startNewSession = [];
    }
  }
  
  return config;
}

function isKeyAlreadyAssigned(keybindings: KeyBindings, key: string): boolean {
  // Check all existing keybindings to see if the key is already used
  for (const [action, keys] of Object.entries(keybindings)) {
    if (action === 'startNewSession') continue; // Skip the key we're trying to add
    
    if (Array.isArray(keys) && keys.includes(key)) {
      return true;
    }
  }
  
  return false;
}

function checkKeyConflicts(keybindings: KeyBindings): string[] {
  const conflicts: string[] = [];
  const keyToActions = new Map<string, string[]>();
  
  // Build a map of key -> [actions]
  for (const [action, keys] of Object.entries(keybindings)) {
    if (!Array.isArray(keys)) continue;
    
    for (const key of keys) {
      if (!keyToActions.has(key)) {
        keyToActions.set(key, []);
      }
      keyToActions.get(key)!.push(action);
    }
  }
  
  // Find conflicts (keys assigned to multiple actions)
  for (const [key, actions] of keyToActions.entries()) {
    if (actions.length > 1) {
      conflicts.push(`Key '${key}' is assigned to multiple actions: ${actions.join(', ')}`);
    }
  }
  
  return conflicts;
}