import PizZip from 'pizzip';
import { debugLogger } from './debug';

/**
 * Extract all text content from DOCX XML files - including tables
 */
function extractAllTextFromXML(zip: InstanceType<typeof PizZip>): string {
  const textParts: string[] = [];
  const files = zip.files;

  for (const fileName of Object.keys(files)) {
    if (
      fileName.startsWith('word/') &&
      (fileName.endsWith('.xml') || fileName.includes('.xml.'))
    ) {
      const content = files[fileName].asText() || '';
      
      // Extract text from <w:t> tags (normal text)
      const textRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
      let match;
      while ((match = textRegex.exec(content)) !== null) {
        textParts.push(match[1]);
      }
      
      // Also look for keys in table cells and other structures
      // Keys might be split across multiple w:t tags
      const fullContent = content.replace(/<[^>]+>/g, ' ');
      textParts.push(fullContent);
    }
  }

  return textParts.join(' ');
}

/**
 * Normalize key by trimming spaces inside brackets
 */
function normalizeKey(key: string): string {
  return key.replace(/\s+/g, ' ').trim();
}

/**
 * Extract keys from DOCX supporting both formats:
 * - {{key}}
 * - <key>
 */
export function extractKeysFromDocx(arrayBuffer: ArrayBuffer): string[] {
  try {
    const zip = new PizZip(arrayBuffer);
    const xmlText = extractAllTextFromXML(zip);

    debugLogger.info('docxParser', 'Extracting keys from DOCX', { textLength: xmlText.length });

    const keys: string[] = [];
    const found = new Set<string>();

    const curlyPattern = /\{\{\s*([^}]+?)\s*\}\}/g;
    const anglePattern = /<([а-яёa-z][^<>]*?)>/gi;

    let match;

    while ((match = curlyPattern.exec(xmlText)) !== null) {
      const key = normalizeKey(match[1]);
      if (key && !found.has(key)) {
        found.add(key);
        keys.push(key);
        debugLogger.info('docxParser', `Found curly key: ${key}`);
      }
    }

    while ((match = anglePattern.exec(xmlText)) !== null) {
      const key = normalizeKey(match[1]);
      if (key && !found.has(key)) {
        found.add(key);
        keys.push(key);
        debugLogger.info('docxParser', `Found angle key: ${key}`);
      }
    }

    debugLogger.success('docxParser', `Extracted ${keys.length} unique keys`, keys);
    return keys;
  } catch (error) {
    debugLogger.error('docxParser', 'Error parsing DOCX', error);
    console.error('Error parsing DOCX:', error);
    return [];
  }
}

/**
 * Normalize key for docxtemplater - trim spaces inside brackets/braces
 */
function normalizeKeyForTemplate(key: string): string {
  return key.trim().replace(/\s+/g, ' ');
}

/**
 * Fill DOCX template with data using direct XML replacement
 * This bypasses docxtemplater issues with broken table tags
 */
export function fillDocxTemplate(
  arrayBuffer: ArrayBuffer,
  data: Record<string, string>
): ArrayBuffer {
  try {
    debugLogger.info('docxParser', 'Starting template fill', { 
      dataSize: Object.keys(data).length,
      keys: Object.keys(data)
    });

    const zip = new PizZip(arrayBuffer);
    
    // Prepare cleaned data with normalized keys
    const cleanData: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null && value !== '') {
        const normalizedKey = normalizeKeyForTemplate(key);
        cleanData[normalizedKey] = String(value);
        debugLogger.info('docxParser', `Prepared key: "${key}" -> "${normalizedKey}"`);
      }
    }

    debugLogger.info('docxParser', 'Cleaned data ready', Object.keys(cleanData));

    // Get all XML files in the DOCX
    const xmlFiles = Object.keys(zip.files).filter(
      name => name.endsWith('.xml') && (name.startsWith('word/') || name === '[Content_Types].xml')
    );

    debugLogger.info('docxParser', `Found ${xmlFiles.length} XML files to process`);

    let totalReplacements = 0;

    // Process each XML file
    for (const fileName of xmlFiles) {
      const file = zip.files[fileName];
      if (!file) continue;

      let content = file.asText();
      if (!content) continue;

      let modified = false;
      let fileReplacements = 0;

      // Replace {{key}} format
      for (const [key, value] of Object.entries(cleanData)) {
        // Pattern for {{ key }} with possible spaces - escape braces properly
        const escapedKey = escapeRegExp(key);
        const curlyPattern = new RegExp('\\{\\{\\s*' + escapedKey + '\\s*\\}\\}', 'g');
        const curlyMatches = content.match(curlyPattern);
        if (curlyMatches) {
          content = content.replace(curlyPattern, value);
          modified = true;
          fileReplacements += curlyMatches.length;
          debugLogger.info('docxParser', `Replaced {{ ${key} }} (${curlyMatches.length} times) in ${fileName}`);
        }

        // Pattern for < key > with possible spaces
        const anglePattern = new RegExp('<\\s*' + escapedKey + '\\s*>', 'gi');
        const angleMatches = content.match(anglePattern);
        if (angleMatches) {
          content = content.replace(anglePattern, value);
          modified = true;
          fileReplacements += angleMatches.length;
          debugLogger.info('docxParser', `Replaced < ${key} > (${angleMatches.length} times) in ${fileName}`);
        }
      }

      if (modified) {
        zip.file(fileName, content);
        totalReplacements += fileReplacements;
        debugLogger.info('docxParser', `Modified ${fileName} with ${fileReplacements} replacements`);
      }
    }

    // Generate result
    const result = zip.generate({
      type: 'arraybuffer',
      compression: 'DEFLATE',
    });

    debugLogger.success('docxParser', `Template filled successfully. Total replacements: ${totalReplacements}`);
    return result;
  } catch (error) {
    debugLogger.error('docxParser', 'Error filling template', error);
    console.error('[DOCX] Error filling template:', error);
    // Return original on error
    return arrayBuffer;
  }
}

/**
 * Escape special regex characters
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

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
    'организация - застройщик': 'Застройщик, технический заказчик',
    'информация по застройщику': 'Информация по организации застройщика',
    'организация - строитель': 'Организация, выполняющая строительство',
    'информация по строителю': 'Информация по организации строителя',
    'организация - проектировщик': 'Организация, выполнившая проектную документацию',
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
    'шифр проектной документации': 'Шифр проектной документации',
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

  return `${base} (${docInfo})`;
}