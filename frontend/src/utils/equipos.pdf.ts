// equipos.pdf.ts — genera el reporte PDF del inventario de equipos

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Equipo } from '../types/equipo.types';
import { TIPO_LABEL } from '../types/equipo.types';

// ── Colores ────────────────────────────────────────────────────────────────
const C = {
  headerBg:   [30,  41,  90]  as [number, number, number], // azul marino oscuro
  headerText: [255, 255, 255] as [number, number, number],
  sectionBg:  [67,  97,  238] as [number, number, number], // indigo-600
  sectionText:[255, 255, 255] as [number, number, number],
  altRow:     [248, 249, 255] as [number, number, number],
  totalBg:    [226, 232, 240] as [number, number, number],
  totalText:  [15,  23,  42]  as [number, number, number],
  bodyText:   [30,  41,  59]  as [number, number, number],
  muted:      [100, 116, 139] as [number, number, number],
  bajaBg:     [254, 242, 242] as [number, number, number],
  bajaText:   [153,  27,  27] as [number, number, number],
};

// ── Helpers ────────────────────────────────────────────────────────────────
function fMoneda(v: number | null | undefined): string {
  if (v == null) return '—';
  return `Q ${v.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fFechaHoy(): string {
  return new Date().toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── Encabezado de página ───────────────────────────────────────────────────
function drawPageHeader(doc: jsPDF, pageWidth: number) {
  // Banda de color
  doc.setFillColor(...C.headerBg);
  doc.rect(0, 0, pageWidth, 20, 'F');

  // Título principal
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...C.headerText);
  doc.text('TUNSA — INVENTARIO DE EQUIPOS', 14, 13);

  // Fecha en la esquina derecha
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Generado: ${fFechaHoy()}`, pageWidth - 14, 13, { align: 'right' });
}

// ── Título de sección ──────────────────────────────────────────────────────
function drawSectionTitle(doc: jsPDF, title: string, y: number, pageWidth: number): number {
  doc.setFillColor(...C.sectionBg);
  doc.rect(14, y, pageWidth - 28, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.sectionText);
  doc.text(title, 17, y + 4.8);
  return y + 9;
}

