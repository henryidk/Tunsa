/**
 * Resolución de tarifas al crear una solicitud (pendiente, directa o retroactiva).
 * Punto único de verdad para dos cosas que antes se calculaban por separado
 * (e inconsistentemente) en cada uno de los tres flujos de creación:
 *   1. Qué tarifa efectiva aplica a cada ítem de maquinaria pesada (catálogo u override).
 *   2. Si la solicitud, en conjunto, tiene alguna tarifa modificada (`tieneOverride`),
 *      considerando tanto liviana/granel (tarifaFijada) como pesada (tarifaBaseFijada
 *      y precio de extras).
 */

import type { ItemSolicitudDto } from './dto/create-solicitud.dto';

/** Catálogo de un equipo pesado: tarifa base por hora y precio de catálogo por extra. */
export interface EquipoCatalogoPesada {
  rentaHora: number;
  extras:    Map<string, number>; // tipoExtraId -> rentaHora de catálogo
}

function tieneOverrideLiviana(item: ItemSolicitudDto): boolean {
  return item.tarifaFijada != null && (
    item.tarifaFijada.dia    != null ||
    item.tarifaFijada.semana != null ||
    item.tarifaFijada.mes    != null
  );
}

function resolverItemPesada(
  item: ItemSolicitudDto,
  catalogo: EquipoCatalogoPesada | undefined,
): { item: object; tieneOverride: boolean } {
  const tarifaCatalogo   = catalogo?.rentaHora ?? null;
  const rentaCatalogo    = tarifaCatalogo ?? 0;
  const baseModificada   = item.tarifaBaseFijada != null && item.tarifaBaseFijada !== rentaCatalogo;
  const rentaBase        = item.tarifaBaseFijada != null ? item.tarifaBaseFijada : rentaCatalogo;

  let extraModificado = false;
  const extras = (item.extras ?? []).map(extra => {
    const catalogoRentaHora = catalogo?.extras.get(extra.tipoExtraId) ?? null;
    if (catalogoRentaHora != null && extra.rentaHora !== catalogoRentaHora) extraModificado = true;
    return { ...extra, catalogoRentaHora };
  });

  const { tarifaEfectiva: _dropped, ...rest } = item as ItemSolicitudDto & { tarifaEfectiva?: unknown };
  return {
    item:          { ...rest, extras, tarifaEfectiva: rentaBase, tarifaCatalogo },
    tieneOverride: baseModificada || extraModificado,
  };
}

/**
 * Resuelve los ítems de una solicitud contra el catálogo (solo aplica a pesada;
 * liviana/granel se devuelven tal cual, ya traen su propio `tarifaFijada`) y
 * determina si la solicitud tiene alguna tarifa modificada.
 */
export function resolverItemsSolicitud(
  items:          ItemSolicitudDto[],
  catalogoPesada: Map<string, EquipoCatalogoPesada>,
): { items: object[]; tieneOverride: boolean } {
  let tieneOverride = false;

  const itemsResueltos = items.map(item => {
    if (item.kind === 'pesada' && item.equipoId) {
      const resultado = resolverItemPesada(item, catalogoPesada.get(item.equipoId));
      if (resultado.tieneOverride) tieneOverride = true;
      return resultado.item;
    }
    if (tieneOverrideLiviana(item)) tieneOverride = true;
    return item as object;
  });

  return { items: itemsResueltos, tieneOverride };
}
