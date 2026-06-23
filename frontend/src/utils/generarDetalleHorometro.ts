import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SolicitudRenta, DevolucionEntry, ItemSnapshot } from '../types/solicitud-renta.types';
import type { LecturaHorometro } from '../services/solicitudes.service';
import {
  COLORES, FOOTER_RESERVE,
  cargarLogoBase64, formatQ, fmt1,
  construirEncabezadoEmpresa, construirTituloBarra, construirInfoCliente,
  construirEncabezadoEquipoPesado, construirPiePagina,
} from './pdfHelpers';

function formatFechaCortaLocal(yyyymmdd: string): string {
  // "2026-04-25" → "25/04/2026" sin ajuste de zona horaria
  const [y, m, d] = yyyymmdd.split('-');
  return `${d}/${m}/${y}`;
}

// ── Tabla día por día + desglose de tramos por equipo ──────────────────────────

function buildSeccionDetalleEquipo(
  doc:            jsPDF,
  item:           Extract<ItemSnapshot, { kind: 'pesada' }>,
  lecturasEquipo: LecturaHorometro[],
  yStart:         number,
  W:              number,
  contentBottom:  number,
): number {
  let y = yStart;
  const costoEquipo = lecturasEquipo.reduce((s, l) => s + (l.costoTotal ?? 0), 0);

  y = construirEncabezadoEquipoPesado(doc, item, costoEquipo, y, W, contentBottom);

  if (lecturasEquipo.length === 0) {
    if (y + 12 > contentBottom) { doc.addPage(); y = 18; }
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(...COLORES.textoSuave);
    doc.text('Sin lecturas de horómetro registradas.', 18, y + 6);
    return y + 14;
  }

  // ── Tabla día por día
  const filasDias = lecturasEquipo.map(l => {
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
    head: [['Fecha', 'Inicio', 'Cierre', 'H. trab.', 'H. noct.', 'Ajuste', 'Total día']],
    body: filasDias,
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
      1: { cellWidth: 24, halign: 'right', font: 'courier' },
      2: { cellWidth: 24, halign: 'right', font: 'courier' },
      3: { cellWidth: 22, halign: 'right', font: 'courier', fontStyle: 'bold' },
      4: { cellWidth: 18, halign: 'right', font: 'courier' },
      5: { cellWidth: 16, halign: 'right', font: 'courier' },
      6: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 7;

  // ── Cambios de complemento por día — solo los días que tuvieron más de un tramo diurno
  // (es decir, hubo al menos un cambio de complemento intradía) o algún tramo nocturno.
  // Los días "simples" (un solo tramo diurno cubriendo todo el día, sin noche) ya quedan
  // completamente representados en la tabla de arriba — repetirlos aquí sería ruido.
  const diasConDetalle = lecturasEquipo.filter(l => l.tramos.length > 1 || l.tramosNocturnos.length > 0);

  if (diasConDetalle.length > 0) {
    if (y + 10 > contentBottom) { doc.addPage(); y = 18; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...COLORES.primario);
    doc.text('Cambios de complemento registrados', 14, y);
    y += 5;

    for (const l of diasConDetalle) {
      const nombreComplemento = (extraId: string | null, extraNombre: string | null) =>
        extraId ? (extraNombre ?? 'Complemento') : 'Sin complemento';

      const filasTramo: string[][] = [
        ...l.tramos.map(t => [
          `${fmt1(t.horometroDesde)} → ${fmt1(t.horometroHasta)}`,
          nombreComplemento(t.extraId, t.extraNombre),
          `${t.horas.toFixed(1)} h`,
          formatQ(t.costo),
        ]),
        ...l.tramosNocturnos.map(t => [
          `${fmt1(t.horometroDesde)} → ${fmt1(t.horometroHasta)} (noche)`,
          nombreComplemento(t.extraId, t.extraNombre),
          `${t.horas.toFixed(1)} h`,
          formatQ(t.costo),
        ]),
      ];

      if (y + 14 + filasTramo.length * 6 > contentBottom) { doc.addPage(); y = 18; }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...COLORES.texto);
      doc.text(formatFechaCortaLocal(l.fecha), 18, y + 4);
      y += 6;

      autoTable(doc, {
        startY: y,
        head: [['Horómetro', 'Complemento', 'Horas', 'Costo']],
        body: filasTramo,
        margin: { left: 18, right: 14, bottom: FOOTER_RESERVE + 2 },
        styles: {
          fontSize: 8.5,
          cellPadding: 1.8,
          textColor: COLORES.texto,
          lineColor: COLORES.borde,
          lineWidth: 0.15,
        },
        headStyles: {
          fillColor: COLORES.fondo,
          textColor: COLORES.textoSuave,
          fontStyle: 'bold',
          fontSize: 8,
        },
        columnStyles: {
          0: { cellWidth: 42, font: 'courier' },
          1: { cellWidth: 50 },
          2: { cellWidth: 22, halign: 'right', font: 'courier' },
          3: { cellWidth: 30, halign: 'right' },
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      y = (doc as any).lastAutoTable.finalY + 4;
    }
  }

  return y + 6;
}

// ── Main generator ────────────────────────────────────────────────────────────

/**
 * Documento separado de la liquidación: detalle día por día y tramo por tramo del uso de
 * horómetro de una renta pesada — la trazabilidad operativa que hoy solo se ve en vivo en la
 * sección Horómetros mientras la renta está activa, y que se pierde de la vista una vez devuelta.
 */
export async function generarDetalleHorometro(
  solicitud:  SolicitudRenta,
  devolucion: DevolucionEntry,
  lecturas:   LecturaHorometro[],
): Promise<Blob> {
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const W     = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentBottom = pageH - FOOTER_RESERVE;

  const logoSrc = new URL('../assets/logo-tunsa.png', import.meta.url).href;
  const logoB64 = await cargarLogoBase64(logoSrc);

  let y = construirEncabezadoEmpresa(doc, solicitud, devolucion, logoB64, 12, W);
  y = construirTituloBarra(doc, 'DETALLE DE USO DE HORÓMETRO', COLORES.primario, y, W);
  y = construirInfoCliente(doc, solicitud, devolucion, y, W);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLORES.primario);
  doc.text('REGISTRO DIARIO POR EQUIPO', 14, y);
  y += 6;

  const pesadaItems = (solicitud.items as ItemSnapshot[])
    .filter((i): i is Extract<ItemSnapshot, { kind: 'pesada' }> => i.kind === 'pesada');
  const equiposDevueltos = new Set(devolucion.items.map(i => i.itemRef));

  for (const item of pesadaItems) {
    if (!equiposDevueltos.has(item.equipoId)) continue;

    const lecturasEquipo = lecturas
      .filter(l => l.equipoId === item.equipoId)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    y = buildSeccionDetalleEquipo(doc, item, lecturasEquipo, y, W, contentBottom);
  }

  construirPiePagina(doc, W, pageH);

  return doc.output('blob');
}
