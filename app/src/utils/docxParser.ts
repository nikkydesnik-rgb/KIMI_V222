import PizZip from 'pizzip';
import { debugLogger } from './debug';

/**
 * Convert key to snake_case format (100% reliable in DOCX)
 * Example: "Объект строительства" -> "Объект_строительства"
 */
export function toSnakeCase(key: string): string {
  return key
    .trim()
    .replace(/\s+/g, '_')           // spaces -> underscores
    .replace(/[<>{}]/g, '')          // remove brackets
    .replace(/_{2,}/g, '_');         // collapse multiple underscores
}

/**
 * Normalize key for display (keep original but trimmed)
 */
function normalizeKey(key: string): string {
  return key.replace(/\s+/g, ' ').trim();
}

/**
 * Check if a string looks like a template key (has letters)
 */
function isValidKey(key: string): boolean {
  return /[а-яёa-z]/i.test(key) && key.length > 0;
}

/**
 * Extract all text content from DOCX XML files - reads ALL word/*.xml files
 * including document.xml, headers, footers, and tables
 */
function extractTextFromAllXMLFiles(zip: InstanceType<typeof PizZip>): string {
  const allTexts: string[] = [];
  
  for (const fileName of Object.keys(zip.files)) {
    if (
      fileName.startsWith('word/') &&
      (fileName.endsWith('.xml') || fileName.includes('.xml.'))
    ) {
      try {
        const content = zip.files[fileName].asText() || '';
        allTexts.push(content);
      } catch {
        // Skip files that can't be read as text
      }
    }
  }
  
  return allTexts.join('\n');
}

/**
 * Smart extraction of keys from DOCX XML.
 * 
 * THE PROBLEM: In DOCX, a key like {{object}} can be split across multiple <w:t> tags:
 *   <w:t>{{</w:t>...<w:t>object</w:t>...<w:t>}}</w:t>
 * 
 * THE SOLUTION: Join all <w:t> content in document order, then search for patterns.
 * This handles keys even when Word splits them across runs.
 */
function extractKeysSmart(xmlContent: string): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();

  // Extract all <w:t> text content in document order
  const textParts: string[] = [];
  const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let m;
  while ((m = tRegex.exec(xmlContent)) !== null) {
    textParts.push(m[1]);
  }
  
  // Join all text parts to reconstruct potentially split keys
  const fullText = textParts.join('');
  
  // Find {{key}} patterns - supports spaces inside
  const curlyRegex = /\{\{\s*([^}]+?)\s*\}\}/g;
  let match;
  while ((match = curlyRegex.exec(fullText)) !== null) {
    const key = normalizeKey(match[1]);
    if (isValidKey(key) && !seen.has(key.toLowerCase())) {
      seen.add(key.toLowerCase());
      keys.push(key);
    }
  }
  
  // Find <key> patterns (angle brackets) - supports spaces inside
  const angleRegex = /<\s*([^>]+?)\s*>/g;
  while ((match = angleRegex.exec(fullText)) !== null) {
    const key = normalizeKey(match[1]);
    if (isValidKey(key) && !seen.has(key.toLowerCase())) {
      seen.add(key.toLowerCase());
      keys.push(key);
    }
  }

  return keys;
}

/**
 * Merge key arrays, removing duplicates (case-insensitive)
 */
function mergeUniqueKeys(keys: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  
  for (const key of keys) {
    const normalized = key.toLowerCase().trim();
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(key.trim());
    }
  }
  
  return result;
}

/**
 * Extract keys from DOCX template.
 * 
 * Uses smart XML parsing that handles keys split across multiple <w:t> elements.
 * This is necessary because Word can split text like {{key}} into separate runs:
 *   <w:t>{{</w:t> + <w:t>key</w:t> + <w:t>}}</w:t>
 * 
 * Supports both formats: {{key}} and <key>
 * Works with keys inside tables, headers, footers.
 */
export function extractKeysFromDocx(arrayBuffer: ArrayBuffer): string[] {
  try {
    debugLogger.info('docxParser', 'Starting key extraction from DOCX');

    const zip = new PizZip(arrayBuffer);
    const allXmlText = extractTextFromAllXMLFiles(zip);
    
    // Use smart extraction
    const keys = extractKeysSmart(allXmlText);
    
    debugLogger.success('docxParser', `Extracted ${keys.length} unique keys`, keys);
    return keys;
  } catch (error) {
    debugLogger.error('docxParser', 'Error parsing DOCX', error);
    console.error('Error parsing DOCX:', error);
    return [];
  }
}

