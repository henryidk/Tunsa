import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SolicitudRenta, DevolucionEntry, ItemSnapshot } from '../types/solicitud-renta.types';
import type { LecturaHorometro } from '../services/solicitudes.service';
import { resolverLabelItem } from './devolucion.helpers';

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
  exitoso:    [22, 163,  74] as [number, number, number],
  texto:      [30,  41,  59] as [number, number, number],
  textoSuave: [100, 116, 139] as [number, number, number],
  borde:      [226, 232, 240] as [number, number, number],
  fondo:      [248, 250, 252] as [number, number, number],
  blanco:     [255, 255, 255] as [number, number, number],
  alerta:     [217, 119,   6] as [number, number, number],
  ambar:      [251, 191,  36] as [number, number, number],
  fondoAmbar: [255, 251, 235] as [number, number, number],
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

function formatFechaCortaLocal(yyyymmdd: string): string {
  // "2026-04-25" → "25/04/2026" sin ajuste de zona horaria
  const [y, m, d] = yyyymmdd.split('-');
  return `${d}/${m}/${y}`;
}

function formatQ(n: number): string {
  return `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`;
}

function fmt1(n: number | null): string {
  return n != null ? n.toFixed(1) : '—';
}

// ── Horometer section builder ─────────────────────────────────────────────────

