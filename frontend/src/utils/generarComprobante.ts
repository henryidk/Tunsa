import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SolicitudRenta, ItemSnapshot, UnidadDuracion } from '../types/solicitud-renta.types';
import { unidadLabel } from '../types/solicitud.types';

// ── Constants ─────────────────────────────────────────────────────────────────

const EMPRESA = {
  linea1: 'San Juan Chamelco, Alta Verapaz',
  linea2: 'E-mail: gerencia@tunsa.com.gt',
  linea3: 'Teléfono: 7950-0095',
  linea4: 'WUATE, SOCIEDAD ANÓNIMA',
  nit:    'NIT: 10030249-1',
};

const COLORES = {
  primario:   [49,  80, 174] as [number, number, number],  // indigo-600
  texto:      [30,  41,  59] as [number, number, number],  // slate-800
  textoSuave: [100, 116, 139] as [number, number, number], // slate-500
  borde:      [226, 232, 240] as [number, number, number], // slate-200
  fondo:      [248, 250, 252] as [number, number, number], // slate-50
  blanco:     [255, 255, 255] as [number, number, number],
};

// ── Logo loader ───────────────────────────────────────────────────────────────
// Carga el logo y lo convierte a JPEG via canvas para reducir el tamaño del PDF.
// PNG sin comprimir embebido directamente en jsPDF puede pesar decenas de MB.