/**
 * Fill DOCX template with data using SMART XML REPLACEMENT.
 * 
 * THE PROBLEM: Word splits keys like {{key}} across multiple <w:t> elements.
 * Simple regex replacement on the entire XML doesn't work because the key
 * is fragmented across XML tags.
 * 
 * THE SOLUTION: We use a run-aware replacement that:
 * 1. Identifies sequences of <w:t> elements that together form {{key}}
 * 2. Replaces the ENTIRE sequence with a single <w:t> containing the value
 * 3. Cleans up empty runs
 * 
 * This handles keys in tables, headers, footers, and regular paragraphs.
 * 
 * For 100% reliability, use snake_case keys without spaces:
 *   ✅ {{Объект_строительства}}
 *   ⚠️ {{Объект строительства}} - may be split by Word
 */
export function fillDocxTemplate(
  arrayBuffer: ArrayBuffer,
  data: Record<string, string>
): ArrayBuffer {
  try {
    if (!isZipBuffer(arrayBuffer)) {
      throw new Error('Template is not a valid DOCX ZIP (missing PK signature)');
    }

    debugLogger.info('docxParser', 'Starting template fill', { 
      dataKeys: Object.keys(data),
    });

    const zip = new PizZip(arrayBuffer);
    
    // Clean data - remove empty values but keep keys
    const cleanData: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null) {
        cleanData[key.trim()] = String(value);
      }
    }

    // Get all XML files in the DOCX
    const xmlFiles = Object.keys(zip.files).filter(
      name => name.endsWith('.xml') && (name.startsWith('word/') || name === '[Content_Types].xml')
    );

    debugLogger.info('docxParser', `Processing ${xmlFiles.length} XML files`);

    let totalReplacements = 0;

    // Process each XML file
    for (const fileName of xmlFiles) {
      const file = zip.files[fileName];
      if (!file) continue;

      let content = file.asText();
      if (!content) continue;

      // Apply smart replacement for each key
      let fileReplacements = 0;
      
      for (const [key, value] of Object.entries(cleanData)) {
        // Try smart replacement first (handles split keys)
        const smartResult = smartReplaceInXML(content, key, value);
        if (smartResult.replacements > 0) {
          content = smartResult.content;
          fileReplacements += smartResult.replacements;
          debugLogger.info('docxParser', `Smart replaced "${key}" (${smartResult.replacements}x) in ${fileName}`);
        } else {
          // Fallback: try direct regex replacement
          const escapedKey = escapeRegExp(key);
          
          // Pattern: {{ key }} with possible spaces
          const curlyPattern = new RegExp('\\{\\{\\s*' + escapedKey + '\\s*\\}\\}', 'g');
          const curlyMatches = content.match(curlyPattern);
          if (curlyMatches) {
            content = content.replace(curlyPattern, escapeXml(value));
            fileReplacements += curlyMatches.length;
            debugLogger.info('docxParser', `Regex replaced {{${key}}} (${curlyMatches.length}x) in ${fileName}`);
          }

          // Pattern: < key > with possible spaces
          const anglePattern = new RegExp('<\\s*' + escapedKey + '\\s*>', 'gi');
          const angleMatches = content.match(anglePattern);
          if (angleMatches) {
            content = content.replace(anglePattern, escapeXml(value));
            fileReplacements += angleMatches.length;
            debugLogger.info('docxParser', `Regex replaced <${key}> (${angleMatches.length}x) in ${fileName}`);
          }
        }
      }

      if (fileReplacements > 0) {
        zip.file(fileName, content);
        totalReplacements += fileReplacements;
        debugLogger.info('docxParser', `Modified ${fileName}: ${fileReplacements} replacements`);
      }
    }

    // Generate result
    const result = zip.generate({
      type: 'arraybuffer',
      compression: 'DEFLATE',
    });

    debugLogger.success('docxParser', `Template filled: ${totalReplacements} total replacements`);
    return result;
  } catch (error) {
    debugLogger.error('docxParser', 'Error filling template', error);
    console.error('[DOCX] Error filling template:', error);
    throw error instanceof Error
      ? error
      : new Error('Failed to fill DOCX template');
  }
}

