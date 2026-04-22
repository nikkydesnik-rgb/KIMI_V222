import PizZip from 'pizzip';
import { debugLogger } from './debug';

/**
 * Convert DOCX to HTML for preview purposes.
 * 
 * DOCX files cannot be displayed directly in browsers.
 * This function extracts text content, tables, and basic formatting
 * from the DOCX and renders it as styled HTML.
 * 
 * The resulting HTML can be displayed in an iframe or div.
 */
export function convertDocxToHtml(arrayBuffer: ArrayBuffer): string {
  try {
    debugLogger.info('docxPreview', 'Converting DOCX to HTML for preview');
    
    const zip = new PizZip(arrayBuffer);
    
    // Try to get the main document
    const documentXml = zip.file('word/document.xml');
    if (!documentXml) {
      return renderErrorHtml('Document XML not found in DOCX');
    }
    
    const xmlContent = documentXml.asText();
    
    // Extract styles for better formatting
    const stylesXml = zip.file('word/styles.xml');
    const stylesContent = stylesXml ? stylesXml.asText() : '';
    
    // Convert XML to HTML
    const html = convertXmlToHtml(xmlContent, stylesContent);
    
    debugLogger.success('docxPreview', 'DOCX converted to HTML successfully');
    return html;
  } catch (error) {
    debugLogger.error('docxPreview', 'Error converting DOCX to HTML', error);
    return renderErrorHtml('Failed to convert document for preview');
  }
}

/**
 * Convert DOCX XML content to HTML string
 */
function convertXmlToHtml(xmlContent: string, stylesContent: string): string {
  // Extract paragraphs with their formatting
  const paragraphs = extractParagraphs(xmlContent);
  
  // Extract tables
  const tables = extractTables(xmlContent);
  
  // Build HTML
  const bodyContent: string[] = [];
  
  // Add paragraphs
  for (const para of paragraphs) {
    if (para.isTable) {
      // Table is handled separately
      continue;
    }
    
    const style = buildParagraphStyle(para);
    const alignedStyle = applyAlignment(para.alignment, style);
    
    if (para.isHeading) {
      const level = Math.min(para.headingLevel || 1, 6);
      bodyContent.push(`<h${level} style="${alignedStyle}">${escapeHtml(para.text)}</h${level}>`);
    } else if (para.isListItem) {
      bodyContent.push(`<li style="${alignedStyle}">${escapeHtml(para.text)}</li>`);
    } else {
      bodyContent.push(`<p style="${alignedStyle}">${escapeHtml(para.text)}</p>`);
    }
  }
  
  // Add tables
  for (const table of tables) {
    bodyContent.push(renderTableAsHtml(table));
  }
  
  return wrapInHtmlDocument(bodyContent.join('\n'));
}

/**
 * Extract paragraphs from DOCX XML
 */
function extractParagraphs(xmlContent: string): ParagraphData[] {
  const paragraphs: ParagraphData[] = [];
  
  // Match w:p elements (paragraphs)
  const paraRegex = /<w:p[\s\S]*?<\/w:p>/g;
  let match;
  
  while ((match = paraRegex.exec(xmlContent)) !== null) {
    const paraXml = match[0];
    
    // Check if this is actually a table (w:tbl)
    if (paraXml.includes('<w:tbl')) {
      continue; // Tables handled separately
    }
    
    // Extract text from all w:t elements in this paragraph
    const text = extractTextFromRuns(paraXml);
    
    if (!text && !paraXml.includes('<w:pStyle')) {
      // Empty paragraph - add as line break
      paragraphs.push({
        text: '',
        isHeading: false,
        isListItem: false,
        alignment: '',
      });
      continue;
    }
    
    // Detect heading style
    const headingMatch = paraXml.match(/w:val="Heading(\d)"/i) || 
                        paraXml.match(/w:val="(\d)"/);
    const isHeading = paraXml.includes('Heading') || 
                     paraXml.includes('Title') ||
                     paraXml.includes('Заголовок');
    const headingLevel = headingMatch ? parseInt(headingMatch[1]) : 1;
    
    // Detect list item
    const isListItem = paraXml.includes('<w:numPr>');
    
    // Detect alignment
    const alignMatch = paraXml.match(/w:val="(left|right|center|both|justify)"/);
    const alignment = alignMatch ? alignMatch[1] : '';
    
    // Detect bold/italic/underline
    const isBold = paraXml.includes('<w:b/>') || paraXml.includes('<w:b ');
    const isItalic = paraXml.includes('<w:i/>') || paraXml.includes('<w:i ');
    const isUnderline = paraXml.includes('<w:u ');
    
    paragraphs.push({
      text,
      isHeading,
      headingLevel: isHeading ? headingLevel : undefined,
      isListItem,
      alignment,
      isBold,
      isItalic,
      isUnderline,
    });
  }
  
  return paragraphs;
}

/**
 * Extract text from w:r (run) elements within a paragraph
 */
function extractTextFromRuns(paraXml: string): string {
  const texts: string[] = [];
  
  // Match w:r elements
  const runRegex = /<w:r[\s\S]*?<\/w:r>/g;
  let runMatch;
  
  while ((runMatch = runRegex.exec(paraXml)) !== null) {
    const runXml = runMatch[0];
    
    // Extract text from w:t elements
    const textRegex = /<w:t(?:\s+[^>]*)?>([^<]*)<\/w:t>/g;
    let textMatch;
    
    while ((textMatch = textRegex.exec(runXml)) !== null) {
      texts.push(textMatch[1]);
    }
  }
  
  return texts.join('');
}

