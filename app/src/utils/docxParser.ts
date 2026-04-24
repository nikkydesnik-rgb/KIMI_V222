import PizZip from 'pizzip';

/**
 * Normalize key for display
 */
function normalizeKey(key: string): string {
  return key.replace(/\s*_\s*/g, '_').replace(/\s+/g, ' ').trim();
}

/**
 * Check if a string looks like a template key
 */
function isValidKey(key: string): boolean {
  return /[а-яёa-z]/i.test(key) && key.length > 0;
}

/**
 * Extract all XML content from word/*.xml files
 */
function extractTextFromAllXMLFiles(zip: InstanceType<typeof PizZip>): string {
  let allContent = '';
  
  for (const fileName of Object.keys(zip.files)) {
    if (
      fileName.startsWith('word/') &&
      (fileName.endsWith('.xml') || fileName.includes('.xml.'))
    ) {
      const content = zip.files[fileName].asText() || '';
      allContent += content + ' ';
    }
  }
  
  return allContent;
}

/**
 * Extract keys from DOCX template
 */
export function extractKeysFromDocx(arrayBuffer: ArrayBuffer): string[] {
  try {
    const zip = new PizZip(arrayBuffer);
    const xmlText = extractTextFromAllXMLFiles(zip);

    const keys: string[] = [];
    const found = new Set<string>();

    // Pattern for {{key}}
    const curlyPattern = /\{\{\s*([^}]+?)\s*\}\}/g;
    // Pattern for <key>
    const anglePattern = /<([а-яёa-z][^<>]*?)>/gi;

    let match;

    while ((match = curlyPattern.exec(xmlText)) !== null) {
      const key = normalizeKey(match[1]);
      if (key && isValidKey(key) && !found.has(key)) {
        found.add(key);
        keys.push(key);
      }
    }

    while ((match = anglePattern.exec(xmlText)) !== null) {
      const key = normalizeKey(match[1]);
      if (key && isValidKey(key) && !found.has(key)) {
        found.add(key);
        keys.push(key);
      }
    }

    return keys;
  } catch (error) {
    console.error('Error parsing DOCX:', error);
    return [];
  }
}

/**
 * Check if buffer is a valid DOCX ZIP
 */
function isZipBuffer(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer);
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

/**
 * Escape regex special characters
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Fill DOCX template with data (simple regex replacement)
 */
export function fillDocxTemplate(
  arrayBuffer: ArrayBuffer,
  data: Record<string, string>
): ArrayBuffer {
  try {
    if (!isZipBuffer(arrayBuffer)) {
      throw new Error('Template is not a valid DOCX');
    }

    const zip = new PizZip(arrayBuffer);
    
    const cleanData: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null) {
        cleanData[key.trim()] = String(value);
      }
    }

    const xmlFiles = Object.keys(zip.files).filter(
      name => name.endsWith('.xml') && name.startsWith('word/')
    );

    for (const fileName of xmlFiles) {
      const file = zip.files[fileName];
      if (!file) continue;

      let content = file.asText();
      if (!content) continue;

      let modified = false;
      
      for (const [key, value] of Object.entries(cleanData)) {
        const escapedKey = escapeRegExp(key);
        
        // {{key}} with optional spaces
        const curlyPattern = new RegExp('\\{\\{\\s*' + escapedKey + '\s*\\}\\}', 'g');
        if (curlyPattern.test(content)) {
          content = content.replace(curlyPattern, value);
          modified = true;
        }

        // <key> with optional spaces
        const anglePattern = new RegExp('<\s*' + escapedKey + '\s*>', 'gi');
        if (anglePattern.test(content)) {
          content = content.replace(anglePattern, value);
          modified = true;
        }
      }

      if (modified) {
        zip.file(fileName, content);
      }
    }

    return zip.generate({
      type: 'arraybuffer',
    });
  } catch (error) {
    console.error('Error filling DOCX:', error);
    return arrayBuffer;
  }
}

/**
 * Convert ArrayBuffer to Base64
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
 * Convert Base64 to ArrayBuffer
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
 * Convert key to snake_case
 */
export function toSnakeCase(key: string): string {
  return key.trim().replace(/\s+/g, '_').replace(/[<>{}]/g, '').replace(/_{2,}/g, '_');
}

/**
 * Get hint for key
 */
export function getKeyHint(key: string): string {
  const hints: Record<string, string> = {
    'объект строительства': 'Объект капитального строительства',
    'организация - застройщик': 'Застройщик, техзаказчик',
    'должн. предст. застройщика': 'Должность представителя застройщика',
    'фио застройщика': 'ФИО представителя застройщика',
    'расп. застройщик': 'Распоряжение представителя застройщика',
  };
  return hints[key.toLowerCase().trim()] || '';
}

/**
 * Check if key is AOSR-specific
 */
export function isAOSRKey(key: string): boolean {
  const aosrKeys = ['номер', 'акт', 'наименование', 'работ', 'материалы', 'сп', 'чн', 'мн', 'гн', 'чк', 'мк', 'гк'];
  return aosrKeys.some(k => key.toLowerCase().includes(k));
}

/**
 * Format material for act
 */
export function formatMaterialForAct(
  material: { name: string; quantity: string; unit: string; qualityDoc: string; expiryDate: string },
  includeDocs: boolean
): string {
  const base = `${material.name} - ${material.quantity} ${material.unit}`;
  if (!includeDocs || !material.qualityDoc.trim()) return base;
  const prefix = material.qualityDoc.toLowerCase().includes('паспорт') ? 'от' : 'с/д';
  const docInfo = material.expiryDate 
    ? `${material.qualityDoc} ${prefix} ${material.expiryDate}` 
    : material.qualityDoc;
  return `${base} (${docInfo})`;
}