function buildSeccionHorometro(
  doc:       jsPDF,
  solicitud: SolicitudRenta,
  devolucion: DevolucionEntry,
  lecturas:  LecturaHorometro[],
  yStart:    number,
  W:         number,
  contentBottom: number,
): number {
  let y = yStart;

  const pesadaItems = (solicitud.items as ItemSnapshot[])
    .filter((i): i is Extract<ItemSnapshot, { kind: 'pesada' }> => i.kind === 'pesada');

  // Solo los equipos que están siendo devueltos en esta devolución
  const equiposDevueltos = new Set(devolucion.items.map(i => i.itemRef));

  for (const item of pesadaItems) {
    if (!equiposDevueltos.has(item.equipoId)) continue;

    const lecturasEquipo = lecturas
      .filter(l => l.equipoId === item.equipoId)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    const costoEquipo = lecturasEquipo.reduce((s, l) => s + (l.costoTotal ?? 0), 0);

    // ── Encabezado del equipo
    if (y + 40 > contentBottom) { doc.addPage(); y = 18; }

    doc.setFillColor(...COLORES.fondoAmbar);
    doc.setDrawColor(...COLORES.ambar);
    doc.setLineWidth(0.3);
    doc.roundedRect(14, y, W - 28, 14, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...COLORES.alerta);
    doc.text(
      `#${item.numeracion}  —  ${item.descripcion}${item.conMartillo ? '  (+Martillo)' : ''}`,
      18, y + 6,
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLORES.textoSuave);
    doc.text(
      `Tarifa: ${formatQ(item.tarifaEfectiva)}/hr`,
      W - 18, y + 6,
      { align: 'right' },
    );

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...COLORES.alerta);
    doc.text(
      `Acumulado: ${formatQ(costoEquipo)}`,
      W - 18, y + 11,
      { align: 'right' },
    );

    y += 17;

    if (lecturasEquipo.length === 0) {
      if (y + 12 > contentBottom) { doc.addPage(); y = 18; }
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(10);
      doc.setTextColor(...COLORES.textoSuave);
      doc.text('Sin lecturas de horómetro registradas.', 18, y + 6);
      y += 14;
      continue;
    }

    // ── Tabla de lecturas
    const filas: (string | { content: string; styles: object })[][] = lecturasEquipo.map(l => {
      const hTrab = l.horometroInicio != null && l.horometroFin5pm != null
        ? (l.horometroFin5pm - l.horometroInicio).toFixed(1)
        : '—';
      return [
        formatFechaCortaLocal(l.fecha),
        fmt1(l.horometroInicio),
        fmt1(l.horometroFin5pm),
        hTrab,
        l.horasNocturnas && l.horasNocturnas > 0 ? l.horasNocturnas.toFixed(1) : '—',
        l.ajusteMinimo   && l.ajusteMinimo   > 0 ? `+${l.ajusteMinimo.toFixed(1)}` : '—',
        l.costoTotal != null ? formatQ(l.costoTotal) : '—',
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [['Fecha', 'Horóm. inicio', 'Horóm. fin 5PM', 'H. trabajadas', 'H. noct.', 'Ajuste', 'Total día']],
      body: filas,
      foot: [['', '', '', '', '', 'TOTAL EQUIPO', formatQ(costoEquipo)]],
      margin: { left: 14, right: 14, bottom: FOOTER_RESERVE + 2 },
      styles: {
        fontSize: 9,
        cellPadding: 2.5,
        textColor: COLORES.texto,
        lineColor: COLORES.borde,
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: COLORES.primario,
        textColor: COLORES.blanco,
        fontStyle: 'bold',
        fontSize: 9,
      },
      footStyles: {
        fillColor: COLORES.fondo,
        textColor: COLORES.texto,
        fontStyle: 'bold',
        fontSize: 9,
      },
      alternateRowStyles: {
        fillColor: [250, 252, 255] as [number, number, number],
      },
      columnStyles: {
        0: { cellWidth: 22, halign: 'center' },
        1: { cellWidth: 26, halign: 'right', font: 'courier' },
        2: { cellWidth: 27, halign: 'right', font: 'courier' },
        3: { cellWidth: 24, halign: 'right', font: 'courier', fontStyle: 'bold' },
        4: { cellWidth: 18, halign: 'right', font: 'courier' },
        5: { cellWidth: 16, halign: 'right', font: 'courier' },
        6: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  return y;
}

// ── Main generator ────────────────────────────────────────────────────────────

export async function generarLiquidacion(
  solicitud:  SolicitudRenta,
  devolucion: DevolucionEntry,
  lecturas?:  LecturaHorometro[],
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

  campo('Modalidad de pago',
    solicitud.modalidad === 'CONTADO' ? 'Contado' : 'Crédito',
    14, y);
  campo('Registrado por', devolucion.registradoPor, W / 2, y);
  campo('Tipo de devolución',
    devolucion.esParcial ? 'Parcial' : 'Completa',
    W - 60, y);
  y += 14;

  // ── DETALLE SEGÚN TIPO DE RENTA ──────────────────────────────────────────────

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLORES.primario);
  doc.text(
    solicitud.esPesada ? 'DETALLE DE HORAS TRABAJADAS' : 'DETALLE DE ÍTEMS DEVUELTOS',
    14, y,
  );
  y += 6;

  if (solicitud.esPesada && lecturas && lecturas.length > 0) {
    // Tabla de horómetro por equipo
    y = buildSeccionHorometro(doc, solicitud, devolucion, lecturas, y, W, contentBottom);
  } else {
    // Tabla genérica para liviana / pesada sin lecturas
    y -= 3;
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
  }

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

  const costoBase          = devolucion.items.reduce((s, i) => s + i.costoReal,     0);
  const totalRecargoTiempo = devolucion.items.reduce((s, i) => s + i.recargoTiempo, 0);
  const totalCargosAd      = devolucion.recargosAdicionales.reduce((s, c) => s + c.monto, 0);

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

  lineaResumen(solicitud.esPesada ? 'Costo por horómetro:' : 'Costo de renta:', formatQ(costoBase), y + 8);
  if (totalRecargoTiempo > 0) {
    lineaResumen('Recargo por atraso:',  formatQ(totalRecargoTiempo), y + 15);
  }
  if (totalCargosAd > 0) {
    lineaResumen('Cargos adicionales:',  formatQ(totalCargosAd), y + (totalRecargoTiempo > 0 ? 22 : 15));
  }

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