/**
 * Extract tables from DOCX XML
 */
function extractTables(xmlContent: string): TableData[] {
  const tables: TableData[] = [];
  
  // Match w:tbl elements (tables)
  const tableRegex = /<w:tbl[\s\S]*?<\/w:tbl>/g;
  let match;
  
  while ((match = tableRegex.exec(xmlContent)) !== null) {
    const tableXml = match[0];
    const rows: string[][] = [];
    
    // Match w:tr elements (rows)
    const rowRegex = /<w:tr[\s\S]*?<\/w:tr>/g;
    let rowMatch;
    
    while ((rowMatch = rowRegex.exec(tableXml)) !== null) {
      const rowXml = rowMatch[0];
      const cells: string[] = [];
      
      // Match w:tc elements (cells)
      const cellRegex = /<w:tc[\s\S]*?<\/w:tc>/g;
      let cellMatch;
      
      while ((cellMatch = cellRegex.exec(rowXml)) !== null) {
        const cellText = extractTextFromRuns(cellMatch[0]);
        cells.push(cellText);
      }
      
      if (cells.length > 0) {
        rows.push(cells);
      }
    }
    
    if (rows.length > 0) {
      tables.push({ rows });
    }
  }
  
  return tables;
}

/**
 * Render table data as HTML
 */
function renderTableAsHtml(table: TableData): string {
  const rows: string[] = [];
  
  for (let i = 0; i < table.rows.length; i++) {
    const row = table.rows[i];
    const isHeader = i === 0;
    const tag = isHeader ? 'th' : 'td';
    
    const cells = row.map(cell => 
      `<${tag} style="border: 1px solid #999; padding: 6px 8px; text-align: left;">${escapeHtml(cell)}</${tag}>`
    ).join('');
    
    rows.push(`<tr>${cells}</tr>`);
  }
  
  return `<table style="border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 14px;">${rows.join('')}</table>`;
}

/**
 * Build CSS style string for a paragraph
 */
function buildParagraphStyle(para: ParagraphData): string {
  const styles: string[] = [
    'margin: 0 0 8px 0',
    'font-family: "Times New Roman", Times, serif',
    'font-size: 14px',
    'line-height: 1.5',
    'color: #333',
  ];
  
  if (para.isBold) styles.push('font-weight: bold');
  if (para.isItalic) styles.push('font-style: italic');
  if (para.isUnderline) styles.push('text-decoration: underline');
  
  return styles.join('; ');
}

/**
 * Apply text alignment
 */
function applyAlignment(alignment: string, baseStyle: string): string {
  const alignMap: Record<string, string> = {
    'center': 'text-align: center',
    'right': 'text-align: right',
    'both': 'text-align: justify',
    'justify': 'text-align: justify',
    'left': 'text-align: left',
  };
  
  if (alignment && alignMap[alignment]) {
    return `${baseStyle}; ${alignMap[alignment]}`;
  }
  
  return baseStyle;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const div = typeof document !== 'undefined' ? document.createElement('div') : null;
  if (div) {
    div.textContent = text;
    return div.innerHTML;
  }
  
  // Fallback for non-browser environments
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Wrap body content in a complete HTML document
 */
function wrapInHtmlDocument(bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Предпросмотр документа</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: "Times New Roman", Times, serif;
      font-size: 14px;
      line-height: 1.5;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
      background: #fff;
    }
    h1, h2, h3, h4, h5, h6 {
      font-family: "Times New Roman", Times, serif;
      margin: 16px 0 8px 0;
      color: #222;
    }
    h1 { font-size: 20px; font-weight: bold; }
    h2 { font-size: 18px; font-weight: bold; }
    h3 { font-size: 16px; font-weight: bold; }
    p { margin: 0 0 8px 0; }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 12px 0;
    }
    th, td {
      border: 1px solid #999;
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background-color: #f5f5f5;
      font-weight: bold;
    }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
${bodyContent}
</body>
</html>`;
}

/**
 * Render error message as HTML
 */
function renderErrorHtml(message: string): string {
  return wrapInHtmlDocument(`
    <div style="text-align: center; padding: 40px; color: #666;">
      <p style="font-size: 16px;">⚠️ ${escapeHtml(message)}</p>
      <p style="font-size: 14px; color: #999;">Попробуйте скачать файл для просмотра</p>
    </div>
  `);
}

// ==================== Type Definitions ====================

interface ParagraphData {
  text: string;
  isHeading: boolean;
  headingLevel?: number;
  isListItem: boolean;
  alignment: string;
  isTable?: boolean;
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
}

interface TableData {
  rows: string[][];
}

/**
 * Create a Blob URL for DOCX preview as HTML.
 * Usage in React:
 *   const url = createDocxPreviewUrl(arrayBuffer);
 *   <iframe src={url} ... />
 * 
 * Remember to revoke the URL when done:
 *   URL.revokeObjectURL(url);
 */
export function createDocxPreviewUrl(arrayBuffer: ArrayBuffer): string {
  const html = convertDocxToHtml(arrayBuffer);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  return URL.createObjectURL(blob);
}

/**
 * Download DOCX file with given filename
 */
export function downloadDocx(arrayBuffer: ArrayBuffer, filename: string): void {
  const blob = new Blob([arrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
