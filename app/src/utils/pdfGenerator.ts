import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { fillDocxTemplate, base64ToArrayBuffer, formatMaterialForAct } from './docxParser';
import { formatDateRu } from './dateCalc';
import type { Session, RegistryEntry } from '@/types';

export async function generateRegistryPDF(
  entries: RegistryEntry[],
  objectName: string
): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Title
  page.drawText('РЕЕСТР', {
    x: 260,
    y: 780,
    size: 16,
    font: fontBold,
  });

  // Object name
  page.drawText(`Объект: ${objectName}`, {
    x: 50,
    y: 750,
    size: 11,
    font,
  });

  // Table headers
  const headers = ['№ п/п', 'Наименование документа', '№ и дата', 'Организация', 'Кол-во листов', 'Лист по списку'];
  const colWidths = [40, 180, 100, 120, 60, 60];
  let startX = 30;
  const startY = 720;

  // Header row
  for (let i = 0; i < headers.length; i++) {
    page.drawRectangle({
      x: startX,
      y: startY - 20,
      width: colWidths[i],
      height: 20,
      borderColor: rgb(0, 0, 0),
      borderWidth: 1,
    });
    page.drawText(headers[i], {
      x: startX + 4,
      y: startY - 14,
      size: 8,
      font: fontBold,
    });
    startX += colWidths[i];
  }

  // Data rows
  let currentY = startY - 20;
  for (const entry of entries) {
    startX = 30;
    const rowData = [
      entry.order.toString(),
      entry.documentName,
      entry.docNumber,
      entry.organization,
      entry.pageCount,
      entry.pageInList,
    ];

    for (let i = 0; i < rowData.length; i++) {
      page.drawRectangle({
        x: startX,
        y: currentY - 20,
        width: colWidths[i],
        height: 20,
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.5,
      });

      let text = rowData[i];
      if (text.length > 30) text = text.substring(0, 27) + '...';

      page.drawText(text, {
        x: startX + 4,
        y: currentY - 14,
        size: 7,
        font,
      });
      startX += colWidths[i];
    }
    currentY -= 20;
  }

  return pdfDoc;
}

