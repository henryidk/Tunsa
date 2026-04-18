import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SolicitudRenta, DevolucionEntry, DevolucionItemEntry } from '../types/solicitud-renta.types';

// ── Constants ─────────────────────────────────────────────────────────────────

const EMPRESA = {
  linea1: 'San Juan Chamelco, Alta Verapaz',
  linea2: 'E-mail: gerencia@tunsa.com.gt',
  linea3: 'Teléfono: 7950-0095',
  linea4: 'WUATE, SOCIEDAD ANÓNIMA',
  nit:    'NIT: 10030249-1',
};

const COLORES = {
  primario:   [49,  80, 174] as [number, number, number],
  exitoso:    [22, 163,  74] as [number, number, number], // green-600
  texto:      [30,  41,  59] as [number, number, number],
  textoSuave: [100, 116, 139] as [number, number, number],
  borde:      [226, 232, 240] as [number, number, number],
  fondo:      [248, 250, 252] as [number, number, number],
  blanco:     [255, 255, 255] as [number, number, number],
  alerta:     [217, 119,   6] as [number, number, number], // amber-600
};

const FOOTER_RESERVE = 14;

// ── Logo loader ───────────────────────────────────────────────────────────────

async function cargarLogoBase64(src: string): Promise<string | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload  = () => resolve(el);
      el.onerror = reject;
      el.src = src;
    });

    const LOGO_PX = 160;
    const scale  = Math.min(LOGO_PX / img.width, LOGO_PX / img.height, 1);
    const w = Math.round(img.width  * scale);
    const h = Math.round(img.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width  = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    return canvas.toDataURL('image/jpeg', 0.82);
  } catch {
    return null;
  }
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function formatFechaHoraLarga(iso: string): string {
  return new Date(iso).toLocaleString('es-GT', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatQ(n: number): string {
  return `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`;
}

// ── Item label resolver ───────────────────────────────────────────────────────

/** Encuentra el label de un ítem dado su itemRef y kind dentro de la solicitud. */
function resolverLabelItem(
  solicitud:  SolicitudRenta,
  entry:      DevolucionItemEntry,
): string {
  const item = solicitud.items.find(i => {
    if (entry.kind === 'maquinaria') return i.kind === 'maquinaria' && i.equipoId === entry.itemRef;
    return i.kind === 'granel' && i.tipo === entry.itemRef;
  });

  if (!item) return entry.itemRef;

  if (item.kind === 'maquinaria') {
    return `#${item.numeracion} ${item.descripcion}`;
  }
  const label = item.tipoLabel + (item.conMadera ? ' (con madera)' : '');
  return `${item.cantidad.toLocaleString('es-GT')} × ${label}`;
}

// ── Main generator ────────────────────────────────────────────────────────────

/**
 * Genera el PDF de liquidación de una devolución y devuelve un Blob.
 * No descarga automáticamente — el llamador decide qué hacer con el blob
 * (subirlo al backend, mostrarlo en un iframe, etc.).
 */
export async function generarLiquidacion(
  solicitud:  SolicitudRenta,
  devolucion: DevolucionEntry,
): Promise<Blob> {
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const W     = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentBottom = pageH - FOOTER_RESERVE;

  const logoSrc = new URL('../assets/logo-tunsa.png', import.meta.url).href;
  const logoB64 = await cargarLogoBase64(logoSrc);

  let y = 12;

  // ── ENCABEZADO ──────────────────────────────────────────────────────────────

  doc.setFillColor(...COLORES.fondo);
  doc.roundedRect(10, y - 2, W - 20, 46, 3, 3, 'F');

  if (logoB64) {
    doc.addImage(logoB64, 'JPEG', 13, y + 2, 30, 30);
  }

  const cx = W / 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLORES.primario);
  doc.text(EMPRESA.linea4, cx, y + 6, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...COLORES.textoSuave);
  doc.text(EMPRESA.linea1, cx, y + 13, { align: 'center' });
  doc.text(EMPRESA.linea2, cx, y + 19, { align: 'center' });
  doc.text(EMPRESA.linea3, cx, y + 25, { align: 'center' });
  doc.text(EMPRESA.nit,    cx, y + 31, { align: 'center' });

  const rx = W - 13;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLORES.textoSuave);
  doc.text('FOLIO', rx, y + 4, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...COLORES.primario);
  doc.text(solicitud.folio ?? '—', rx, y + 11, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLORES.textoSuave);
  doc.text('Fecha devolución:', rx, y + 18, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLORES.texto);
  doc.text(formatFechaHoraLarga(devolucion.fechaDevolucion), rx, y + 25, { align: 'right' });

  y += 51;

  // ── TÍTULO LIQUIDACIÓN ───────────────────────────────────────────────────────

  const esTardia = devolucion.tipoDevolucion === 'TARDIA';
  doc.setFillColor(...(esTardia ? COLORES.alerta : COLORES.exitoso));
  doc.roundedRect(10, y, W - 20, 9, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLORES.blanco);
  doc.text(
    devolucion.esParcial
      ? 'LIQUIDACIÓN PARCIAL DE RENTA DE MAQUINARIA'
      : 'LIQUIDACIÓN DE RENTA DE MAQUINARIA',
    W / 2, y + 6.5,
    { align: 'center' },
  );

  y += 15;

  // ── DATOS DEL CLIENTE ────────────────────────────────────────────────────────

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLORES.primario);
  doc.text('INFORMACIÓN DEL CLIENTE', 14, y);
  y += 4;

  doc.setDrawColor(...COLORES.borde);
  doc.setLineWidth(0.3);
  doc.line(14, y, W - 14, y);
  y += 5;

  const campo = (label: string, valor: string, x: number, cy: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...COLORES.textoSuave);
    doc.text(label, x, cy);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...COLORES.texto);
    doc.text(valor, x, cy + 5.5);
  };

  const { cliente } = solicitud;
  campo('Nombre completo', cliente.nombre,           14,      y);
  campo('DPI',             cliente.dpi,              W / 2,   y);
  campo('Teléfono',        cliente.telefono ?? '—',  W - 60,  y);
  y += 14;

  campo(
    'Modalidad de pago',
    solicitud.modalidad === 'CONTADO' ? 'Contado' : 'Crédito',
    14, y,
  );
  campo('Registrado por', devolucion.registradoPor, W / 2, y);
  campo(
    'Tipo de devolución',
    devolucion.esParcial ? 'Parcial' : 'Completa',
    W - 60, y,
  );
  y += 14;

  // ── TABLA DE ÍTEMS DEVUELTOS ─────────────────────────────────────────────────

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLORES.primario);
  doc.text('DETALLE DE ÍTEMS DEVUELTOS', 14, y);
  y += 3;

  const filaItems: string[][] = devolucion.items.map(entry => [
    resolverLabelItem(solicitud, entry),
    `${entry.diasCobrados} día${entry.diasCobrados === 1 ? '' : 's'}`,
    formatQ(entry.costoReal),
    entry.recargoTiempo > 0 ? formatQ(entry.recargoTiempo) : '—',
    formatQ(entry.costoReal + entry.recargoTiempo),
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Equipo / Material', 'Días cobrados', 'Costo base', 'Recargo tiempo', 'Subtotal']],
    body: filaItems,
    margin: { left: 14, right: 14, bottom: FOOTER_RESERVE + 2 },
    styles: {
      fontSize: 11,
      cellPadding: 3,
      textColor: COLORES.texto,
      lineColor: COLORES.borde,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: COLORES.primario,
      textColor: COLORES.blanco,
      fontStyle: 'bold',
      fontSize: 11,
    },
    alternateRowStyles: {
      fillColor: [250, 252, 255] as [number, number, number],
    },
    columnStyles: {
      1: { halign: 'center', cellWidth: 28 },
      2: { halign: 'right',  cellWidth: 26 },
      3: { halign: 'right',  cellWidth: 28 },
      4: { halign: 'right',  cellWidth: 26, fontStyle: 'bold' },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 6;

  // ── CARGOS ADICIONALES ───────────────────────────────────────────────────────

  if (devolucion.recargosAdicionales.length > 0) {
    if (y + 40 > contentBottom) { doc.addPage(); y = 18; }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...COLORES.primario);
    doc.text('CARGOS ADICIONALES', 14, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [['Descripción', 'Monto']],
      body: devolucion.recargosAdicionales.map(c => [c.descripcion, formatQ(c.monto)]),
      margin: { left: 14, right: 14, bottom: FOOTER_RESERVE + 2 },
      styles: {
        fontSize: 11,
        cellPadding: 3,
        textColor: COLORES.texto,
        lineColor: COLORES.borde,
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: COLORES.alerta,
        textColor: COLORES.blanco,
        fontStyle: 'bold',
        fontSize: 11,
      },
      columnStyles: {
        1: { halign: 'right', cellWidth: 32, fontStyle: 'bold' },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── RESUMEN TOTAL ─────────────────────────────────────────────────────────────

  if (y + 30 > contentBottom) { doc.addPage(); y = 18; }

  const costoBase         = devolucion.items.reduce((s, i) => s + i.costoReal,     0);
  const totalRecargoTiempo = devolucion.items.reduce((s, i) => s + i.recargoTiempo, 0);
  const totalCargosAd     = devolucion.recargosAdicionales.reduce((s, c) => s + c.monto, 0);

  const boxW = 80;
  const boxX = W - 14 - boxW;

  doc.setFillColor(...COLORES.fondo);
  doc.roundedRect(boxX, y, boxW, 32, 2, 2, 'F');
  doc.setDrawColor(...COLORES.borde);
  doc.setLineWidth(0.3);
  doc.roundedRect(boxX, y, boxW, 32, 2, 2, 'S');

  const lineaResumen = (label: string, valor: string, ly: number, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 12 : 11);
    doc.setTextColor(...(bold ? COLORES.texto : COLORES.textoSuave));
    doc.text(label, boxX + 5, ly);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(bold ? 12 : 11);
    doc.setTextColor(...(bold ? COLORES.texto : COLORES.textoSuave));
    doc.text(valor, boxX + boxW - 5, ly, { align: 'right' });
  };

  lineaResumen('Costo base:',         formatQ(costoBase),          y + 8);
  if (totalRecargoTiempo > 0) {
    lineaResumen('Recargo por atraso:',  formatQ(totalRecargoTiempo), y + 15);
  }
  if (totalCargosAd > 0) {
    lineaResumen('Cargos adicionales:',  formatQ(totalCargosAd),      y + (totalRecargoTiempo > 0 ? 22 : 15));
  }

  // Línea separadora antes del total
  const totalLineY = y + 25;
  doc.setDrawColor(...COLORES.borde);
  doc.setLineWidth(0.3);
  doc.line(boxX + 5, totalLineY, boxX + boxW - 5, totalLineY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...COLORES.exitoso);
  doc.text('TOTAL', boxX + 5, totalLineY + 7);
  doc.text(formatQ(devolucion.totalLote), boxX + boxW - 5, totalLineY + 7, { align: 'right' });

  y += 42;

  // ── ESTADO GLOBAL DE LA RENTA ────────────────────────────────────────────────

  if (!devolucion.esParcial && solicitud.totalFinal !== null) {
    if (y + 20 > contentBottom) { doc.addPage(); y = 18; }

    doc.setFillColor(...COLORES.exitoso);
    doc.roundedRect(10, y, W - 20, 10, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...COLORES.blanco);
    doc.text(
      `RENTA COMPLETADA — Total final cobrado: ${formatQ(solicitud.totalFinal)}`,
      W / 2, y + 7,
      { align: 'center' },
    );
    y += 17;
  }

  if (devolucion.esParcial) {
    if (y + 12 > contentBottom) { doc.addPage(); y = 18; }
    doc.setFillColor(...COLORES.alerta);
    doc.roundedRect(10, y, W - 20, 10, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...COLORES.blanco);
    doc.text('DEVOLUCIÓN PARCIAL — La renta continúa con los equipos pendientes.', W / 2, y + 7, { align: 'center' });
    y += 17;
  }

  // ── PIE DE PÁGINA ─────────────────────────────────────────────────────────────

  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLORES.textoSuave);
    doc.text(
      'TUNSA — Documento generado electrónicamente.',
      W / 2, pageH - 5,
      { align: 'center' },
    );
  }

  return doc.output('blob');
}
