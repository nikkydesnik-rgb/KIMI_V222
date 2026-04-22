const fs = require('fs');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

/**
 * Extract all text content from DOCX XML files
 */
function extractAllTextFromXML(zip) {
  const textParts = [];
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
      const fullContent = content.replace(/<[^>]+>/g, ' ');
      textParts.push(fullContent);
    }
  }

  return textParts.join(' ');
}

function normalizeKey(key) {
  return key.replace(/\s+/g, ' ').trim();
}

/**
 * Smart extraction of text from DOCX XML that handles split keys
 */
function extractKeysSmartFromXML(xmlContent) {
  const keys = [];
  const seen = new Set();

  // Extract all <w:t> text content in document order
  const textParts = [];
  const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let m;
  while ((m = tRegex.exec(xmlContent)) !== null) {
    textParts.push(m[1]);
  }
  
  // Join all text parts to reconstruct potentially split keys
  const fullText = textParts.join('');
  
  // Find {{key}} patterns
  const curlyRegex = /\{\{\s*([^}]+?)\s*\}\}/g;
  let match;
  while ((match = curlyRegex.exec(fullText)) !== null) {
    const key = normalizeKey(match[1]);
    if (key && /[а-яёa-z]/i.test(key) && !seen.has(key.toLowerCase())) {
      seen.add(key.toLowerCase());
      keys.push(key);
    }
  }
  
  // Find <key> patterns
  const angleRegex = /<\s*([^>]+?)\s*>/g;
  while ((match = angleRegex.exec(fullText)) !== null) {
    const key = normalizeKey(match[1]);
    if (key && /[а-яёa-z]/i.test(key) && !seen.has(key.toLowerCase())) {
      seen.add(key.toLowerCase());
      keys.push(key);
    }
  }

  return keys;
}

function extractTextFromAllXMLFiles(zip) {
  const allTexts = [];
  
  for (const fileName of Object.keys(zip.files)) {
    if (
      fileName.startsWith('word/') &&
      (fileName.endsWith('.xml') || fileName.includes('.xml.'))
    ) {
      try {
        const content = zip.files[fileName].asText() || '';
        allTexts.push(content);
      } catch (e) {
        // Skip
      }
    }
  }
  
  return allTexts.join('\n');
}

function mergeUniqueKeys(keyArrays) {
  const seen = new Set();
  const result = [];
  
  for (const key of keyArrays.flat()) {
    const normalized = key.toLowerCase().trim();
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(key.trim());
    }
  }
  
  return result;
}

/**
 * Extract keys using docxtemplater's built-in tag extraction
 */
function extractKeysViaDocxtemplater(zip) {
  const keys = [];
  
  try {
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '',
    });
    
    // Get all tags
    const tags = doc.getTags();
    
    function collectTags(tagObj, prefix = '') {
      for (const [key, value] of Object.entries(tagObj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          collectTags(value, fullKey);
        } else {
          keys.push(normalizeKey(fullKey));
        }
      }
    }
    
    collectTags(tags);
    console.log(`  Docxtemplater found ${keys.length} keys:`, keys);
  } catch (error) {
    console.log('  Docxtemplater extraction failed:', error.message);
  }
  
  return keys;
}

/**
 * NEW: Combined extraction using all strategies
 */
function extractKeysFromDocx(arrayBuffer) {
  console.log('\n=== Starting key extraction ===');
  
  const zip = new PizZip(arrayBuffer);
  const allXmlText = extractTextFromAllXMLFiles(zip);
  
  // Strategy 1: Docxtemplater
  console.log('\n--- Strategy 1: Docxtemplater ---');
  const keysFromDocxtemplater = extractKeysViaDocxtemplater(zip);
  
  // Strategy 2: Smart XML parsing
  console.log('\n--- Strategy 2: Smart XML parsing ---');
  const keysFromSmartParse = extractKeysSmartFromXML(allXmlText);
  console.log(`  Smart parse found ${keysFromSmartParse.length} keys:`, keysFromSmartParse);
  
  // Merge
  const allKeys = mergeUniqueKeys([keysFromDocxtemplater, keysFromSmartParse]);
  
  console.log(`\n=== Total unique keys: ${allKeys.length} ===`);
  return allKeys;
}

