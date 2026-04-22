/**
 * Debug utilities for ID documentation system
 */

export interface DebugLog {
  timestamp: string;
  type: 'info' | 'warning' | 'error' | 'success';
  module: string;
  message: string;
  data?: unknown;
}

class DebugLogger {
  private logs: DebugLog[] = [];
  private enabled: boolean = true;
  private maxLogs: number = 100;

  constructor() {
    // Check if debug mode is enabled via localStorage
    const debugMode = localStorage.getItem('id_debug_mode');
    this.enabled = debugMode === 'true' || import.meta.env.DEV;
  }

  private getTimestamp(): string {
    return new Date().toLocaleTimeString('ru-RU') + '.' + new Date().getMilliseconds();
  }

  private addLog(type: DebugLog['type'], module: string, message: string, data?: unknown) {
    const log: DebugLog = {
      timestamp: this.getTimestamp(),
      type,
      module,
      message,
      data,
    };

    this.logs.push(log);
    
    // Keep only last N logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console output
    if (this.enabled) {
      const prefix = `[ID-DEBUG][${log.timestamp}][${module}]`;
      
      switch (type) {
        case 'error':
          console.error(prefix, message, data ?? '');
          break;
        case 'warning':
          console.warn(prefix, message, data ?? '');
          break;
        case 'success':
          console.log(`%c${prefix} ${message}`, 'color: green', data ?? '');
          break;
        default:
          console.log(prefix, message, data ?? '');
      }
    }
  }

  info(module: string, message: string, data?: unknown) {
    this.addLog('info', module, message, data);
  }

  warn(module: string, message: string, data?: unknown) {
    this.addLog('warning', module, message, data);
  }

  error(module: string, message: string, data?: unknown) {
    this.addLog('error', module, message, data);
  }

  success(module: string, message: string, data?: unknown) {
    this.addLog('success', module, message, data);
  }

  getLogs(): DebugLog[] {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
  }

  enable() {
    this.enabled = true;
    localStorage.setItem('id_debug_mode', 'true');
    console.log('[ID-DEBUG] Debug mode enabled');
  }

  disable() {
    this.enabled = false;
    localStorage.setItem('id_debug_mode', 'false');
    console.log('[ID-DEBUG] Debug mode disabled');
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  downloadLogs() {
    const content = this.exportLogs();
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `id-debug-logs-${new Date().toISOString().slice(0, 19)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

export const debugLogger = new DebugLogger();

/**
 * Validate date range
 */
export function validateDateRange(start: string, end: string): { valid: boolean; error?: string } {
  if (!start || !end) {
    return { valid: false, error: 'Даты начала и окончания должны быть заполнены' };
  }

  const startDate = new Date(start);
  const endDate = new Date(end);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return { valid: false, error: 'Некорректный формат даты' };
  }

  if (endDate < startDate) {
    return { valid: false, error: 'Дата окончания не может быть раньше даты начала' };
  }

  return { valid: true };
}

/**
 * Validate template keys match data keys
 */
export function validateTemplateKeys(
  templateKeys: string[],
  dataKeys: string[]
): { missing: string[]; unused: string[]; matched: string[] } {
  const normalizedTemplateKeys = templateKeys.map(k => k.toLowerCase().trim());
  const normalizedDataKeys = dataKeys.map(k => k.toLowerCase().trim());

  const missing: string[] = [];
  const matched: string[] = [];

  for (const tKey of normalizedTemplateKeys) {
    const found = normalizedDataKeys.find(dKey => dKey === tKey);
    if (found) {
      matched.push(tKey);
    } else {
      missing.push(tKey);
    }
  }

  const unused = normalizedDataKeys.filter(k => !normalizedTemplateKeys.includes(k));

  return { missing, unused, matched };
}

/**
 * Check if value is serializable to JSON (for File objects etc.)
 */
export function isSerializable(value: unknown): boolean {
  try {
    JSON.stringify(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get storage usage info
 */
export function getStorageInfo() {
  let localStorageSize = 0;
  let itemCount = 0;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const value = localStorage.getItem(key) || '';
      localStorageSize += key.length + value.length;
      itemCount++;
    }
  }

  return {
    localStorageSize: Math.round(localStorageSize / 1024), // KB
    itemCount,
    debugMode: debugLogger.isEnabled(),
  };
}

/**
 * Enable debug mode in browser console:
 * window.IDDebug.enable()
 * 
 * Disable:
 * window.IDDebug.disable()
 * 
 * View logs:
 * window.IDDebug.getLogs()
 * 
 * Download logs:
 * window.IDDebug.downloadLogs()
 */
if (typeof window !== 'undefined') {
  (window as any).IDDebug = {
    enable: () => debugLogger.enable(),
    disable: () => debugLogger.disable(),
    getLogs: () => debugLogger.getLogs(),
    clearLogs: () => debugLogger.clearLogs(),
    exportLogs: () => debugLogger.exportLogs(),
    downloadLogs: () => debugLogger.downloadLogs(),
    getInfo: getStorageInfo,
    validateDateRange,
    validateTemplateKeys,
  };

  console.log('%c[ID-DEBUG] DevTools available: window.IDDebug', 'color: blue; font-weight: bold');
}