export async function generateFullPackagePDF(
  session: Session
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  // Add title page if available
  const titleTemplate = session.templates.find(t => t.name.toLowerCase().includes('титул'));
  if (titleTemplate) {
    try {
      const templateData = base64ToArrayBuffer(titleTemplate.fileData);
      fillDocxTemplate(templateData, {
        ...session.permanentData,
      });
      // Note: In production, convert DOCX to PDF via LibreOffice or similar
      // For now, add a title page with text
      const page = pdfDoc.addPage([595, 842]);
      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      page.drawText('ТИТУЛЬНЫЙ ЛИСТ', {
        x: 200,
        y: 750,
        size: 18,
        font,
      });
      if (session.permanentData['Объект строительства'] || session.permanentData['object_name']) {
        page.drawText(session.permanentData['Объект строительства'] || session.permanentData['object_name'] || '', {
          x: 100,
          y: 700,
          size: 14,
          font,
        });
      }
    } catch {
      const page = pdfDoc.addPage([595, 842]);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      page.drawText('Титульный лист (шаблон не загружен)', {
        x: 150,
        y: 750,
        size: 14,
        font,
      });
    }
  } else {
    const page = pdfDoc.addPage([595, 842]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    page.drawText('Титульный лист не загружен', {
      x: 150,
      y: 750,
      size: 14,
      font,
    });
  }

  // Add registry
  const objectName = session.permanentData['Объект строительства'] || session.permanentData['object_name'] || 'Не указан';
  const registryPDF = await generateRegistryPDF(
    session.registry,
    objectName
  );
  const registryPages = await pdfDoc.copyPages(registryPDF, registryPDF.getPageIndices());
  registryPages.forEach(p => pdfDoc.addPage(p));

  // Add acts and appendices
  for (const entry of session.registry) {
    if (entry.linkedFile) {
      const fileData = await entry.linkedFile.arrayBuffer();
      const fileType = entry.linkedFileName.toLowerCase();

      if (fileType.endsWith('.pdf')) {
        try {
          const attachedPdf = await PDFDocument.load(fileData);
          const pages = await pdfDoc.copyPages(attachedPdf, attachedPdf.getPageIndices());
          pages.forEach(p => pdfDoc.addPage(p));
        } catch {
          // Skip invalid PDFs
        }
      } else if (fileType.endsWith('.docx')) {
        // For DOCX files, add a placeholder page
        const page = pdfDoc.addPage([595, 842]);
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        page.drawText(`${entry.documentName}`, {
          x: 50,
          y: 780,
          size: 12,
          font,
        });
        page.drawText(`(DOCX файл - ${entry.linkedFileName})`, {
          x: 50,
          y: 760,
          size: 10,
          font,
        });
      }
    } else if (entry.fileType === 'act') {
      // Add placeholder for acts without files
      const aosrAct = session.aosrActs.find(a => a.id === entry.sourceId);
      if (aosrAct) {
        const template = session.templates.find(t => t.id === aosrAct.templateId);
        if (template) {
          try {
            const templateData = base64ToArrayBuffer(template.fileData);
            
            // Build material strings
            const materialObjects = aosrAct.materials
              .map((id) => session.materials.find((m) => m.id === id))
              .filter(Boolean);
            const materialStrings = materialObjects.map((m) =>
              m ? formatMaterialForAct(m, aosrAct.includeMaterialDocs) : ''
            ).filter(Boolean);

            // Build appendix strings
            const appendixObjects = aosrAct.appendices
              .map((id) => session.appendices.find((a) => a.id === id))
              .filter(Boolean);
            const appendixStrings = appendixObjects.map((a) => a?.name || '').filter(Boolean);

            const data = {
              ...session.permanentData,
              ...Object.fromEntries(
                Object.entries(aosrAct).map(([k, v]) => [k, String(v)])
              ),
              act_number: aosrAct.actNumber.toString(),
              work_name: aosrAct.workName,
              start_date: formatDateRu(aosrAct.startDate),
              end_date: formatDateRu(aosrAct.endDate),
              materials: materialStrings.join(', '),
              appendices: appendixStrings.join(', '),
              sp: aosrAct.sp,
              object_name: objectName,
            };
            fillDocxTemplate(templateData, data);

            const page = pdfDoc.addPage([595, 842]);
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
            page.drawText(`Акт АОСР №${aosrAct.actNumber}`, {
              x: 50,
              y: 780,
              size: 12,
              font,
            });
            page.drawText(aosrAct.workName, {
              x: 50,
              y: 760,
              size: 10,
              font,
            });
          } catch {
            // Skip
          }
        }
      }
    }
  }

  return await pdfDoc.save();
}

export async function exportDOCX(
  session: Session,
  withAppendices: boolean
): Promise<void> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  // Create folder structure
  const sessionFolder = zip.folder(session.name);
  if (!sessionFolder) return;

  const actsFolder = sessionFolder.folder('акты');
  const appendicesFolder = sessionFolder.folder('приложения');

  // Export AOSR acts
  for (const act of session.aosrActs) {
    const template = session.templates.find(t => t.id === act.templateId);
    if (template && actsFolder) {
      try {
        const templateData = base64ToArrayBuffer(template.fileData);
        
        // Build material strings
        const materialObjects = act.materials
          .map((id) => session.materials.find((m) => m.id === id))
          .filter(Boolean);
        const materialStrings = materialObjects.map((m) =>
          m ? formatMaterialForAct(m, act.includeMaterialDocs) : ''
        ).filter(Boolean);

        // Build appendix strings
        const appendixObjects = act.appendices
          .map((id) => session.appendices.find((a) => a.id === id))
          .filter(Boolean);
        const appendixStrings = appendixObjects.map((a) => a?.name || '').filter(Boolean);

        const data = {
          ...session.permanentData,
          act_number: act.actNumber.toString(),
          work_name: act.workName,
          start_date: formatDateRu(act.startDate),
          end_date: formatDateRu(act.endDate),
          materials: materialStrings.join(', '),
          appendices: appendixStrings.join(', '),
          sp: act.sp,
          object_name: session.permanentData['Объект строительства'] || session.permanentData['object_name'] || '',
        };
        const filled = fillDocxTemplate(templateData, data);
        actsFolder.file(`АОСР_${act.actNumber}_${act.workName.substring(0, 30)}.docx`, filled);
      } catch {
        // Skip
      }
    }
  }

  // Export other acts
  for (const act of session.otherActs) {
    const template = session.templates.find(t => t.id === act.templateId);
    if (template && actsFolder) {
      try {
        const templateData = base64ToArrayBuffer(template.fileData);
        const data = {
          ...session.permanentData,
          ...act.values,
          object_name: session.permanentData['Объект строительства'] || session.permanentData['object_name'] || '',
        };
        const filled = fillDocxTemplate(templateData, data);
        actsFolder.file(`${template.name}_${act.id}.docx`, filled);
      } catch {
        // Skip
      }
    }
  }

  // Export appendices if requested
  if (withAppendices && appendicesFolder) {
    for (const appendix of session.appendices) {
      if (appendix.file) {
        const fileData = await appendix.file.arrayBuffer();
        appendicesFolder.file(appendix.fileName, fileData);
      }
    }
    for (const material of session.materials) {
      if (material.file) {
        const fileData = await material.file.arrayBuffer();
        appendicesFolder.file(material.fileName, fileData);
      }
    }
  }

  // Generate and download zip
  const content = await zip.generateAsync({ type: 'blob' });
  const FileSaver = (await import('file-saver')).default;
  FileSaver.saveAs(content, `${session.name}_комплект.zip`);
}
