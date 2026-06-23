import jsPDF from 'jspdf';
import type { SolicitudRenta, DevolucionEntry, ItemSnapshot } from '../types/solicitud-renta.types';

// Helpers compartidos entre los distintos documentos PDF de una devolución (liquidación, detalle
// de uso de horómetro) — encabezado de empresa, info de cliente, encabezado de equipo pesado y pie
// de página son idénticos en todos, así que viven aquí una sola vez.

export const EMPRESA = {
  linea1: 'San Juan Chamelco, Alta Verapaz',
  linea2: 'E-mail: gerencia@tunsa.com.gt',
  linea3: 'Teléfono: 7950-0095',
  linea4: 'WUATE, SOCIEDAD ANÓNIMA',
  nit:    'NIT: 10030249-1',
};

export const COLORES = {
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

export const FOOTER_RESERVE = 14;

// ── Logo loader ───────────────────────────────────────────────────────────────

export async function cargarLogoBase64(src: string): Promise<string | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload  = () => resolve(el);
      el.onerror = reject;
      el.src = src;
    });

    const LOGO_PX = 320;
    const scale  = Math.min(LOGO_PX / img.width, LOGO_PX / img.height, 1);
    const w = Math.round(img.width  * scale);
    const h = Math.round(img.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width  = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#f8fafc'; // slate-50 — mismo fondo que el encabezado del PDF
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    return canvas.toDataURL('image/jpeg', 0.82);
  } catch {
    return null;
  }
}

// ── Format helpers ────────────────────────────────────────────────────────────

export function formatFechaHoraLarga(iso: string): string {
  return new Date(iso).toLocaleString('es-GT', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatQ(n: number): string {
  return `Q ${n.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`;
}

export function fmt1(n: number | null): string {
  return n != null ? n.toFixed(1) : '—';
}

// ── Encabezado de empresa + folio ──────────────────────────────────────────────

/** Logo + datos de la empresa (izquierda) y folio + fecha de devolución (derecha). Devuelve la nueva y. */
export function construirEncabezadoEmpresa(
  doc:        jsPDF,
  solicitud:  SolicitudRenta,
  devolucion: DevolucionEntry,
  logoB64:    string | null,
  yStart:     number,
  W:          number,
): number {
  let y = yStart;

  doc.setFillColor(...COLORES.fondo);
  doc.roundedRect(10, y - 2, W - 20, 46, 3, 3, 'F');

  if (logoB64) {
    doc.addImage(logoB64, 'JPEG', 13, y + 10, 44, 22);
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
  return y;
}

/** Barra de título de color sólido (verde si a tiempo, ámbar si tardía). Devuelve la nueva y. */
export function construirTituloBarra(
  doc:    jsPDF,
  texto:  string,
  color:  [number, number, number],
  yStart: number,
  W:      number,
): number {
  let y = yStart;
  doc.setFillColor(...color);
  doc.roundedRect(10, y, W - 20, 9, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLORES.blanco);
  doc.text(texto, W / 2, y + 6.5, { align: 'center' });
  y += 15;
  return y;
}

/** Bloque "INFORMACIÓN DEL CLIENTE" — nombre, DPI, teléfono, modalidad, quién y cómo se devolvió. */
export function construirInfoCliente(
  doc:        jsPDF,
  solicitud:  SolicitudRenta,
  devolucion: DevolucionEntry,
  yStart:     number,
  W:          number,
): number {
  let y = yStart;

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
  campo('DPI',             cliente.dpi ?? '—',       W / 2,   y);
  campo('Teléfono',        cliente.telefono ?? '—',  W - 60,  y);
  y += 14;

  campo('Modalidad de pago',
    solicitud.modalidad === 'CONTADO' ? 'Contado' : 'Crédito',
    14, y);
  campo('Devolución registrada por', devolucion.registradoPor, W / 2, y);
  campo('Tipo de devolución',
    devolucion.esParcial ? 'Parcial' : 'Completa',
    W - 60, y);
  y += 14;

  return y;
}

/** Encabezado ámbar de un equipo pesado: numeración + descripción + tarifa base/con complemento + acumulado. */
export function construirEncabezadoEquipoPesado(
  doc:           jsPDF,
  item:          Extract<ItemSnapshot, { kind: 'pesada' }>,
  costoEquipo:   number,
  yStart:        number,
  W:             number,
  contentBottom: number,
): number {
  let y = yStart;
  if (y + 51 > contentBottom) { doc.addPage(); y = 18; }

  doc.setFillColor(...COLORES.fondoAmbar);
  doc.setDrawColor(...COLORES.ambar);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, y, W - 28, 19, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...COLORES.alerta);
  doc.text(
    `#${item.numeracion}  —  ${item.descripcion}${item.extras.length > 0 ? '  (' + item.extras.map(e => `+${e.nombre}`).join(', ') + ')' : ''}`,
    18, y + 6,
  );

  const tarifasTexto = [`Tarifa base: ${formatQ(item.tarifaEfectiva)}/hr`]
    .concat(item.extras.map(e => `Con ${e.nombre}: ${formatQ(item.tarifaEfectiva + e.rentaHora)}/hr`))
    .join('     ');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORES.textoSuave);
  doc.text(tarifasTexto, 18, y + 11.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...COLORES.alerta);
  doc.text(
    `Acumulado: ${formatQ(costoEquipo)}`,
    W - 18, y + 16,
    { align: 'right' },
  );

  y += 24;
  return y;
}

/** Pie de página idéntico en todas las hojas del documento. */
export function construirPiePagina(doc: jsPDF, W: number, pageH: number): void {
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
}
