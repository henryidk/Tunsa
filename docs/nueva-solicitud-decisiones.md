# Nueva Solicitud de Renta — Decisiones de diseño pendientes

## 1. Selección de equipos: ¿individual o por tipo?

Cada equipo tiene numeración única (EQ-001, EQ-002…).

- **Opción A — Por tipo/categoría**: El encargado elige "Compresor x2". El sistema asigna los equipos específicos disponibles al momento de aprobar.
- **Opción B — Individual**: El encargado selecciona EQ-001 y EQ-003 específicamente. La solicitud referencia equipos concretos.

**Pregunta**: ¿La solicitud selecciona equipos individuales o tipos de equipo? Esto afecta si el campo "Cantidad" tiene sentido.

---

## 2. Duración y cálculo de total

- **Opción A — Unidad + cantidad**: El encargado elige "5 días", "2 semanas" o "1 mes". El sistema calcula el total usando las tarifas del equipo (`rentaDia`, `rentaSemana`, `rentaMes`).
- **Opción B — Fechas**: El encargado ingresa fecha de inicio y fecha de fin. El sistema calcula días transcurridos y aplica la tarifa correspondiente.

**Pregunta**: ¿Cómo se especifica la duración? ¿Y el total se calcula automáticamente o es un campo manual?

---

## 3. Flujo de aprobación y estado del equipo

- **¿Quién aprueba?** ¿Solo el admin, o también puede aprobar el encargado sus propias solicitudes?
- **Mientras está pendiente**: ¿El equipo queda bloqueado (no disponible para otras rentas) o sigue disponible hasta que se apruebe?
- **Rechazo**: ¿Puede el encargado cancelar su propia solicitud? ¿O solo el admin puede rechazar?

---

## Nota sobre registro de clientes

Decisión tomada: el registro de clientes desde la solicitud se hace con el formulario completo
(idéntico al de la sección Clientes), abierto como modal. No hay registro rápido ni campos omitidos.
