// equipos.pdf.ts — genera el reporte PDF del inventario de equipos

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Equipo } from '../types/equipo.types';

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
      e.categoria?.nombre ?? '—',
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

// ── Ordenación numérica ────────────────────────────────────────────────────
function sortNumeracion(lista: Equipo[]): Equipo[] {
  return [...lista].sort((a, b) => {
    const na = (() => { const m = a.numeracion.match(/\d+/); return m ? parseInt(m[0], 10) : Infinity; })();
    const nb = (() => { const m = b.numeracion.match(/\d+/); return m ? parseInt(m[0], 10) : Infinity; })();
    if (na !== nb) return na - nb;
    return a.numeracion.localeCompare(b.numeracion, 'es', { numeric: true });
  });
}

// ── Helpers para tipos dinámicos ───────────────────────────────────────────

// Detecta si algún equipo del grupo tiene tarifas de renta
function hasRenta(lista: Equipo[]): boolean {
  return lista.some(e => e.rentaDia != null || e.rentaSemana != null || e.rentaMes != null);
}

function tipoLabelSection(nombre: string): string {
  return nombre.replace(/_/g, ' ');
}

// Orden de aparición: conocidos primero según lista, PESADA siempre al final,
// tipos nuevos desconocidos van entre los conocidos y PESADA
const TIPO_ORDER_KNOWN = ['LIVIANA', 'USO_PROPIO'];
function sortTipoNombres(nombres: string[]): string[] {
  return [...nombres].sort((a, b) => {
    if (a === 'PESADA') return 1;
    if (b === 'PESADA') return -1;
    const ia = TIPO_ORDER_KNOWN.indexOf(a);
    const ib = TIPO_ORDER_KNOWN.indexOf(b);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    return a.localeCompare(b);
  });
}

// ── Función principal ──────────────────────────────────────────────────────
export function generarReporteInventario(equipos: Equipo[]): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  const activos = equipos.filter(e => e.isActive);
  const baja    = sortNumeracion(equipos.filter(e => !e.isActive));

  // Derivar tipos directamente de los datos — soporta tipos nuevos automáticamente
  const tipoNombres = sortTipoNombres([...new Set(equipos.map(e => e.tipo.nombre))]);

  let y = 26;

  // ── Header ───────────────────────────────────────────────────────────────
  doc.setFillColor(...C.headerBg);
  doc.rect(0, 0, pageWidth, 20, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...C.headerText);
  doc.text('TUNSA — INVENTARIO DE EQUIPOS', 14, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Generado: ${fFechaHoy()}`, pageWidth - 14, 13, { align: 'right' });

  // ── Tarjetas resumen (una por tipo + TOTAL, dinámicas) ────────────────────
  const tipoStats = tipoNombres.map(nombre => {
    const eq = activos.filter(e => e.tipo.nombre === nombre);
    return { nombre, count: eq.length, total: eq.reduce((s, e) => s + e.montoCompra, 0) };
  });
  const totalGeneral = tipoStats.reduce((s, t) => s + t.total, 0);
  const totalCount   = tipoStats.reduce((s, t) => s + t.count, 0);

  const cards = [
    ...tipoStats.map(t => ({ label: t.nombre.replace(/_/g, ' '), count: t.count, monto: t.total })),
    { label: 'TOTAL ACTIVO', count: totalCount, monto: totalGeneral },
  ];
  const cardW = (pageWidth - 28 - (cards.length - 1) * 3) / cards.length;
  cards.forEach((c, i) => {
    const x = 14 + i * (cardW + 3);
    const isTotal = i === cards.length - 1;
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

  // ── Secciones dinámicas por tipo ──────────────────────────────────────────
  for (const nombre of tipoNombres) {
    const tipoEquipos = sortNumeracion(activos.filter(e => e.tipo.nombre === nombre));
    if (tipoEquipos.length === 0) continue;

    const tipoTotal = tipoEquipos.reduce((s, e) => s + e.montoCompra, 0);

    if (y > 165) { doc.addPage(); y = 26; }
    y = drawSectionTitle(doc, `${tipoLabelSection(nombre)} — ${tipoEquipos.length} equipos · ${fMoneda(tipoTotal)}`, y, pageWidth);
    y = drawTable(doc, tipoEquipos, y, hasRenta(tipoEquipos), false, pageWidth) + 5;
  }

  // ── Dados de baja (agrupados por tipo, dinámico) ──────────────────────────
  if (baja.length > 0) {
    if (y > 155) { doc.addPage(); y = 26; }
    y = drawSectionTitle(doc, `EQUIPOS DADOS DE BAJA — ${baja.length} equipos`, y, pageWidth);

    for (const nombre of tipoNombres) {
      const tipoBajas = sortNumeracion(baja.filter(e => e.tipo.nombre === nombre));
      if (tipoBajas.length === 0) continue;
      if (y > 170) { doc.addPage(); y = 26; }
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(...C.muted);
      doc.text(nombre.replace(/_/g, ' '), 16, y + 3);
      y += 5;
      y = drawTable(doc, tipoBajas, y, hasRenta(tipoBajas), true, pageWidth) + 4;
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
