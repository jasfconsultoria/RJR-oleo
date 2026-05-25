import jsPDF from 'jspdf';
import { formatCnpjCpf } from '@/lib/utils';

const COLORS = {
  emerald: [5, 95, 80],
  emeraldLight: [16, 185, 129],
  text: [31, 41, 55],
  muted: [107, 114, 128],
  border: [209, 213, 219],
  headerFill: [236, 253, 245],
  totalFill: [240, 253, 244],
};

const PAGE_MARGIN = 10;
const LINE_HEIGHT = 4.2;

const asText = (value) => {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
};

const getCompanyName = (company) => {
  if (!company) return 'RJR Óleo';
  if (company.nome_fantasia && company.razao_social) {
    return `${company.nome_fantasia} - ${company.razao_social}`;
  }
  return company.nome_fantasia || company.razao_social || 'RJR Óleo';
};

const getCompanyAddress = (company) => {
  if (!company) return '';
  const cityState = [company.municipio, company.estado].filter(Boolean).join(' - ');
  return [company.endereco, cityState].filter(Boolean).join(' | ');
};

const loadImageAsDataUrl = async (url) => {
  if (!url) return null;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('Não foi possível carregar o logo do relatório:', error);
    return null;
  }
};

const getImageFormat = (dataUrl) => {
  if (typeof dataUrl !== 'string') return 'PNG';
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) return 'JPEG';
  if (dataUrl.startsWith('data:image/webp')) return 'WEBP';
  return 'PNG';
};

