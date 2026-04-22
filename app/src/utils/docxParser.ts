import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

/**
 * Extract all text content from DOCX XML files
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
      const regex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        textParts.push(match[1]);
      }
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
      }
    }

    while ((match = anglePattern.exec(xmlText)) !== null) {
      const key = normalizeKey(match[1]);
      if (key && !found.has(key)) {
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
 * Fill DOCX template with data using docxtemplater library
 */
export function fillDocxTemplate(
  arrayBuffer: ArrayBuffer,
  data: Record<string, string>
): ArrayBuffer {
  try {
    const cleanData: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null) {
        cleanData[key] = String(value);
      }
    }

    const doc = new Docxtemplater(arrayBuffer, {
      paragraphLoop: true,
      linebreaks: true,
    });

    doc.render(cleanData);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const zip = doc.getZip() as any;
    const result = zip.generate({
      type: 'arraybuffer',
    });

    return result;
  } catch (error) {
    console.error('Error filling DOCX template:', error);
    return arrayBuffer;
  }
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