function isZipBuffer(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer);
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

/**
 * Smart XML replacement that handles keys split across multiple <w:t> elements.
 * 
 * This function finds sequences of <w:r> elements where the <w:t> contents
 * together form a complete key like {{key}}, and replaces the entire sequence
 * with a single <w:r> containing the replacement value.
 * 
 * Example input XML:
 *   <w:r><w:t>{{</w:t></w:r><w:r><w:t>Объект</w:t></w:r><w:r><w:t>_строитель</w:t></w:r><w:r><w:t>ства}}</w:t></w:r>
 * 
 * Output:
 *   <w:r><w:t>Значение объекта</w:t></w:r>
 */
function smartReplaceInXML(xmlContent: string, key: string, value: string): { content: string; replacements: number } {
  let replacements = 0;
  let content = xmlContent;
  
  // Build possible patterns for this key
  const keyVariants = [
    `{{${key}}}`,       // {{key}}
    `{{ ${key} }}`,     // {{ key }}
    `{{${key} }}`,      // {{key }}
    `{{ ${key}}}`,      // {{ key}}
    `<${key}>`,         // <key>
    `< ${key} >`,       // < key >
  ];
  
  // Escape the key for regex (but handle the fact that XML tags may split it)
  // We search for the literal key pattern in the joined text of <w:t> elements
  
  for (const variant of keyVariants) {
    // Build a regex that matches the variant potentially split across <w:t> tags
    // We match the variant character by character, allowing XML tags between characters
    const chars = variant.split('');
    const charPatterns = chars.map(c => {
      if (c === ' ') {
        // Space can be inside <w:t> or between runs
        return '(?:\\s|<[^>]+>)*';
      }
      // Each character can be inside <w:t>...</w:t> with optional XML between
      return `(?:[^<]*<[^/][^>]*>)*[^<]*${escapeRegExp(c)}[^<]*(?:<\\/[^>]+>[^<]*)*`;
    });
    
    // This approach is too complex. Let's use a simpler but effective approach:
    // Find all <w:t> elements, collect their positions, and check if consecutive
    // elements form the key pattern.
    
    const result = replaceSplitKey(content, variant, value);
    if (result.replacements > 0) {
      content = result.content;
      replacements += result.replacements;
    }
  }
  
  return { content, replacements };
}

/**
 * Replace a key that may be split across multiple <w:t> elements.
 * 
 * Algorithm:
 * 1. Find all <w:t> elements with their positions
 * 2. Check consecutive sequences to see if they form the key pattern
 * 3. Replace the entire <w:r>...</w:r> sequence for matching elements
 */
function replaceSplitKey(xmlContent: string, keyPattern: string, value: string): { content: string; replacements: number } {
  let replacements = 0;
  let content = xmlContent;
  
  // Extract all <w:t> elements with their full context (including surrounding <w:r>)
  const runRegex = /<w:r(?:\s+[^>]*)?>([\s\S]*?<w:t(?:\s+[^>]*)?>[^<]*<\/w:t>[\s\S]*?)<\/w:r>/g;
  
  type RunInfo = {
    fullMatch: string;
    textContent: string;
    index: number;
  };
  
  const runs: RunInfo[] = [];
  let match;
  while ((match = runRegex.exec(xmlContent)) !== null) {
    const textMatch = match[1].match(/<w:t(?:\s+[^>]*)?>([^<]*)<\/w:t>/);
    if (textMatch) {
      runs.push({
        fullMatch: match[0],
        textContent: textMatch[1],
        index: match.index,
      });
    }
  }
  
  // Search for consecutive runs whose text content joins to form the key pattern
  const keyChars = keyPattern.split('');
  
  for (let i = 0; i < runs.length; i++) {
    let collectedText = '';
    let endIndex = i;
    
    for (let j = i; j < runs.length && j < i + 20; j++) { // Limit search to 20 consecutive runs
      collectedText += runs[j].textContent;
      
      if (collectedText === keyPattern) {
        // Found a match! Replace the entire sequence
        const firstRun = runs[i];
        const lastRun = runs[j];
        
        // Find the actual substring in the original content
        const startPos = firstRun.index;
        const endPos = lastRun.index + lastRun.fullMatch.length;
        const sequenceToReplace = content.substring(startPos, endPos);
        
        // Build replacement: a single run with the value
        // Extract run properties (formatting) from the first run
        const rpMatch = sequenceToReplace.match(/<w:rPr>[\s\S]*?<\/w:rPr>/);
        const runProps = rpMatch ? rpMatch[0] : '';
        
        const replacement = `<w:r>${runProps}<w:t>${escapeXml(value)}</w:t></w:r>`;
        
        // Replace in content
        content = content.substring(0, startPos) + replacement + content.substring(endPos);
        
        // Adjust indices for subsequent runs
        const lengthDiff = replacement.length - sequenceToReplace.length;
        for (let k = j + 1; k < runs.length; k++) {
          runs[k].index += lengthDiff;
        }
        
        replacements++;
        
        // Update regex lastIndex since we modified the string
        runRegex.lastIndex = startPos + replacement.length;
        
        // Reset i since we modified the content
        i = -1;
        break;
      }
      
      // Early termination: if collected text is longer than key, stop
      if (collectedText.length > keyPattern.length) {
        break;
      }
    }
  }
  
  return { content, replacements };
}

