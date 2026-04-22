const fs = require('fs');
const PizZip = require('pizzip');

/**
 * Extract all <w:t> text content in document order from XML
 */
function extractTextParts(xmlContent) {
  const textParts = [];
  const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let m;
  while ((m = tRegex.exec(xmlContent)) !== null) {
    textParts.push(m[1]);
  }
  return textParts;
}

function normalizeKey(key) {
  return key.replace(/\s+/g, ' ').trim();
}

/**
 * Smart key extraction - joins <w:t> elements to find split keys
 */
function extractKeysSmart(xmlContent) {
  const keys = [];
  const seen = new Set();

  const textParts = extractTextParts(xmlContent);
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

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * NEW: Smart replacement that handles keys split across multiple <w:t> elements
 */
function replaceSplitKey(xmlContent, keyPattern, value) {
  let replacements = 0;
  let content = xmlContent;
  
  // Extract all <w:r> elements with their text content
  const runRegex = /<w:r(\s+[^>]*)?>([\s\S]*?<w:t(?:\s+[^>]*)?>[^<]*<\/w:t>[\s\S]*?)<\/w:r>/g;
  
  const runs = [];
  let match;
  while ((match = runRegex.exec(xmlContent)) !== null) {
    const textMatch = match[1].match(/<w:t(?:\s+[^>]*)?>([^<]*)<\/w:t>/);
    if (textMatch) {
      runs.push({
        fullMatch: match[0],
        innerContent: match[1],
        textContent: textMatch[1],
        index: match.index,
      });
    }
  }
  
  // Search for consecutive runs whose text content joins to form the key pattern
  for (let i = 0; i < runs.length; i++) {
    let collectedText = '';
    
    for (let j = i; j < runs.length && j < i + 20; j++) {
      collectedText += runs[j].textContent;
      
      if (collectedText === keyPattern) {
        // Found a match! Replace the entire sequence
        const firstRun = runs[i];
        const lastRun = runs[j];
        
        const startPos = firstRun.index;
        const endPos = lastRun.index + lastRun.fullMatch.length;
        const sequenceToReplace = content.substring(startPos, endPos);
        
        // Extract run properties (formatting) from the first run
        const rpMatch = sequenceToReplace.match(/<w:rPr>[\s\S]*?<\/w:rPr>/);
        const runProps = rpMatch ? rpMatch[0] : '';
        
        const replacement = `<w:r>${runProps}<w:t>${escapeXml(value)}</w:t></w:r>`;
        
        content = content.substring(0, startPos) + replacement + content.substring(endPos);
        
        // Adjust indices for subsequent runs
        const lengthDiff = replacement.length - sequenceToReplace.length;
        for (let k = j + 1; k < runs.length; k++) {
          runs[k].index += lengthDiff;
        }
        
        replacements++;
        
        // Reset search since we modified content
        i = -1;
        break;
      }
      
      if (collectedText.length > keyPattern.length) {
        break;
      }
    }
  }
  
  return { content, replacements };
}

/**
 * Fill DOCX template with smart replacement
 */
function fillDocxTemplate(arrayBuffer, data) {
  const zip = new PizZip(arrayBuffer);
  
  const cleanData = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) {
      cleanData[key.trim()] = String(value);
    }
  }

  const xmlFiles = Object.keys(zip.files).filter(
    name => name.endsWith('.xml') && (name.startsWith('word/') || name === '[Content_Types].xml')
  );

  let totalReplacements = 0;

  for (const fileName of xmlFiles) {
    const file = zip.files[fileName];
    if (!file) continue;

    let content = file.asText();
    if (!content) continue;

    let fileReplacements = 0;
    
    for (const [key, value] of Object.entries(cleanData)) {
      // Build possible key patterns
      const patterns = [
        `{{${key}}}`,
        `{{ ${key} }}`,
        `{{${key} }}`,
        `{{ ${key}}}`,
      ];
      
      for (const pattern of patterns) {
        const result = replaceSplitKey(content, pattern, value);
        if (result.replacements > 0) {
          content = result.content;
          fileReplacements += result.replacements;
          console.log(`    Smart replaced "${pattern}" -> "${value}" (${result.replacements}x)`);
          break; // Stop trying other patterns for this key
        }
      }
      
      // Fallback: direct regex for non-split keys
      if (fileReplacements === 0) {
        const escapedKey = escapeRegExp(key);
        const curlyPattern = new RegExp('\\{\\{\\s*' + escapedKey + '\\s*\\}\\}', 'g');
        const curlyMatches = content.match(curlyPattern);
        if (curlyMatches) {
          content = content.replace(curlyPattern, escapeXml(value));
          fileReplacements += curlyMatches.length;
          console.log(`    Regex replaced {{${key}}} (${curlyMatches.length}x)`);
        }
      }
    }

    if (fileReplacements > 0) {
      zip.file(fileName, content);
      totalReplacements += fileReplacements;
    }
  }

  return {
    buffer: zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }),
    totalReplacements,
  };
}

