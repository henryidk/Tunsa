import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SolicitudRenta, DevolucionEntry, ItemSnapshot } from '../types/solicitud-renta.types';
import type { ResumenHorometroEquipo } from '../services/solicitudes.service';
import { resolverLabelItem } from './devolucion.helpers';
import {
  COLORES, FOOTER_RESERVE,
  cargarLogoBase64, formatQ, fmt1,
  construirEncabezadoEmpresa, construirTituloBarra, construirInfoCliente,
  construirEncabezadoEquipoPesado, construirPiePagina,
} from './pdfHelpers';

// ── Horometer section builder ─────────────────────────────────────────────────

function buildSeccionHorometro(
  doc:       jsPDF,
  solicitud: SolicitudRenta,
  devolucion: DevolucionEntry,
  resumenes: ResumenHorometroEquipo[],
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

    const resumen     = resumenes.find(r => r.equipoId === item.equipoId);
    const costoEquipo = resumen?.costoFinal ?? 0;

    y = construirEncabezadoEquipoPesado(doc, item, costoEquipo, y, W, contentBottom);

    if (!resumen) {
      if (y + 12 > contentBottom) { doc.addPage(); y = 18; }
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(10);
      doc.setTextColor(...COLORES.textoSuave);
      doc.text('Sin lecturas de horómetro registradas.', 18, y + 6);
      y += 14;
      continue;
    }

    // ── Entrega / devolución / horas diurnas / horas nocturnas
    const colW = (W - 28) / 4;
    const campoMini = (label: string, valor: string, x: number) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...COLORES.textoSuave);
      doc.text(label, x, y);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(...COLORES.texto);
      doc.text(valor, x, y + 5.5);
    };
    campoMini('Entrega',      fmt1(resumen.horometroEntrega),    18);
    campoMini('Devolución',   fmt1(resumen.horometroDevolucion), 18 + colW);
    campoMini('H. diurnas',   fmt1(resumen.horasDiurnasTotal),   18 + colW * 2);
    campoMini('H. nocturnas', fmt1(resumen.horasNocturnas),      18 + colW * 3);
    y += 11;

    // ── Desglose de horas/costo por complemento Y franja horaria (diurno/nocturno) — la tarifa de
    // cada fila ya refleja si lleva complemento y/o recargo nocturno, para que quede explícito
    // cuánto se cobra por hora en cada caso.
    const periodoLabel = (p: 'diurno' | 'nocturno') => p === 'diurno' ? 'Diurno' : 'Nocturno';

    const filas: string[][] = resumen.desgloseComplementos
      .slice()
      .sort((a, b) => (a.periodo === b.periodo ? b.costo - a.costo : a.periodo === 'diurno' ? -1 : 1))
      .map(d => [
        `${periodoLabel(d.periodo)} · ${d.extraNombre ?? 'Sin complemento'}`,
        `${formatQ(d.tarifa)}/hr`,
        `${d.horas.toFixed(1)} h`,
        formatQ(d.costo),
      ]);

    const ajusteMinimo      = resumen.ajusteMinimoTotal ?? 0;
    const costoAjusteMinimo = ajusteMinimo * item.tarifaEfectiva;
    if (ajusteMinimo > 0) {
      filas.push(['Ajuste mínimo (5h/día)', `${formatQ(item.tarifaEfectiva)}/hr`, `${ajusteMinimo.toFixed(1)} h`, formatQ(costoAjusteMinimo)]);
    }
    if (filas.length === 0) {
      filas.push(['Sin lecturas registradas', '—', '—', '—']);
    }

    autoTable(doc, {
      startY: y,
      head: [['Uso', 'Tarifa/hr', 'Horas', 'Costo']],
      body: filas,
      foot: [['', '', 'TOTAL EQUIPO', formatQ(costoEquipo)]],
      margin: { left: 14, right: 14, bottom: FOOTER_RESERVE + 2 },
      styles: {
        fontSize: 9.5,
        cellPadding: 3,
        textColor: COLORES.texto,
        lineColor: COLORES.borde,
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: COLORES.primario,
        textColor: COLORES.blanco,
        fontStyle: 'bold',
        fontSize: 9.5,
      },
      footStyles: {
        fillColor: COLORES.fondo,
        textColor: COLORES.texto,
        fontStyle: 'bold',
        fontSize: 9.5,
      },
      alternateRowStyles: {
        fillColor: [250, 252, 255] as [number, number, number],
      },
      columnStyles: {
        0: { cellWidth: 62 },
        1: { cellWidth: 28, halign: 'right', font: 'courier' },
        2: { cellWidth: 26, halign: 'right', font: 'courier' },
        3: { cellWidth: 36, halign: 'right', fontStyle: 'bold' },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  return y;
}

// ── Main generator ────────────────────────────────────────────────────────────

export async function generarLiquidacion(
  solicitud:      SolicitudRenta,
  devolucion:     DevolucionEntry,
  resumenHorometro?: ResumenHorometroEquipo[],
): Promise<Blob> {
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const W     = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentBottom = pageH - FOOTER_RESERVE;

  const logoSrc = new URL('../assets/logo-tunsa.png', import.meta.url).href;
  const logoB64 = await cargarLogoBase64(logoSrc);

  let y = construirEncabezadoEmpresa(doc, solicitud, devolucion, logoB64, 12, W);

  // ── TÍTULO LIQUIDACIÓN ───────────────────────────────────────────────────────

  const esTardia = devolucion.tipoDevolucion === 'TARDIA';
  y = construirTituloBarra(
    doc,
    devolucion.esParcial ? 'LIQUIDACIÓN PARCIAL DE RENTA DE MAQUINARIA' : 'LIQUIDACIÓN DE RENTA DE MAQUINARIA',
    esTardia ? COLORES.alerta : COLORES.exitoso,
    y, W,
  );

  // ── DATOS DEL CLIENTE ────────────────────────────────────────────────────────

  y = construirInfoCliente(doc, solicitud, devolucion, y, W);

  // ── DETALLE SEGÚN TIPO DE RENTA ──────────────────────────────────────────────

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLORES.primario);
  doc.text(
    solicitud.esPesada ? 'DETALLE DE HORAS TRABAJADAS' : 'DETALLE DE COBRO',
    14, y,
  );
  y += 6;

  if (solicitud.esPesada && resumenHorometro && resumenHorometro.length > 0) {
    // Resumen agregado de horómetro por equipo (entrega/devolución/diurnas/nocturnas + desglose por complemento)
    y = buildSeccionHorometro(doc, solicitud, devolucion, resumenHorometro, y, W, contentBottom);
  } else if (!solicitud.esPesada) {
    // ── DETALLE DE COBRO — rentas livianas (definidas e indefinidas) ─────────────
    y -= 3;
    const filasDetalle: string[][] = [];

    for (const entry of devolucion.items) {
      const label = resolverLabelItem(solicitud, entry);

      const snapshotItem = (solicitud.items as ItemSnapshot[]).find(i =>
        (i.kind === 'granel' && i.tipo === entry.itemRef) ||
        ((i.kind === 'maquinaria' || i.kind === 'pesada') && i.equipoId === entry.itemRef),
      );
      const cantidad: number = snapshotItem?.kind === 'granel' ? snapshotItem.cantidad : 1;
      const porUnidad = cantidad > 1 ? ` × ${cantidad} uds.` : '';

      if (entry.desglose && entry.tarifas) {
        // Renta indefinida: desglose adaptativo mes/semana/día
        const d  = entry.desglose;
        const tf = entry.tarifas;

        if (d.meses > 0 && tf.mes != null) {
          const sub = d.meses * tf.mes * cantidad;
          filasDetalle.push([label, `${d.meses} mes${d.meses > 1 ? 'es' : ''}`, `${formatQ(tf.mes)}/mes${porUnidad}`, formatQ(sub)]);
        }
        if (d.semanas > 0 && tf.semana != null) {
          const sub = d.semanas * tf.semana * cantidad;
          filasDetalle.push([d.meses > 0 ? '' : label, `${d.semanas} semana${d.semanas > 1 ? 's' : ''}`, `${formatQ(tf.semana)}/sem${porUnidad}`, formatQ(sub)]);
        }
        if (d.dias > 0 && tf.dia != null) {
          const sub = d.dias * tf.dia * cantidad;
          const mostrarLabel = d.meses === 0 && d.semanas === 0 ? label : '';
          filasDetalle.push([mostrarLabel, `${d.dias} día${d.dias > 1 ? 's' : ''}`, `${formatQ(tf.dia)}/día${porUnidad}`, formatQ(sub)]);
        }
      } else {
        // Renta definida: tarifa fija diaria × días cobrados
        const tarifa: number | null = snapshotItem && 'tarifa' in snapshotItem
          ? (snapshotItem as { tarifa: number | null }).tarifa
          : null;
        const dias = entry.diasCobrados;
        filasDetalle.push([
          label,
          `${dias} día${dias === 1 ? '' : 's'}`,
          tarifa != null ? `${formatQ(tarifa)}/día${porUnidad}` : '—',
          formatQ(entry.costoReal),
        ]);
      }
    }

    autoTable(doc, {
      startY: y,
      head: [['Ítem', 'Tramo', 'Tarifa aplicada', 'Subtotal tramo']],
      body: filasDetalle,
      margin: { left: 14, right: 14, bottom: FOOTER_RESERVE + 2 },
      styles: {
        fontSize: 10,
        cellPadding: 2.5,
        textColor: COLORES.texto,
        lineColor: COLORES.borde,
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [79, 70, 229] as [number, number, number],
        textColor: COLORES.blanco,
        fontStyle: 'bold',
        fontSize: 10,
      },
      alternateRowStyles: {
        fillColor: [245, 245, 255] as [number, number, number],
      },
      columnStyles: {
        0: { cellWidth: 55, fontStyle: 'bold' },
        1: { cellWidth: 28, halign: 'center' },
        2: { halign: 'right' },
        3: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
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

  const costoBase          = devolucion.items.reduce((s, i) => s + i.costoReal,     0);
  const totalRecargoTiempo = devolucion.items.reduce((s, i) => s + i.recargoTiempo, 0);
  const totalCargosAd      = devolucion.recargosAdicionales.reduce((s, c) => s + c.monto, 0);
  const hayDescuento       = !!devolucion.descuento;

  const lineasResumen: number = 1
    + (totalRecargoTiempo > 0 ? 1 : 0)
    + (totalCargosAd > 0 ? 1 : 0)
    + (hayDescuento ? 1 : 0);
  const boxH = 16 + lineasResumen * 7;

  if (y + boxH + 10 > contentBottom) { doc.addPage(); y = 18; }

  const boxW = 80;
  const boxX = W - 14 - boxW;

  doc.setFillColor(...COLORES.fondo);
  doc.roundedRect(boxX, y, boxW, boxH, 2, 2, 'F');
  doc.setDrawColor(...COLORES.borde);
  doc.setLineWidth(0.3);
  doc.roundedRect(boxX, y, boxW, boxH, 2, 2, 'S');

  const lineaResumen = (label: string, valor: string, ly: number, color: [number,number,number] = COLORES.textoSuave) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...color);
    doc.text(label, boxX + 5, ly);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...color);
    doc.text(valor, boxX + boxW - 5, ly, { align: 'right' });
  };

  let ry = y + 8;
  lineaResumen(solicitud.esPesada ? 'Costo por horómetro:' : 'Costo de renta:', formatQ(costoBase), ry);
  if (totalRecargoTiempo > 0) { ry += 7; lineaResumen('Recargo por atraso:', formatQ(totalRecargoTiempo), ry); }
  if (totalCargosAd > 0)      { ry += 7; lineaResumen('Cargos adicionales:', formatQ(totalCargosAd), ry); }

  if (hayDescuento) {
    ry += 7;
    const descLabel = devolucion.descuento!.tipo === 'porcentaje'
      ? `Descuento (${devolucion.descuento!.valor}%):`
      : 'Descuento (monto fijo):';
    const descMonto = devolucion.descuento!.montoOriginal - devolucion.descuento!.montoFinal;
    lineaResumen(descLabel, `− ${formatQ(descMonto)}`, ry, [220, 38, 38]);
  }

  const totalLineY = y + boxH - 9;
  doc.setDrawColor(...COLORES.borde);
  doc.setLineWidth(0.3);
  doc.line(boxX + 5, totalLineY - 2, boxX + boxW - 5, totalLineY - 2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...COLORES.exitoso);
  doc.text('TOTAL', boxX + 5, totalLineY + 5);
  doc.text(formatQ(devolucion.totalLote), boxX + boxW - 5, totalLineY + 5, { align: 'right' });

  y += boxH + 10;

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

  construirPiePagina(doc, W, pageH);

  return doc.output('blob');
}