/**
 * Escape special regex characters
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Convert ArrayBuffer to Base64 string
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert Base64 string to ArrayBuffer
 */
export function base64ToArrayBuffer(base64: unknown): ArrayBuffer {
  // Already binary
  if (base64 instanceof ArrayBuffer) {
    return base64;
  }

  if (ArrayBuffer.isView(base64)) {
    const view = base64 as ArrayBufferView;
    return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
  }

  // Legacy shapes from persisted JSON:
  // 1) Buffer-like: { type: "Buffer", data: number[] }
  // 2) Array of byte numbers
  // 3) Object with numeric keys: { "0": 80, "1": 75, ... }
  if (Array.isArray(base64)) {
    return Uint8Array.from(base64 as number[]).buffer;
  }

  if (base64 && typeof base64 === 'object') {
    const maybeBuffer = base64 as { type?: string; data?: number[] };
    if (maybeBuffer.type === 'Buffer' && Array.isArray(maybeBuffer.data)) {
      return Uint8Array.from(maybeBuffer.data).buffer;
    }

    const numericEntries = Object.entries(base64 as Record<string, unknown>)
      .filter(([k, v]) => /^\d+$/.test(k) && typeof v === 'number')
      .sort((a, b) => Number(a[0]) - Number(b[0]));

    if (numericEntries.length > 0) {
      return Uint8Array.from(numericEntries.map(([, v]) => Number(v))).buffer;
    }
  }

  // Backward compatibility:
  // - raw base64: "UEsDB..."
  // - data URL: "data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,UEsDB..."
  // - base64 with spaces/newlines from copied values
  let normalized = String(base64 || '').trim();

  // Sometimes value is accidentally stored as JSON stringified bytes
  if ((normalized.startsWith('{') && normalized.endsWith('}')) || (normalized.startsWith('[') && normalized.endsWith(']'))) {
    try {
      return base64ToArrayBuffer(JSON.parse(normalized));
    } catch {
      // Continue as plain string
    }
  }

  const dataUrlMatch = normalized.match(/^data:.*?;base64,(.*)$/i);
  if (dataUrlMatch) {
    normalized = dataUrlMatch[1];
  }

  // Remove whitespace that may appear after serialization/copying
  normalized = normalized.replace(/\s+/g, '');

  // Support URL-safe base64 variants
  normalized = normalized.replace(/-/g, '+').replace(/_/g, '/');

  // Ensure correct padding
  const padding = normalized.length % 4;
  if (padding > 0) {
    normalized += '='.repeat(4 - padding);
  }

  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// ==================== AOSR-specific helpers ====================

/**
 * Get AOSR-specific keys that should NOT appear in Permanent Data tab
 */
export function getAOSRExcludedKeys(): string[] {
  return [
    'номер акта',
    'наименование работ',
    'материалы',
    'приложения',
    'сп',
    'разрешает производство работ',
    'чн',
    'мн',
    'гн',
    'чк',
    'мк',
    'гк',
  ];
}

/**
 * Get all date-related keys for AOSR
 */
export function getAOSRDateKeys(): string[] {
  return ['чн', 'мн', 'гн', 'чк', 'мк', 'гк'];
}

/**
 * Check if a key is an AOSR-specific key (should not show in Permanent Data)
 */
export function isAOSRKey(key: string): boolean {
  const lowerKey = key.toLowerCase().trim();
  const excludedKeys = getAOSRExcludedKeys();
  const dateKeys = getAOSRDateKeys();
  return excludedKeys.includes(lowerKey) || dateKeys.includes(lowerKey);
}

/**
 * Get key hints/tooltips for AOSR keys
 */
export function getKeyHint(key: string): string {
  const hints: Record<string, string> = {
    'объект строительства': 'Объект капитального строительства',
    'объект_строительства': 'Объект капитального строительства',
    'организация - застройщик': 'Застройщик, технический заказчик',
    'организация_-_застройщик': 'Застройщик, технический заказчик',
    'информация по застройщику': 'Информация по организации застройщика',
    'организация - строитель': 'Организация, выполняющая строительство',
    'организация_-_строитель': 'Организация, выполняющая строительство',
    'информация по строителю': 'Информация по организации строителя',
    'организация - проектировщик': 'Организация, выполнившая проектную документацию',
    'организация_-_проектировщик': 'Организация, выполнившая проектную документацию',
    'информация по проектировщику': 'Информация по организации проектировщика',
    'должн. предст. застройщика': 'Должность представителя застройщика',
    'фио застройщика': 'ФИО представителя застройщика',
    'расп. застройщик': 'Распоряжение представителя застройщика',
    'должн. предст. строителя': 'Должность представителя строителя',
    'фио строителя': 'ФИО представителя строителя',
    'расп. строитель': 'Распоряжение представителя строителя',
    'должн. предст. стр стройконтроль': 'Должность представителя по стройконтролю',
    'фио стр стройконтроль': 'ФИО представителя по стройконтролю',
    'расп. стр стройконтроль': 'Распоряжение представителя по стройконтролю',
    'должн. предст. проектировщ.': 'Должность представителя проектировщика',
    'фио предст. проект.': 'ФИО представителя проектировщика',
    'расп. предст. проект.': 'Распоряжение представителя проектировщика',
    'должность субподр': 'Должность субподрядчика',
    'фио субподр': 'ФИО субподрядчика',
    'организация выполнившая работы': 'Организация, выполнившая работы',
    'организация_выполнившая_работы': 'Организация, выполнившая работы',
    'шифр проектной документации': 'Шифр проектной документации',
    'шифр_проектной_документации': 'Шифр проектной документации',
    'экз': 'Количество экземпляров акта',
  };

  return hints[key.toLowerCase().trim()] || '';
}

/**
 * Format material string for act
 */
export function formatMaterialForAct(
  material: {
    name: string;
    quantity: string;
    unit: string;
    qualityDoc: string;
    expiryDate: string;
  },
  includeDocs: boolean
): string {
  const base = `${material.name} - ${material.quantity} ${material.unit}`;

  if (!includeDocs || !material.qualityDoc.trim()) {
    return base;
  }

  const lowerDoc = material.qualityDoc.toLowerCase();
  const prefix = lowerDoc.includes('паспорт') ? 'от' : 'с/д';

  let docInfo = material.qualityDoc;
  if (material.expiryDate) {
    docInfo += ` ${prefix} ${material.expiryDate}`;
  }

  return `${base}, ${docInfo}`;
}

/**
 * Format SP rule string for act
 */
export function formatSPRuleForAct(spNumber: string, spName: string): string {
  return `СП ${spNumber} ${spName}`;
}

/**
 * Validate that all template keys have corresponding data values
 */
export function validateTemplateData(
  templateKeys: string[],
  data: Record<string, string>
): {
  missing: string[];
  filled: string[];
  empty: string[];
} {
  const missing: string[] = [];
  const filled: string[] = [];
  const empty: string[] = [];

  for (const key of templateKeys) {
    const value = data[key];
    if (value === undefined) {
      missing.push(key);
    } else if (value.trim() === '') {
      empty.push(key);
    } else {
      filled.push(key);
    }
  }

  return { missing, filled, empty };
}
