import { Prisma } from '@prisma/client';
import { fechaGT } from '../common/utils/date.util';

type BitacoraRow = Prisma.BitacoraCreateManyInput;

const MODULO = 'solicitud';

function buildRow(
  entidadId:     string,
  entidadNombre: string,
  campo:         string,
  valorAnterior: string | null,
  valorNuevo:    string | null,
  realizadoPor:  string,
): BitacoraRow {
  return { modulo: MODULO, entidadId, entidadNombre, campo, valorAnterior, valorNuevo, realizadoPor };
}

function nombreProvisional(clienteNombre: string, esPesada: boolean): string {
  return `${clienteNombre} (${esPesada ? 'pesada' : 'liviana'})`;
}

/**
 * Genera las filas de bitácora para el módulo 'solicitud'.
 * Cada método es una función pura que solo construye datos — no escribe en DB.
 * Los callers hacen: await tx.bitacora.createMany({ data: Factory.paraXxx(...) })
 */
export class SolicitudBitacoraFactory {
  // ── Creación ───────────────────────────────────────────────────────────────

  static paraCrear(
    id:            string,
    clienteNombre: string,
    esPesada:      boolean,
    realizadoPor:  string,
  ): BitacoraRow[] {
    return [buildRow(id, nombreProvisional(clienteNombre, esPesada), 'estado', null, 'PENDIENTE', realizadoPor)];
  }

  static paraCrearDirecta(
    id:           string,
    folio:        string,
    realizadoPor: string,
  ): BitacoraRow[] {
    return [buildRow(id, folio, 'estado', null, 'APROBADA', realizadoPor)];
  }

  static paraCrearRetroactiva(
    id:           string,
    folio:        string,
    fechaInicio:  Date,
    realizadoPor: string,
  ): BitacoraRow[] {
    return [buildRow(id, folio, 'estado', null, `ACTIVA (retroactiva desde ${fechaGT(fechaInicio)})`, realizadoPor)];
  }

  // ── Aprobación / rechazo ───────────────────────────────────────────────────

  static paraAprobar(
    id:           string,
    folio:        string,
    realizadoPor: string,
  ): BitacoraRow[] {
    return [buildRow(id, folio, 'estado', 'PENDIENTE', 'APROBADA', realizadoPor)];
  }

  static paraRechazar(
    id:            string,
    clienteNombre: string,
    esPesada:      boolean,
    realizadoPor:  string,
  ): BitacoraRow[] {
    return [buildRow(id, nombreProvisional(clienteNombre, esPesada), 'estado', 'PENDIENTE', 'RECHAZADA', realizadoPor)];
  }

  // ── Entrega ────────────────────────────────────────────────────────────────

  static paraIniciarEntrega(
    id:               string,
    folio:            string,
    fechaInicioRenta: Date,
    realizadoPor:     string,
  ): BitacoraRow[] {
    return [buildRow(id, folio, 'inicio_renta', null, fechaGT(fechaInicioRenta), realizadoPor)];
  }

  static paraConfirmarEntrega(
    id:             string,
    folio:          string,
    comprobanteKey: string,
    realizadoPor:   string,
  ): BitacoraRow[] {
    return [
      buildRow(id, folio, 'estado',       'APROBADA', 'ACTIVA',        realizadoPor),
      buildRow(id, folio, 'comprobante',  null,       comprobanteKey,  realizadoPor),
    ];
  }

  // ── Ampliación ─────────────────────────────────────────────────────────────

  static paraAmpliar(
    id:           string,
    folio:        string,
    extensiones:  Array<{ label: string; duracion: number; unidad: string; costoExtra: number }>,
    realizadoPor: string,
  ): BitacoraRow[] {
    return extensiones.map(e => {
      const costo   = e.costoExtra > 0 ? ` Q${e.costoExtra.toFixed(2)}` : ' (gracia)';
      const detalle = `${e.label} +${e.duracion} ${e.unidad}${costo}`;
      return buildRow(id, folio, 'extension', null, detalle, realizadoPor);
    });
  }

  // ── Devolución (liviana, granel y pesada) ──────────────────────────────────

  static paraDevolucion(
    id:           string,
    folio:        string,
    completa:     boolean,
    items:        Array<{ itemRef: string }>,
    descuento:    { tipo: 'monto_fijo' | 'porcentaje'; valor: number } | undefined,
    totalLote:    number,
    realizadoPor: string,
  ): BitacoraRow[] {
    const rows: BitacoraRow[] = [];

    if (completa) {
      rows.push(buildRow(id, folio, 'estado', 'ACTIVA', 'DEVUELTA', realizadoPor));
    } else {
      const refs = items.map(i => i.itemRef).join(', ');
      rows.push(buildRow(id, folio, 'devolucion_parcial', null, `${refs} — Q${totalLote.toFixed(2)}`, realizadoPor));
    }

    if (descuento) {
      const descVal = descuento.tipo === 'monto_fijo'
        ? `Q${descuento.valor.toFixed(2)} fijo`
        : `${descuento.valor}%`;
      rows.push(buildRow(id, folio, 'descuento', null, descVal, realizadoPor));
    }

    return rows;
  }
}
