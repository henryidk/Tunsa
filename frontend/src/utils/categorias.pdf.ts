// categorias.pdf.ts — reporte PDF detallado por tipo y categoría

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Equipo } from '../types/equipo.types';
import type { TipoAdmin } from '../services/categorias.service';

// ── Colores (misma paleta que equipos.pdf.ts) ──────────────────────────────
const C = {
  headerBg:   [30,  41,  90]  as [number, number, number],
  headerText: [255, 255, 255] as [number, number, number],
  sectionBg:  [67,  97,  238] as [number, number, number],
  sectionText:[255, 255, 255] as [number, number, number],
  subBg:      [203, 213, 225] as [number, number, number],  // slate-300
  subText:    [15,  23,  42]  as [number, number, number],
  sinCatBg:   [253, 230, 138] as [number, number, number],  // amber-200
  sinCatText: [120,  53,  15]  as [number, number, number],
  altRow:     [248, 249, 255] as [number, number, number],
  totalBg:    [226, 232, 240] as [number, number, number],
  totalText:  [15,  23,  42]  as [number, number, number],
  bodyText:   [30,  41,  59]  as [number, number, number],
  muted:      [100, 116, 139] as [number, number, number],
  bajaBg:     [254, 242, 242] as [number, number, number],
  bajaText:   [153,  27,  27] as [number, number, number],
  bajaSecBg:  [220,  38,  38] as [number, number, number],
};

// ── Labels de tipo — clave para futuro: cualquier tipo nuevo no mapeado
//    usa su propio nombre como fallback ────────────────────────────────────
const TIPO_LABEL_FULL: Record<string, string> = {
  LIVIANA:    'MAQUINARIA LIVIANA',
  PESADA:     'MAQUINARIA PESADA',
  USO_PROPIO: 'EQUIPO USO PROPIO',
};
function tipoLabel(nombre: string): string {
  return TIPO_LABEL_FULL[nombre] ?? nombre.replace(/_/g, ' ');
}

// Mismo orden que equipos.pdf.ts:
// conocidos primero (LIVIANA, USO_PROPIO), desconocidos alfabético, PESADA siempre al final
const TIPO_ORDER_KNOWN = ['LIVIANA', 'USO_PROPIO'];
function sortTipos(tipos: TipoAdmin[]): TipoAdmin[] {
  return [...tipos].sort((a, b) => {
    if (a.nombre === 'PESADA') return 1;
    if (b.nombre === 'PESADA') return -1;
    const ia = TIPO_ORDER_KNOWN.indexOf(a.nombre);
    const ib = TIPO_ORDER_KNOWN.indexOf(b.nombre);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    return a.nombre.localeCompare(b.nombre);
  });
}

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

// Ordena numéricamente; sin número al final
function sortNumeracion(lista: Equipo[]): Equipo[] {
  return [...lista].sort((a, b) => {
    const na = (() => { const m = a.numeracion.match(/\d+/); return m ? parseInt(m[0], 10) : Infinity; })();
    const nb = (() => { const m = b.numeracion.match(/\d+/); return m ? parseInt(m[0], 10) : Infinity; })();
    if (na !== nb) return na - nb;
    return a.numeracion.localeCompare(b.numeracion, 'es', { numeric: true });
  });
}

// Detecta si algún equipo de la lista tiene tarifas de renta
function hasRenta(lista: Equipo[]): boolean {
  return lista.some(e => e.rentaDia != null || e.rentaSemana != null || e.rentaMes != null);
}