// ── Tabla de equipos ───────────────────────────────────────────────────────
function drawTable(
  doc: jsPDF,
  rows: Equipo[],
  startY: number,
  includeRenta: boolean,
  isBaja: boolean,
  pageWidth: number,
): number {
  const head = includeRenta
    ? [['No.', 'Descripción', 'Categoría', 'Serie equipo / motor', 'Monto compra', 'Renta / día', 'Renta / semana', 'Renta / mes', 'Fecha compra']]
    : [['No.', 'Descripción', 'Categoría', 'Serie equipo / motor', 'Monto compra', 'Fecha compra']];

  const body = rows.map(e => {
    const base = [
      e.numeracion,
      e.descripcion,
      e.categoria,
      e.serie ?? '—',
      fMoneda(e.montoCompra),
    ];
    if (includeRenta) {
      base.push(fMoneda(e.rentaDia), fMoneda(e.rentaSemana), fMoneda(e.rentaMes));
    }
    base.push(fFecha(e.fechaCompra));
    if (isBaja && e.motivoBaja) base.push(e.motivoBaja);
    return base;
  });

  // Si es baja, añadir columna motivo
  if (isBaja) {
    head[0].push('Motivo de baja');
  }

  const colWidths = includeRenta
    ? isBaja
      ? [12, 60, 28, 48, 22, 18, 22, 18, 20, 45]  // con renta + motivo
      : [12, 65, 28, 55, 22, 18, 22, 18, 20]        // con renta
    : isBaja
      ? [12, 80, 30, 60, 22, 20, 45]               // sin renta + motivo
      : [12, 90, 32, 70, 24, 22];                  // sin renta (uso propio / pesada)

  autoTable(doc, {
    head,
    body,
    startY,
    margin: { left: 14, right: 14 },
    tableWidth: pageWidth - 28,

    columnStyles: (() => {
      const styles: Record<number, object> = {};
      // montos y rentas en monospace
      const monoIdx = includeRenta ? [4, 5, 6, 7] : [4];
      monoIdx.forEach(i => { styles[i] = { font: 'courier', halign: 'right', cellWidth: colWidths[i] }; });
      // Numeracion
      styles[0] = { font: 'courier', fontStyle: 'bold', cellWidth: colWidths[0], halign: 'center' };
      // descripcion
      styles[1] = { cellWidth: colWidths[1] };
      // categoria
      styles[2] = { cellWidth: colWidths[2] };
      // serie
      styles[3] = { font: 'courier', fontSize: 6.5, cellWidth: colWidths[3] };
      // fecha compra
      const fechaIdx = includeRenta ? 8 : 5;
      styles[fechaIdx] = { halign: 'center', cellWidth: colWidths[fechaIdx] };
      // motivo si aplica
      if (isBaja) {
        const motivoIdx = includeRenta ? 9 : 6;
        styles[motivoIdx] = { fontSize: 6.5, cellWidth: colWidths[motivoIdx], textColor: C.bajaText };
      }
      return styles;
    })(),

    headStyles: {
      fillColor: C.headerBg,
      textColor: C.headerText,
      fontStyle: 'bold',
      fontSize: 7,
      cellPadding: 2.5,
    },
    bodyStyles: {
      fontSize: 7.2,
      cellPadding: 2,
      textColor: C.bodyText,
      lineColor: [220, 224, 235],
      lineWidth: 0.1,
    },
    alternateRowStyles: {
      fillColor: isBaja ? C.bajaBg : C.altRow,
    },
    didDrawPage: (_data) => {
      drawPageHeader(doc, pageWidth);
    },
  });

  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

// ── Función principal ──────────────────────────────────────────────────────
export function generarReporteInventario(equipos: Equipo[]): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  const liviana   = equipos.filter(e => e.isActive && e.tipo === 'LIVIANA');
  const pesada    = equipos.filter(e => e.isActive && e.tipo === 'PESADA');
  const usoProp   = equipos.filter(e => e.isActive && e.tipo === 'USO_PROPIO');
  const baja      = equipos.filter(e => !e.isActive);

  // Totales
  const totalLiviana  = liviana.reduce((s, e) => s + e.montoCompra, 0);
  const totalPesada   = pesada.reduce((s, e) => s + e.montoCompra, 0);
  const totalUso      = usoProp.reduce((s, e) => s + e.montoCompra, 0);
  const totalGeneral  = totalLiviana + totalPesada + totalUso;

  let y = 26;

  // ── Resumen estadístico ──────────────────────────────────────────────────
  doc.setFillColor(...C.headerBg);
  doc.rect(0, 0, pageWidth, 20, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...C.headerText);
  doc.text('TUNSA — INVENTARIO DE EQUIPOS', 14, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Generado: ${fFechaHoy()}`, pageWidth - 14, 13, { align: 'right' });

  // Tarjetas resumen
  const cards = [
    { label: 'Maq. Liviana', count: liviana.length,   monto: totalLiviana },
    { label: 'Maq. Pesada',  count: pesada.length,    monto: totalPesada  },
    { label: 'Uso Propio',   count: usoProp.length,   monto: totalUso     },
    { label: 'TOTAL ACTIVO', count: liviana.length + pesada.length + usoProp.length, monto: totalGeneral },
  ];
  const cardW = (pageWidth - 28 - 9) / 4;
  cards.forEach((c, i) => {
    const x = 14 + i * (cardW + 3);
    const isTotal = i === 3;
    doc.setFillColor(...(isTotal ? C.sectionBg : C.totalBg));
    doc.roundedRect(x, y, cardW, 13, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isTotal ? 8.5 : 7.5);
    doc.setTextColor(...(isTotal ? C.headerText : C.totalText));
    doc.text(c.label, x + 3, y + 4.5);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(`${c.count} equipos`, x + 3, y + 8.5);
    doc.setFont('courier', 'bold');
    doc.setFontSize(6.5);
    doc.text(fMoneda(c.monto), x + cardW - 3, y + 8.5, { align: 'right' });
  });
  y += 17;

  // ── Maquinaria Liviana ───────────────────────────────────────────────────
  if (liviana.length > 0) {
    y = drawSectionTitle(doc, `MAQUINARIA LIVIANA — ${liviana.length} equipos · ${fMoneda(totalLiviana)}`, y, pageWidth);
    y = drawTable(doc, liviana, y, true, false, pageWidth) + 5;
  }

  // ── Maquinaria Pesada ────────────────────────────────────────────────────
  if (pesada.length > 0) {
    if (y > 165) { doc.addPage(); y = 26; }
    y = drawSectionTitle(doc, `MAQUINARIA PESADA — ${pesada.length} equipos · ${fMoneda(totalPesada)}`, y, pageWidth);
    y = drawTable(doc, pesada, y, false, false, pageWidth) + 5;
  }

  // ── Equipo uso propio ────────────────────────────────────────────────────
  if (usoProp.length > 0) {
    if (y > 165) { doc.addPage(); y = 26; }
    y = drawSectionTitle(doc, `EQUIPO USO PROPIO — ${usoProp.length} equipos · ${fMoneda(totalUso)}`, y, pageWidth);
    y = drawTable(doc, usoProp, y, false, false, pageWidth) + 5;
  }

  // ── Dados de baja ────────────────────────────────────────────────────────
  if (baja.length > 0) {
    if (y > 155) { doc.addPage(); y = 26; }
    const livBaja  = baja.filter(e => e.tipo === 'LIVIANA');
    const pesaBaja = baja.filter(e => e.tipo !== 'LIVIANA');

    y = drawSectionTitle(doc, `EQUIPOS DADOS DE BAJA — ${baja.length} equipos`, y, pageWidth);

    if (livBaja.length > 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(...C.muted);
      doc.text(TIPO_LABEL['LIVIANA'], 16, y + 3);
      y += 5;
      y = drawTable(doc, livBaja, y, true, true, pageWidth) + 4;
    }
    if (pesaBaja.length > 0) {
      if (y > 170) { doc.addPage(); y = 26; }
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(...C.muted);
      doc.text(TIPO_LABEL['PESADA'], 16, y + 3);
      y += 5;
      y = drawTable(doc, pesaBaja, y, false, true, pageWidth) + 4;
    }
  }

  // ── Pie de página final ──────────────────────────────────────────────────
  const totalPages = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFillColor(...C.totalBg);
    doc.rect(0, pageH - 8, pageWidth, 8, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text('TUNSA — Documento generado automáticamente. No requiere firma.', 14, pageH - 3);
    doc.text(`Página ${p} de ${totalPages}`, pageWidth - 14, pageH - 3, { align: 'right' });
  }

  const fecha = new Date().toISOString().slice(0, 10);
  doc.save(`inventario_equipos_${fecha}.pdf`);
}