/**
 * Test template filling
 */
function fillDocxTemplate(arrayBuffer, data) {
  try {
    const zip = new PizZip(arrayBuffer);
    
    // Prepare data
    const cleanData = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null) {
        cleanData[key.trim()] = String(value);
      }
    }
    
    // Use docxtemplater
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '',
    });
    
    doc.setData(cleanData);
    doc.render();
    
    return doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });
  } catch (error) {
    console.error('Error filling template:', error.message);
    throw error;
  }
}

// ==================== RUN TESTS ====================

const testFile = './test_template_all_formats.docx';
console.log(`Testing file: ${testFile}`);

// Read file
const arrayBuffer = fs.readFileSync(testFile);
console.log(`File size: ${arrayBuffer.length} bytes`);

// Test 1: Extract keys
console.log('\n' + '='.repeat(50));
console.log('TEST 1: Key extraction');
console.log('='.repeat(50));

const keys = extractKeysFromDocx(arrayBuffer);
console.log('\nAll extracted keys:');
keys.forEach((key, i) => {
  const hasSpaces = key.includes(' ');
  const status = hasSpaces ? '⚠️ (has spaces)' : '✅';
  console.log(`  ${i + 1}. ${key} ${status}`);
});

// Check for expected keys
const expectedKeys = [
  'Объект_строительства',
  'Организация_застройщик', 
  'Организация_строитель',
  'Объект строительства',
  'Организация - застройщик',
  'Организация_проектировщик',
  'Дата_начала',
  'Дата_окончания',
  'Должность_представителя_застройщика',
  'ФИО_представителя_застройщика',
  'Распоряжение_застройщика',
  'Шифр_проектной_документации',
  'Экз'
];

console.log('\n--- Validation ---');
const missing = expectedKeys.filter(k => !keys.some(ek => ek.toLowerCase() === k.toLowerCase()));
const found = expectedKeys.filter(k => keys.some(ek => ek.toLowerCase() === k.toLowerCase()));

console.log(`Found ${found.length}/${expectedKeys.length} expected keys:`);
found.forEach(k => console.log(`  ✅ ${k}`));

if (missing.length > 0) {
  console.log(`\nMissing ${missing.length} keys:`);
  missing.forEach(k => console.log(`  ❌ ${k}`));
}

// Test 2: Fill template
console.log('\n' + '='.repeat(50));
console.log('TEST 2: Template filling');
console.log('='.repeat(50));

try {
  const fillData = {
    'Объект_строительства': 'Торговый центр "Европа"',
    'Организация_застройщик': 'ООО "СтройИнвест"',
    'Организация_строитель': 'ООО "ПрогрессСтрой"',
    'Организация_проектировщик': 'ООО "ПроектБюро"',
    'Дата_начала': '01.03.2026',
    'Дата_окончания': '15.09.2026',
    'Должность_представителя_застройщика': 'Главный инженер',
    'ФИО_представителя_застройщика': 'Иванов И.И.',
    'Распоряжение_застройщика': 'Приказ №15 от 10.01.2026',
    'Шифр_проектной_документации': 'П-2026-03-15',
    'Экз': '3',
  };
  
  // Note: keys with spaces won't be filled by docxtemplater
  // because they need exact match
  
  const filled = fillDocxTemplate(arrayBuffer, fillData);
  
  const outputFile = './test_filled_output.docx';
  fs.writeFileSync(outputFile, filled);
  console.log(`✅ Template filled successfully: ${outputFile}`);
  console.log(`   Output size: ${filled.length} bytes`);
  
} catch (error) {
  console.error('❌ Template filling failed:', error.message);
}

console.log('\n' + '='.repeat(50));
console.log('Tests complete!');
console.log('='.repeat(50));