export async function generateReportPdf({
  title,
  subtitle,
  fileName,
  company,
  filters = [],
  summaryItems = [],
  subtotalTables = [],
  columns = [],
  rows = [],
  orientation = 'landscape',
  output = 'save',
}) {
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - PAGE_MARGIN * 2;
  let y = PAGE_MARGIN;

  const setTextColor = (color) => doc.setTextColor(color[0], color[1], color[2]);
  const setDrawColor = (color) => doc.setDrawColor(color[0], color[1], color[2]);
  const setFillColor = (color) => doc.setFillColor(color[0], color[1], color[2]);

  const ensureSpace = (height) => {
    if (y + height <= pageHeight - PAGE_MARGIN) return;
    doc.addPage();
    y = PAGE_MARGIN;
  };

  const drawText = (text, x, currentY, options = {}) => {
    setTextColor(options.color || COLORS.text);
    doc.setFont(options.font || 'helvetica', options.fontStyle || 'normal');
    doc.setFontSize(options.fontSize || 8);
    doc.text(Array.isArray(text) ? text : asText(text), x, currentY, {
      align: options.align || 'left',
      maxWidth: options.maxWidth,
    });
  };

  const drawHeader = async () => {
    const logoDataUrl = await loadImageAsDataUrl(company?.logo_documento_url || company?.logo_sistema_url);
    const headerHeight = 34;

    setDrawColor(COLORS.border);
    doc.setLineWidth(0.2);
    doc.rect(PAGE_MARGIN, PAGE_MARGIN, contentWidth, headerHeight);

    if (logoDataUrl) {
      doc.addImage(logoDataUrl, getImageFormat(logoDataUrl), PAGE_MARGIN + 4, PAGE_MARGIN + 5, 38, 20, undefined, 'FAST');
    } else {
      drawText(getCompanyName(company), PAGE_MARGIN + 4, PAGE_MARGIN + 15, {
        color: COLORS.emerald,
        fontSize: 13,
        fontStyle: 'bold',
        maxWidth: 50,
      });
    }

    const companyX = pageWidth - PAGE_MARGIN - 4;
    drawText(getCompanyName(company), companyX, PAGE_MARGIN + 8, {
      color: [0, 0, 0],
      font: 'times',
      fontSize: 10,
      fontStyle: 'bold',
      align: 'right',
      maxWidth: 125,
    });
    drawText(`CNPJ: ${formatCnpjCpf(company?.cnpj) || '-'}`, companyX, PAGE_MARGIN + 13, {
      color: [0, 0, 0],
      font: 'times',
      fontSize: 8,
      align: 'right',
    });
    if (getCompanyAddress(company)) {
      drawText(getCompanyAddress(company), companyX, PAGE_MARGIN + 18, {
        color: [0, 0, 0],
        font: 'times',
        fontSize: 8,
        align: 'right',
        maxWidth: 125,
      });
    }
    drawText(`Telefone: ${company?.telefone || '-'} | Email: ${company?.email || '-'}`, companyX, PAGE_MARGIN + 27, {
      color: [0, 0, 0],
      font: 'times',
      fontSize: 8,
      align: 'right',
      maxWidth: 125,
    });

    y = PAGE_MARGIN + headerHeight + 8;
    drawText(title.toUpperCase(), pageWidth / 2, y, {
      color: [0, 0, 0],
      font: 'times',
      fontSize: 12,
      fontStyle: 'bold',
      align: 'center',
    });
    if (subtitle) {
      y += 5;
      drawText(subtitle, pageWidth / 2, y, {
        color: COLORS.muted,
        fontSize: 7.5,
        align: 'center',
        maxWidth: contentWidth,
      });
    }
    y += 4;
    setDrawColor(COLORS.emerald);
    doc.line(PAGE_MARGIN, y, pageWidth - PAGE_MARGIN, y);
    y += 5;
    drawText(`Gerado em ${new Date().toLocaleString('pt-BR')}`, pageWidth - PAGE_MARGIN, y - 1, {
      color: COLORS.muted,
      fontSize: 6.5,
      align: 'right',
    });
  };

  const drawSectionTitle = (text) => {
    ensureSpace(8);
    drawText(text, PAGE_MARGIN, y, { color: COLORS.emerald, fontSize: 10, fontStyle: 'bold' });
    y += 5;
  };

  const drawKeyValues = (items, titleText) => {
    if (!items.length) return;
    drawSectionTitle(titleText);

    const columnsPerRow = 4;
    const gap = 3;
    const cellWidth = (contentWidth - gap * (columnsPerRow - 1)) / columnsPerRow;
    const cellHeight = 8;

    items.forEach((item, index) => {
      const col = index % columnsPerRow;
      if (col === 0) ensureSpace(cellHeight + 2);

      const x = PAGE_MARGIN + col * (cellWidth + gap);
      setDrawColor(COLORS.border);
      setFillColor([255, 255, 255]);
      doc.rect(x, y, cellWidth, cellHeight, 'FD');
      drawText(item.label, x + 1.5, y + 3, { color: COLORS.muted, fontSize: 5.8 });
      drawText(item.value, x + 1.5, y + 6.4, {
        color: COLORS.text,
        fontSize: 7,
        fontStyle: 'bold',
        maxWidth: cellWidth - 3,
      });

      if (col === columnsPerRow - 1 || index === items.length - 1) {
        y += cellHeight + 3;
      }
    });
  };

  const resolveColumnWidths = (tableColumns) => {
    const fixedWidth = tableColumns.reduce((sum, column) => sum + (column.width || 0), 0);
    const flexibleColumns = tableColumns.filter(column => !column.width).length;
    const flexibleWidth = flexibleColumns > 0 ? (contentWidth - fixedWidth) / flexibleColumns : 0;
    return tableColumns.map(column => column.width || flexibleWidth);
  };

  const drawTableHeader = (tableColumns, widths, xStart) => {
    let x = xStart;
    const headerHeight = 7;
    setFillColor(COLORS.emerald);
    setDrawColor(COLORS.emerald);
    doc.rect(xStart, y, contentWidth, headerHeight, 'F');

    tableColumns.forEach((column, index) => {
      drawText(column.header, x + 1.5, y + 4.7, {
        color: [255, 255, 255],
        fontSize: 6.5,
        fontStyle: 'bold',
        maxWidth: widths[index] - 3,
      });
      x += widths[index];
    });

    y += headerHeight;
  };

  const drawTable = (titleText, tableColumns, tableRows, options = {}) => {
    if (!tableRows.length || !tableColumns.length) return;
    drawSectionTitle(titleText);

    const widths = resolveColumnWidths(tableColumns);
    const xStart = PAGE_MARGIN;
    drawTableHeader(tableColumns, widths, xStart);

    tableRows.forEach((row, rowIndex) => {
      const cellLines = tableColumns.map((column, index) => {
        const value = typeof column.accessor === 'function' ? column.accessor(row) : row[column.accessor];
        return doc.splitTextToSize(asText(value), widths[index] - 3);
      });
      const maxLines = Math.max(...cellLines.map(lines => lines.length), 1);
      const rowHeight = Math.max(options.minRowHeight || 6, maxLines * LINE_HEIGHT + 2);

      ensureSpace(rowHeight + 7);
      if (y === PAGE_MARGIN) {
        drawTableHeader(tableColumns, widths, xStart);
      }

      setFillColor(row.isTotal ? COLORS.totalFill : (rowIndex % 2 === 0 ? [255, 255, 255] : [249, 250, 251]));
      setDrawColor(COLORS.border);
      doc.rect(xStart, y, contentWidth, rowHeight, 'FD');

      let x = xStart;
      tableColumns.forEach((column, index) => {
        const align = column.align || 'left';
        const textX = align === 'right' ? x + widths[index] - 1.5 : x + 1.5;
        drawText(cellLines[index], textX, y + 4, {
          color: COLORS.text,
          fontSize: options.fontSize || 6.8,
          fontStyle: row.isTotal ? 'bold' : 'normal',
          align,
          maxWidth: widths[index] - 3,
        });
        x += widths[index];
      });

      y += rowHeight;
    });

    y += 4;
  };

  await drawHeader();
  drawKeyValues(filters, 'Filtros aplicados');
  drawKeyValues(summaryItems, 'Totais do período');
  drawTable('Dados detalhados', columns, rows, { minRowHeight: 7, fontSize: 6.5 });
  subtotalTables.forEach(table => drawTable(table.title, table.columns, table.rows, {
    minRowHeight: 6,
    fontSize: 7,
  }));

  const pageCount = doc.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    doc.setPage(pageNumber);
    setDrawColor(COLORS.border);
    doc.line(PAGE_MARGIN, pageHeight - 8, pageWidth - PAGE_MARGIN, pageHeight - 8);
    drawText(`Pagina ${pageNumber} de ${pageCount}`, pageWidth - PAGE_MARGIN, pageHeight - 4, {
      color: COLORS.muted,
      fontSize: 7,
      align: 'right',
    });
  }

  if (output === 'bloburl') {
    return URL.createObjectURL(doc.output('blob'));
  }

  if (output === 'blob') {
    return doc.output('blob');
  }

  doc.save(fileName);
  return null;
}

export function printPdfBlobUrl(pdfUrl) {
  const iframe = document.createElement('iframe');
  let cleaned = false;

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    setTimeout(() => {
      iframe.remove();
      URL.revokeObjectURL(pdfUrl);
    }, 1000);
  };

  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.src = pdfUrl;
  iframe.onload = () => {
    const frameWindow = iframe.contentWindow;
    if (!frameWindow) {
      window.open(pdfUrl, '_blank', 'noopener,noreferrer');
      cleanup();
      return;
    }

    frameWindow.addEventListener('afterprint', cleanup, { once: true });
    frameWindow.focus();
    frameWindow.print();
    setTimeout(cleanup, 60000);
  };

  document.body.appendChild(iframe);
}
