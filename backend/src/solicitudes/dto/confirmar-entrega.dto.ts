// La confirmación de entrega recibe el comprobante firmado como multipart/form-data.
// La validación del archivo (tipo PDF, tamaño) se realiza en el controlador con ParseFilePipe.
// Este archivo se mantiene como marcador del contrato del endpoint.
export class ConfirmarEntregaDto {}