// ── Encabezado de página ───────────────────────────────────────────────────
function drawPageHeader(doc: jsPDF, pageWidth: number) {
  doc.setFillColor(...C.headerBg);
  doc.rect(0, 0, pageWidth, 20, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...C.headerText);
  doc.text('TUNSA — REPORTE DE CATEGORÍAS', 14, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Generado: ${fFechaHoy()}`, pageWidth - 14, 13, { align: 'right' });
}

// ── Título de sección (nivel tipo) ────────────────────────────────────────
function drawSectionTitle(
  doc: jsPDF, title: string, y: number, pageWidth: number, isBaja = false,
): number {
  doc.setFillColor(...(isBaja ? C.bajaSecBg : C.sectionBg));
  doc.rect(14, y, pageWidth - 28, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.sectionText);
  doc.text(title, 17, y + 4.8);
  return y + 9;
}

// ── Título de sub-sección (nivel categoría) ───────────────────────────────
function drawSubSectionTitle(
  doc: jsPDF, title: string, y: number, pageWidth: number, isSinCat = false,
): number {
  doc.setFillColor(...(isSinCat ? C.sinCatBg : C.subBg));
  doc.rect(14, y, pageWidth - 28, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...(isSinCat ? C.sinCatText : C.subText));
  doc.text(title, 18, y + 4.2);
  return y + 7;
}

// ── Tabla de equipos ───────────────────────────────────────────────────────
// includeCategoria: muestra columna "Categoría" (usado en dados de baja)
function drawTable(
  doc: jsPDF,
  rows: Equipo[],
  startY: number,
  includeRenta: boolean,
  isBaja: boolean,
  pageWidth: number,
  includeCategoria = false,
): number {
  // Construir cabecera dinámicamente
  const headerRow: string[] = ['No.', 'Descripción'];
  if (includeCategoria) headerRow.push('Categoría');
  headerRow.push('Serie equipo / motor', 'Monto compra');
  if (includeRenta) headerRow.push('Renta / día', 'Renta / semana', 'Renta / mes');
  headerRow.push('Fecha compra');
  if (isBaja) headerRow.push('Motivo de baja');

  const body = rows.map(e => {
    const row: string[] = [e.numeracion, e.descripcion];
    if (includeCategoria) row.push(e.categoria?.nombre ?? '—');
    row.push(e.serie ?? '—', fMoneda(e.montoCompra));
    if (includeRenta) row.push(fMoneda(e.rentaDia), fMoneda(e.rentaSemana), fMoneda(e.rentaMes));
    row.push(fFecha(e.fechaCompra));
    if (isBaja) row.push(e.motivoBaja ?? '—');
    return row;
  });

  // Anchos de columna según combinación de flags
  // Ancho disponible ≈ 269mm (A4 landscape con márgenes 14mm c/u)
  let colWidths: number[];
  if (includeRenta) {
    if (isBaja && includeCategoria)  colWidths = [13, 48, 25, 40, 20, 17, 20, 17, 20, 42];
    else if (isBaja)                 colWidths = [13, 58, 48, 20, 17, 20, 17, 20, 46];
    else if (includeCategoria)       colWidths = [13, 62, 26, 50, 22, 18, 22, 18, 22];
    else                             colWidths = [13, 72, 60, 22, 18, 22, 18, 22];
  } else {
    if (isBaja && includeCategoria)  colWidths = [13, 78, 30, 62, 24, 22, 42];
    else if (isBaja)                 colWidths = [13, 90, 68, 24, 22, 48];
    else if (includeCategoria)       colWidths = [13, 90, 28, 80, 26, 22];
    else                             colWidths = [13, 112, 82, 26, 22];
  }

  // Índices de columnas con formato especial
  let colIdx = 0;
  const iNo        = colIdx++;                        // 0
  const iDesc      = colIdx++;                        // 1
  const iCat       = includeCategoria ? colIdx++ : -1;
  const iSerie     = colIdx++;
  const iMonto     = colIdx++;
  const iRentaDia  = includeRenta ? colIdx++ : -1;
  const iRentaSem  = includeRenta ? colIdx++ : -1;
  const iRentaMes  = includeRenta ? colIdx++ : -1;
  const iFecha     = colIdx++;
  const iMotivo    = isBaja ? colIdx : -1;

  autoTable(doc, {
    head: [headerRow],
    body,
    startY,
    margin: { left: 14, right: 14 },
    tableWidth: pageWidth - 28,
    columnStyles: (() => {
      const s: Record<number, object> = {};
      s[iNo]    = { font: 'courier', fontStyle: 'bold', halign: 'center', cellWidth: colWidths[iNo] };
      s[iDesc]  = { cellWidth: colWidths[iDesc] };
      if (iCat >= 0)    s[iCat]    = { cellWidth: colWidths[iCat] };
      s[iSerie] = { font: 'courier', fontSize: 6.5, cellWidth: colWidths[iSerie] };
      s[iMonto] = { font: 'courier', halign: 'right', cellWidth: colWidths[iMonto] };
      if (iRentaDia >= 0) s[iRentaDia] = { font: 'courier', halign: 'right', cellWidth: colWidths[iRentaDia] };
      if (iRentaSem >= 0) s[iRentaSem] = { font: 'courier', halign: 'right', cellWidth: colWidths[iRentaSem] };
      if (iRentaMes >= 0) s[iRentaMes] = { font: 'courier', halign: 'right', cellWidth: colWidths[iRentaMes] };
      s[iFecha] = { halign: 'center', cellWidth: colWidths[iFecha] };
      if (iMotivo >= 0) s[iMotivo] = { fontSize: 6.5, textColor: C.bajaText, cellWidth: colWidths[iMotivo] };
      return s;
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
    didDrawPage: () => {
      drawPageHeader(doc, pageWidth);
    },
  });

  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

// ── Función principal ──────────────────────────────────────────────────────
// tipos: lista de tipos con sus categorías (dinámica — soporta nuevos tipos/categorías)
// equipos: TODOS los equipos (activos + dados de baja)
export function generarReporteCategorias(tipos: TipoAdmin[], equipos: Equipo[]): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  const activos = equipos.filter(e => e.isActive);
  const bajas   = sortNumeracion(equipos.filter(e => !e.isActive));

  let y = 26;

  // ── Header inicial ───────────────────────────────────────────────────────
  drawPageHeader(doc, pageWidth);

  // ── Tarjetas resumen (una por tipo + TOTAL) ───────────────────────────────
  const tipoStats = tipos.map(t => {
    const eq = activos.filter(e => e.tipo.nombre === t.nombre);
    return {
      label: tipoLabel(t.nombre),
      cats:  t.categorias.length,
      count: eq.length,
      total: eq.reduce((s, e) => s + e.montoCompra, 0),
    };
  });
  const totalEquipos = tipoStats.reduce((s, t) => s + t.count, 0);
  const totalGeneral = tipoStats.reduce((s, t) => s + t.total, 0);
  const allCards = [
    ...tipoStats,
    { label: 'TOTAL ACTIVO', cats: tipoStats.reduce((s, t) => s + t.cats, 0), count: totalEquipos, total: totalGeneral },
  ];

  const cardW = (pageWidth - 28 - (allCards.length - 1) * 3) / allCards.length;
  allCards.forEach((c, i) => {
    const x = 14 + i * (cardW + 3);
    const isTotal = i === allCards.length - 1;
    doc.setFillColor(...(isTotal ? C.sectionBg : C.totalBg));
    doc.roundedRect(x, y, cardW, 16, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isTotal ? 8 : 7.5);
    doc.setTextColor(...(isTotal ? C.headerText : C.totalText));
    doc.text(c.label, x + 3, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.text(`${c.cats} categoría${c.cats !== 1 ? 's' : ''} · ${c.count} equipo${c.count !== 1 ? 's' : ''}`, x + 3, y + 10);
    doc.setFont('courier', 'bold');
    doc.setFontSize(6.5);
    doc.text(fMoneda(c.total), x + cardW - 3, y + 10, { align: 'right' });
  });
  y += 20;

  // ── Secciones dinámicas por tipo → categoría ─────────────────────────────
  for (const tipo of sortTipos(tipos)) {
    const tipoActivos = activos.filter(e => e.tipo.nombre === tipo.nombre);
    if (tipoActivos.length === 0 && tipo.categorias.length === 0) continue;

    const tipoTotal = tipoActivos.reduce((s, e) => s + e.montoCompra, 0);
    const tipoRenta = hasRenta(tipoActivos);

    if (y > 165) { doc.addPage(); y = 26; }
    y = drawSectionTitle(
      doc,
      `${tipoLabel(tipo.nombre)} — ${tipo.categorias.length} categoría${tipo.categorias.length !== 1 ? 's' : ''} · ${tipoActivos.length} equipo${tipoActivos.length !== 1 ? 's' : ''} · ${fMoneda(tipoTotal)}`,
      y, pageWidth,
    );

    // Todas las categorías del tipo, incluso las que no tienen equipos aún
    for (const cat of tipo.categorias) {
      const catEquipos = sortNumeracion(tipoActivos.filter(e => e.categoriaId === cat.id));
      if (y > 175) { doc.addPage(); y = 26; }
      y = drawSubSectionTitle(doc, `${cat.nombre} — ${catEquipos.length} equipo${catEquipos.length !== 1 ? 's' : ''}`, y, pageWidth);
      if (catEquipos.length === 0) {
        y += 4;
      } else {
        y = drawTable(doc, catEquipos, y, tipoRenta, false, pageWidth) + 4;
      }
    }

    // Sin categoría (tono ámbar para distinguirlos)
    const sinCat = sortNumeracion(tipoActivos.filter(e => !e.categoriaId));
    if (sinCat.length > 0) {
      if (y > 175) { doc.addPage(); y = 26; }
      y = drawSubSectionTitle(doc, `Sin categoría — ${sinCat.length} equipo${sinCat.length !== 1 ? 's' : ''}`, y, pageWidth, true);
      y = drawTable(doc, sinCat, y, tipoRenta, false, pageWidth) + 4;
    }

    y += 4;
  }

  // ── Dados de baja (agrupados por tipo) ────────────────────────────────────
  if (bajas.length > 0) {
    if (y > 155) { doc.addPage(); y = 26; }
    y = drawSectionTitle(doc, `EQUIPOS DADOS DE BAJA — ${bajas.length} equipo${bajas.length !== 1 ? 's' : ''}`, y, pageWidth, true);

    for (const tipo of sortTipos(tipos)) {
      const tipoBajas = sortNumeracion(bajas.filter(e => e.tipo.nombre === tipo.nombre));
      if (tipoBajas.length === 0) continue;
      if (y > 175) { doc.addPage(); y = 26; }
      // En dados de baja mostramos también la columna Categoría (contexto útil)
      y = drawSubSectionTitle(doc, tipoLabel(tipo.nombre), y, pageWidth);
      y = drawTable(doc, tipoBajas, y, hasRenta(tipoBajas), true, pageWidth, true) + 4;
    }

    // Dados de baja de tipos que aún no están en la lista (nuevo tipo eliminado)
    const tipoNombres = new Set(tipos.map(t => t.nombre));
    const huerfanos = sortNumeracion(bajas.filter(e => !tipoNombres.has(e.tipo.nombre)));
    if (huerfanos.length > 0) {
      if (y > 175) { doc.addPage(); y = 26; }
      y = drawSubSectionTitle(doc, 'Otros tipos', y, pageWidth);
      y = drawTable(doc, huerfanos, y, hasRenta(huerfanos), true, pageWidth, true) + 4;
    }
  }

  // ── Pie de página en todas las páginas ────────────────────────────────────
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
  doc.save(`categorias_equipos_${fecha}.pdf`);
}