async function cargarLogoBase64(src: string): Promise<string | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload  = () => resolve(el);
      el.onerror = reject;
      el.src = src;
    });

    const LOGO_PX = 160; // tamaño máximo en px — suficiente para impresión a 72 dpi en PDF
    const scale  = Math.min(LOGO_PX / img.width, LOGO_PX / img.height, 1);
    const w = Math.round(img.width  * scale);
    const h = Math.round(img.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width  = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    // Fondo blanco para eliminar transparencia PNG antes de exportar a JPEG
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

function formatFechaHoraCorta(iso: string): string {
  return new Date(iso).toLocaleString('es-GT', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function calcularFin(inicio: Date, duracion: number, unidad: UnidadDuracion): Date {
  if (unidad === 'dias')    return new Date(inicio.getTime() + duracion * 86_400_000);
  if (unidad === 'semanas') return new Date(inicio.getTime() + duracion * 7  * 86_400_000);
  return new Date(inicio.getTime() + duracion * 30 * 86_400_000);
}

// ── Item rows builders ────────────────────────────────────────────────────────

function buildFilasLiviana(items: ItemSnapshot[], fechaInicio: Date): string[][] {
  const filas: string[][] = [];

  for (const item of items) {
    if (item.kind === 'pesada') continue;
    const fin      = calcularFin(fechaInicio, item.duracion, item.unidad);
    const finStr   = formatFechaHoraCorta(fin.toISOString());
    const duracion = unidadLabel(item.duracion, item.unidad);

    if (item.kind === 'maquinaria') {
      filas.push([
        `#${item.numeracion}`,
        item.descripcion,
        duracion,
        finStr,
        item.tarifa != null
          ? `Q ${item.tarifa.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
          : '—',
        `Q ${item.subtotal.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`,
      ]);
    } else {
      const desc = `${item.tipoLabel}${item.conMadera ? ' (con madera)' : ''}`;
      filas.push([
        item.cantidad.toLocaleString('es-GT'),
        desc,
        duracion,
        finStr,
        item.tarifa != null
          ? `Q ${item.tarifa.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`
          : '—',
        `Q ${item.subtotal.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`,
      ]);
    }
  }

  return filas;
}

function buildFilasPesada(items: ItemSnapshot[]): string[][] {
  return items
    .filter((i): i is Extract<ItemSnapshot, { kind: 'pesada' }> => i.kind === 'pesada')
    .map(item => [
      `#${item.numeracion}`,
      item.descripcion,
      item.conMartillo ? 'Sí' : 'No',
      item.horometroInicial != null
        ? item.horometroInicial.toLocaleString('es-GT', { minimumFractionDigits: 1 })
        : '—',
      `${item.diasSolicitados} día${item.diasSolicitados !== 1 ? 's' : ''}`,
      `Q ${item.tarifaEfectiva.toLocaleString('es-GT', { minimumFractionDigits: 2 })}/hr`,
    ]);
}

// ── Main generator ────────────────────────────────────────────────────────────

// Espacio reservado al pie de cada página (footer text + margen)
const FOOTER_RESERVE = 14; // mm

// Métricas del bloque de términos (calibradas para 11pt)
const LINE_H  = 6.5; // mm por línea de texto
const GAP_H   = 3;   // mm extra entre cláusulas
const SIG_H   = 36;  // mm para línea de firma + nombre + DPI

export async function generarComprobante(solicitud: SolicitudRenta): Promise<void> {
  const fechaInicio = solicitud.fechaInicioRenta
    ? new Date(solicitud.fechaInicioRenta)
    : new Date();

  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const W     = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  // Límite inferior del área de contenido — debajo de esto solo va el footer
  const contentBottom = pageH - FOOTER_RESERVE;

  const logoSrc = new URL('../assets/logo-tunsa.png', import.meta.url).href;
  const logoB64 = await cargarLogoBase64(logoSrc);

  let y = 12;

  // ── ENCABEZADO ──────────────────────────────────────────────────────────────

  doc.setFillColor(...COLORES.fondo);
  doc.roundedRect(10, y - 2, W - 20, 46, 3, 3, 'F');

  // Logo (columna izquierda)
  if (logoB64) {
    doc.addImage(logoB64, 'JPEG', 13, y + 2, 30, 30);
  }

  // Info empresa (columna central)
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

  // Folio + fecha (columna derecha)
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
  doc.text('Fecha de entrega:', rx, y + 18, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLORES.texto);
  doc.text(formatFechaHoraLarga(fechaInicio.toISOString()), rx, y + 25, { align: 'right' });

  y += 51;

  // ── TÍTULO COMPROBANTE ───────────────────────────────────────────────────────

  doc.setFillColor(...COLORES.primario);
  doc.roundedRect(10, y, W - 20, 9, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLORES.blanco);
  doc.text(
    solicitud.esPesada
      ? 'COMPROBANTE DE RENTA DE MAQUINARIA PESADA'
      : 'COMPROBANTE DE RENTA DE MAQUINARIA',
    W / 2, y + 6.5, { align: 'center' },
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

  const campo = (label: string, valor: string, x: number, colY: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...COLORES.textoSuave);
    doc.text(label, x, colY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...COLORES.texto);
    doc.text(valor, x, colY + 5.5);
  };

  const { cliente } = solicitud;
  campo('Nombre completo', cliente.nombre,           14,      y);
  campo('DPI',             cliente.dpi,              W / 2,   y);
  campo('Teléfono',        cliente.telefono ?? '—',  W - 60,  y);
  y += 14;
  campo('Modalidad de pago',
    solicitud.modalidad === 'CONTADO' ? 'Contado' : 'Crédito',
    14, y);
  y += 14;

  // ── TABLA DE EQUIPOS ─────────────────────────────────────────────────────────

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLORES.primario);
  doc.text('DETALLE DE EQUIPOS RENTADOS', 14, y);
  y += 3;

  const commonTableStyles = {
    margin:   { left: 14, right: 14, bottom: FOOTER_RESERVE + 2 },
    styles:   { fontSize: 11, cellPadding: 3, textColor: COLORES.texto, lineColor: COLORES.borde, lineWidth: 0.2 },
    headStyles: { fillColor: COLORES.primario, textColor: COLORES.blanco, fontStyle: 'bold' as const, fontSize: 11 },
    footStyles: { fillColor: COLORES.fondo, textColor: COLORES.texto, fontStyle: 'bold' as const, fontSize: 11 },
    alternateRowStyles: { fillColor: [250, 252, 255] as [number, number, number] },
  };

  if (solicitud.esPesada) {
    autoTable(doc, {
      startY: y,
      head: [['Cód.', 'Descripción', 'Martillo', 'Horóm. inicial', 'Días sol.', 'Tarifa/hr']],
      body: buildFilasPesada(solicitud.items),
      foot: [['', '', '', '', 'TOTAL', 'Por horómetro']],
      ...commonTableStyles,
      columnStyles: {
        0: { cellWidth: 16, halign: 'center' },
        2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 28, halign: 'right' },
        4: { cellWidth: 20, halign: 'center' },
        5: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
      },
    });
  } else {
    autoTable(doc, {
      startY: y,
      head: [['Cód./Cant.', 'Descripción', 'Duración', 'Vence', 'Tarifa', 'Subtotal']],
      body: buildFilasLiviana(solicitud.items, fechaInicio),
      foot: [[
        '', '', '', '', 'TOTAL',
        `Q ${solicitud.totalEstimado.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`,
      ]],
      ...commonTableStyles,
      columnStyles: {
        0: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 28, halign: 'center' },
        3: { cellWidth: 22, halign: 'center' },
        4: { cellWidth: 25, halign: 'right' },
        5: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
      },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 10;

  // ── CLÁUSULA DE CONSENTIMIENTO + FIRMA ───────────────────────────────────────

  const clausulas = [
    'El cliente declara recibir el equipo detallado en el presente comprobante en buen estado y funcionamiento.',
    'El cliente se compromete a devolver el equipo en las mismas condiciones en que fue recibido, dentro del plazo acordado.',
    'En caso de retraso en la devolución, se aplicará una mora equivalente a la tarifa diaria del equipo por cada día adicional de uso, sin perjuicio de los daños y perjuicios que pudieren ocasionarse.',
    'Cualquier daño, pérdida o robo del equipo será responsabilidad del cliente y deberá cubrirse a precio de mercado.',
    'El cliente acepta los presentes términos mediante su firma en este documento.',
  ];

  // Pre-calcular el alto real del bloque según cuántas líneas hace wrap cada cláusula
  doc.setFontSize(11);
  const maxTextW = W - 32; // margen interior del recuadro
  let termsContentH = 13; // título (6.5) + separador (6.5)
  for (const linea of clausulas) {
    const wrapped = doc.splitTextToSize(linea, maxTextW);
    termsContentH += wrapped.length * LINE_H + GAP_H;
  }
  const termsBoxH  = termsContentH + 8;  // padding inferior de la caja
  const signBlockH = termsBoxH + SIG_H;

  // Si el bloque completo no cabe, pasar a página nueva
  if (y + signBlockH > contentBottom) {
    doc.addPage();
    y = 18;
  }

  // Dibujar caja con altura calculada
  doc.setFillColor(...COLORES.fondo);
  doc.roundedRect(10, y, W - 20, termsBoxH, 2, 2, 'F');
  doc.setDrawColor(...COLORES.borde);
  doc.setLineWidth(0.3);
  doc.roundedRect(10, y, W - 20, termsBoxH, 2, 2, 'S');

  y += 6.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLORES.primario);
  doc.text('TÉRMINOS Y CONDICIONES DE LA RENTA', 14, y);

  y += 6.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...COLORES.texto);

  for (const linea of clausulas) {
    const wrapped = doc.splitTextToSize(linea, maxTextW);
    doc.text(wrapped, 14, y);
    y += wrapped.length * LINE_H + GAP_H;
  }

  y += 10; // espacio entre caja y línea de firma

  // ── ÁREA DE FIRMA ────────────────────────────────────────────────────────────

  const sigW = 70;
  const sigX = (W - sigW) / 2;

  doc.setDrawColor(...COLORES.borde);
  doc.setLineWidth(0.5);
  doc.line(sigX, y, sigX + sigW, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLORES.texto);
  doc.text('Firma del cliente', W / 2, y + 6.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...COLORES.textoSuave);
  doc.text(cliente.nombre, W / 2, y + 14, { align: 'center' });
  doc.text(`DPI: ${cliente.dpi}`, W / 2, y + 21, { align: 'center' });

  // ── PIE DE PÁGINA — se dibuja en TODAS las páginas ───────────────────────────

  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLORES.textoSuave);
    doc.text(
      'TUNSA — Documento generado electrónicamente.',
      W / 2,
      pageH - 5,
      { align: 'center' },
    );
  }

  // ── DESCARGA ─────────────────────────────────────────────────────────────────

  const nombreArchivo = `comprobante-${solicitud.folio ?? solicitud.id}.pdf`;
  doc.save(nombreArchivo);
}
