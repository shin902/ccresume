import { jest } from '@jest/globals';
import { beforeEach, describe, expect, it } from '@jest/globals';

// Manual mocks
const mockExistsSync = jest.fn();
const mockReadFileSync = jest.fn();
const mockHomedir = jest.fn();

jest.unstable_mockModule('fs', () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
}));

jest.unstable_mockModule('os', () => ({
  homedir: mockHomedir,
}));

// Dynamic imports after mocking
const { getConfigPath, loadConfig } = await import('../utils/configLoader.js');
const { defaultConfig } = await import('../types/config.js');

describe('configLoader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.XDG_CONFIG_HOME;
    delete process.env.CLAUDE_CONFIG_DIR;
  });

  describe('getConfigPath', () => {
    it('should use CLAUDE_CONFIG_DIR when set', () => {
      process.env.CLAUDE_CONFIG_DIR = '/home/user/.config/claude';
      const path = getConfigPath();
      expect(path).toBe('/home/user/.config/claude/config.toml');
    });

    it('should prioritize CLAUDE_CONFIG_DIR over XDG_CONFIG_HOME', () => {
      process.env.CLAUDE_CONFIG_DIR = '/home/user/.config/claude';
      process.env.XDG_CONFIG_HOME = '/custom/config';
      const path = getConfigPath();
      expect(path).toBe('/home/user/.config/claude/config.toml');
    });

    it('should use XDG_CONFIG_HOME when set and CLAUDE_CONFIG_DIR is not set', () => {
      process.env.XDG_CONFIG_HOME = '/custom/config';
      const path = getConfigPath();
      expect(path).toBe('/custom/config/ccresume/config.toml');
    });

    it('should use ~/.config when XDG_CONFIG_HOME is not set', () => {
      mockHomedir.mockReturnValue('/home/user');
      const path = getConfigPath();
      expect(path).toBe('/home/user/.config/ccresume/config.toml');
    });

    it('should handle empty CLAUDE_CONFIG_DIR', () => {
      process.env.CLAUDE_CONFIG_DIR = '';
      mockHomedir.mockReturnValue('/home/user');
      const path = getConfigPath();
      // Should fallback to ~/.config
      expect(path).toBe('/home/user/.config/ccresume/config.toml');
    });

    it('should handle whitespace-only CLAUDE_CONFIG_DIR', () => {
      process.env.CLAUDE_CONFIG_DIR = '   ';
      mockHomedir.mockReturnValue('/home/user');
      const path = getConfigPath();
      // Should fallback to ~/.config
      expect(path).toBe('/home/user/.config/ccresume/config.toml');
    });

    it('should handle CLAUDE_CONFIG_DIR with trailing slash', () => {
      process.env.CLAUDE_CONFIG_DIR = '/home/user/.config/claude/';
      const path = getConfigPath();
      expect(path).toBe('/home/user/.config/claude/config.toml');
      // Path should not contain "//"
      expect(path).not.toContain('//');
    });

    it('should handle CLAUDE_CONFIG_DIR with spaces in path', () => {
      process.env.CLAUDE_CONFIG_DIR = '/home/user/My Documents/claude';
      const path = getConfigPath();
      expect(path).toBe('/home/user/My Documents/claude/config.toml');
    });

    it('should handle relative paths in CLAUDE_CONFIG_DIR', () => {
      process.env.CLAUDE_CONFIG_DIR = './config';

      // Mock console.warn to suppress warning output in test
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const path = getConfigPath();

      // Should convert to absolute path
      expect(path).toContain('config.toml');
      expect(path.startsWith('/')).toBe(true);

      // Should have warned the user
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('is not an absolute path')
      );

      consoleWarnSpy.mockRestore();
    });

    it('should handle empty XDG_CONFIG_HOME', () => {
      process.env.XDG_CONFIG_HOME = '';
      mockHomedir.mockReturnValue('/home/user');
      const path = getConfigPath();
      // Should fallback to ~/.config
      expect(path).toBe('/home/user/.config/ccresume/config.toml');
    });

    it('should handle XDG_CONFIG_HOME with trailing slash', () => {
      process.env.XDG_CONFIG_HOME = '/custom/config/';
      const path = getConfigPath();
      expect(path).toBe('/custom/config/ccresume/config.toml');
      // Path should not contain "//"
      expect(path).not.toContain('//');
    });
  });

  describe('loadConfig', () => {
    it('should return default config when config file does not exist', () => {
      mockHomedir.mockReturnValue('/home/user');
      mockExistsSync.mockReturnValue(false);
      
      const config = loadConfig();
      expect(config).toEqual(defaultConfig);
    });

    it('should load and parse config file when it exists', () => {
      mockHomedir.mockReturnValue('/home/user');
      mockExistsSync.mockReturnValue(true);
      
      const tomlContent = `
[keybindings]
quit = ["q", "ctrl+c"]
selectPrevious = ["up"]
selectNext = ["down"]
      `;
      mockReadFileSync.mockReturnValue(tomlContent);
      
      const config = loadConfig();
      expect(config.keybindings.quit).toEqual(['q', 'ctrl+c']);
      expect(config.keybindings.selectPrevious).toEqual(['up']);
      expect(config.keybindings.selectNext).toEqual(['down']);
      // Other keybindings should still have default values
      expect(config.keybindings.confirm).toEqual(defaultConfig.keybindings.confirm);
    });

    it('should merge partial config with defaults', () => {
      mockHomedir.mockReturnValue('/home/user');
      mockExistsSync.mockReturnValue(true);
      
      const tomlContent = `
[keybindings]
quit = ["esc"]
      `;
      mockReadFileSync.mockReturnValue(tomlContent);
      
      const config = loadConfig();
      expect(config.keybindings.quit).toEqual(['esc']);
      // All other keybindings should have default values
      expect(config.keybindings.selectPrevious).toEqual(defaultConfig.keybindings.selectPrevious);
      expect(config.keybindings.selectNext).toEqual(defaultConfig.keybindings.selectNext);
    });

    it('should return default config on parse error', () => {
      mockHomedir.mockReturnValue('/home/user');
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('invalid toml content {{{');
      
      // Mock console.error to suppress error output in test
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const config = loadConfig();
      expect(config).toEqual(defaultConfig);
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
    });

    it('should handle file read errors gracefully', () => {
      mockHomedir.mockReturnValue('/home/user');
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });
      
      // Mock console.error to suppress error output in test
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const config = loadConfig();
      expect(config).toEqual(defaultConfig);
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
    });
  });
});