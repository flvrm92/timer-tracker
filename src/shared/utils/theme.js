// Theme management utilities

const THEME_KEY = 'timer-tracker-theme';
const THEME_ATTRIBUTE = 'data-theme';

// Theme types
const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system'
};

// Theme management class
class ThemeManager {
  constructor() {
    this.currentTheme = this.getStoredTheme() || THEMES.SYSTEM;
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.listeners = new Set();

    // Initialize theme
    this.applyTheme(this.currentTheme);

    // Listen for system theme changes
    this.mediaQuery.addListener(this.handleSystemThemeChange.bind(this));
  }

  // Get stored theme preference
  getStoredTheme() {
    try {
      return localStorage.getItem(THEME_KEY);
    } catch (error) {
      console.warn('Failed to read theme from localStorage:', error);
      return null;
    }
  }

  // Store theme preference
  setStoredTheme(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (error) {
      console.warn('Failed to store theme in localStorage:', error);
    }
  }

  // Get the effective theme (resolving 'system' to 'light' or 'dark')
  getEffectiveTheme(theme = this.currentTheme) {
    if (theme === THEMES.SYSTEM) {
      return this.mediaQuery.matches ? THEMES.DARK : THEMES.LIGHT;
    }
    return theme;
  }

  // Apply theme to document
  applyTheme(theme) {
    const effectiveTheme = this.getEffectiveTheme(theme);
    const html = document.documentElement;

    // Remove existing theme attributes
    html.removeAttribute(THEME_ATTRIBUTE);

    // Apply new theme
    if (effectiveTheme === THEMES.DARK) {
      html.setAttribute(THEME_ATTRIBUTE, THEMES.DARK);
    }
    // Light theme is the default, no attribute needed

    // Store the preference
    this.setStoredTheme(theme);
    this.currentTheme = theme;

    // Notify listeners
    this.notifyListeners(theme, effectiveTheme);
  }

  // Set theme
  setTheme(theme) {
    if (!Object.values(THEMES).includes(theme)) {
      console.warn(`Invalid theme: ${theme}`);
      return;
    }

    this.applyTheme(theme);
  }

  // Get current theme
  getTheme() {
    return this.currentTheme;
  }

  // Toggle between light and dark themes
  toggleTheme() {
    const effectiveTheme = this.getEffectiveTheme();
    const newTheme = effectiveTheme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
    this.setTheme(newTheme);
    return newTheme;
  }

  // Handle system theme changes
  handleSystemThemeChange() {
    if (this.currentTheme === THEMES.SYSTEM) {
      this.applyTheme(THEMES.SYSTEM);
    }
  }

  // Add change listener
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Notify all listeners
  notifyListeners(theme, effectiveTheme) {
    this.listeners.forEach(callback => {
      try {
        callback(theme, effectiveTheme);
      } catch (error) {
        console.error('Theme listener error:', error);
      }
    });
  }

  // Get theme display name
  getThemeDisplayName(theme = this.currentTheme) {
    switch (theme) {
      case THEMES.LIGHT:
        return 'Light';
      case THEMES.DARK:
        return 'Dark';
      case THEMES.SYSTEM:
        return 'System';
      default:
        return 'Unknown';
    }
  }

  // Check if current effective theme is dark
  isDark() {
    return this.getEffectiveTheme() === THEMES.DARK;
  }

  // Check if current effective theme is light
  isLight() {
    return this.getEffectiveTheme() === THEMES.LIGHT;
  }
}

// Theme integration with Electron's nativeTheme
class ElectronThemeManager extends ThemeManager {
  constructor() {
    super();

    // If running in Electron, integrate with nativeTheme
    if (window.darkMode) {
      this.hasElectronIntegration = true;
    }
  }

  async applyTheme(theme) {
    // Apply theme locally first
    super.applyTheme(theme);

    // Sync with Electron's nativeTheme if available
    if (this.hasElectronIntegration) {
      try {
        switch (theme) {
          case THEMES.LIGHT:
            // Force light theme in Electron
            await window.darkMode.setTheme('light');
            break;
          case THEMES.DARK:
            // Force dark theme in Electron
            await window.darkMode.setTheme('dark');
            break;
          case THEMES.SYSTEM:
            // Use system theme in Electron
            await window.darkMode.system();
            break;
        }
      } catch (error) {
        console.warn('Failed to sync theme with Electron:', error);
      }
    }
  }

  async toggleTheme() {
    const currentEffective = this.getEffectiveTheme();
    const newTheme = currentEffective === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
    await this.applyTheme(newTheme);
    return newTheme;
  }
}

// Utility functions for manual theme management
function initializeTheme() {
  // Check if we're in an Electron environment
  const isElectron = window.darkMode !== undefined;

  if (isElectron) {
    return new ElectronThemeManager();
  } else {
    return new ThemeManager();
  }
}

// Create and export singleton instance
let themeManager = null;

function getThemeManager() {
  if (!themeManager) {
    themeManager = initializeTheme();
  }
  return themeManager;
}

// Simple functions for common operations
function setTheme(theme) {
  return getThemeManager().setTheme(theme);
}

function getTheme() {
  return getThemeManager().getTheme();
}

function toggleTheme() {
  return getThemeManager().toggleTheme();
}

function addThemeListener(callback) {
  return getThemeManager().addListener(callback);
}

function isDarkTheme() {
  return getThemeManager().isDark();
}

function isLightTheme() {
  return getThemeManager().isLight();
}

// Make available globally
if (typeof window !== 'undefined') {
  window.ThemeUtils = {
    THEMES,
    ThemeManager,
    ElectronThemeManager,
    getThemeManager,
    setTheme,
    getTheme,
    toggleTheme,
    addThemeListener,
    isDarkTheme,
    isLightTheme
  };
}

// Node.js export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    THEMES,
    ThemeManager,
    ElectronThemeManager,
    getThemeManager,
    setTheme,
    getTheme,
    toggleTheme,
    addThemeListener,
    isDarkTheme,
    isLightTheme
  };
}