// ==================== RUN TESTS ====================

const testFile = './test_template_all_formats.docx';
console.log(`Testing file: ${testFile}`);

const arrayBuffer = fs.readFileSync(testFile);
console.log(`File size: ${arrayBuffer.length} bytes\n`);

// Test 1: Extract keys
console.log('='.repeat(60));
console.log('TEST 1: Key extraction (smart parser)');
console.log('='.repeat(60));

const zip = new PizZip(arrayBuffer);
const documentXml = zip.files['word/document.xml'].asText();
const keys = extractKeysSmart(documentXml);

console.log(`\nFound ${keys.length} keys:`);
keys.forEach((key, i) => {
  const hasSpaces = key.includes(' ');
  const status = hasSpaces ? '⚠️ (has spaces)' : '✅ snake_case';
  console.log(`  ${i + 1}. "${key}" ${status}`);
});

// Show XML structure for first key
console.log('\n--- XML structure analysis ---');
const textParts = extractTextParts(documentXml);
console.log(`Total <w:t> elements: ${textParts.length}`);

// Find how keys are split
const fullText = textParts.join('');
console.log(`Joined text length: ${fullText.length}`);

// Show first few text parts that contain key markers
const relevantParts = textParts.filter(p => p.includes('{{') || p.includes('}}') || p.includes('_строитель'));
console.log(`\nText parts containing key markers:`);
relevantParts.slice(0, 10).forEach((p, i) => {
  console.log(`  [${i}] "${p}"`);
});

// Test 2: Fill template
console.log('\n' + '='.repeat(60));
console.log('TEST 2: Template filling (smart replacement)');
console.log('='.repeat(60));

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

try {
  const result = fillDocxTemplate(arrayBuffer, fillData);
  
  const outputFile = './test_filled_output.docx';
  fs.writeFileSync(outputFile, result.buffer);
  
  console.log(`\n✅ Template filled successfully!`);
  console.log(`   Total replacements: ${result.totalReplacements}`);
  console.log(`   Output: ${outputFile} (${result.buffer.length} bytes)`);
  
  // Verify: extract keys from filled template to check
  console.log('\n--- Verification: Checking filled template ---');
  const filledZip = new PizZip(result.buffer);
  const filledXml = filledZip.files['word/document.xml'].asText();
  
  // Check that values are present
  for (const [key, value] of Object.entries(fillData)) {
    if (filledXml.includes(value)) {
      console.log(`  ✅ Value "${value}" found in output`);
    } else {
      console.log(`  ❌ Value "${value}" NOT found in output`);
    }
  }
  
} catch (error) {
  console.error('\n❌ Template filling failed:', error.message);
  console.error(error.stack);
}

console.log('\n' + '='.repeat(60));
console.log('Tests complete!');
console.log('='.repeat(60));
