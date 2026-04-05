# Errores TypeScript pre-existentes

Estos errores existían antes de las sesiones de implementación recientes.
No los introdujo Claude. Se documentan aquí para analizarlos y corregirlos cuando corresponda.

Ninguno rompe `npm run dev`. Todos rompen `npm run build`.

---

## 1. Librerías jspdf sin definiciones de tipos

**Archivos afectados:**
- `src/utils/equipos.pdf.ts` (líneas 3 y 4)
- `src/utils/categorias.pdf.ts` (líneas 3 y 4)

**Error:**
```
Cannot find module 'jspdf' or its corresponding type declarations.
Cannot find module 'jspdf-autotable' or its corresponding type declarations.
```

**Causa:** Las librerías `jspdf` y `jspdf-autotable` están instaladas, pero TypeScript no encuentra sus definiciones de tipos. Falta instalar el paquete de tipos correspondiente o agregar una declaración manual (`declare module`).

**Posible solución:**
```bash
npm install --save-dev @types/jspdf
```
O si no existe ese paquete, crear un archivo `src/types/jspdf.d.ts` con `declare module 'jspdf'` y `declare module 'jspdf-autotable'`.

También existe el error adicional en `equipos.pdf.ts`:
```
Parameter '_data' implicitly has an 'any' type.
```
Necesita una anotación de tipo explícita en ese parámetro.

---

## 2. Login.tsx — import de tipo sin `type`

**Archivo:** `src/pages/Login.tsx` (línea 3)

**Error:**
```
'FormEvent' is a type and must be imported using a type-only import
when 'verbatimModuleSyntax' is enabled.
```

**Causa:** El proyecto tiene `verbatimModuleSyntax: true` en el `tsconfig`, que exige que los tipos se importen con `import type`. El archivo usa `import { FormEvent }` en lugar de `import type { FormEvent }`.

**Solución:**
```ts
// Antes
import { useState, FormEvent } from 'react'

// Después
import { useState } from 'react'
import type { FormEvent } from 'react'
```

---

## 3. auth.store.ts — parámetro `get` sin usar

**Archivo:** `src/store/auth.store.ts` (línea 38)

**Error:**
```
'get' is declared but its value is never read.
```

**Causa:** En el store de Zustand, la función recibe `(set, get)` como parámetros pero `get` nunca se usa dentro del store. TypeScript lo marca como variable declarada pero sin uso.

**Solución:** Renombrar a `_get` para indicar que es intencional no usarlo, o eliminarlo si no se necesita.

```ts
// Antes
create<AuthState>()((set, get) => ({

// Después
create<AuthState>()((set) => ({
```

---

## 4. CategoriasPanel.tsx — tipo `CategoriaAdmin` sin usar

**Archivo:** `src/components/admin/CategoriasPanel.tsx` (línea 6)

**Error:**
```
'CategoriaAdmin' is declared but never used.
```

**Causa:** Se importó o declaró el tipo `CategoriaAdmin` en el archivo pero nunca se referencia en el código del componente. Dead code.

**Solución:** Eliminar el import/declaración de `CategoriaAdmin` si no se usa, o usarlo donde corresponda.

---

## 5. CategoriasSection.tsx — función `handleDeleteConfirm` sin usar

**Archivo:** `src/components/admin/sections/CategoriasSection.tsx` (línea 192)

**Error:**
```
'handleDeleteConfirm' is declared but its value is never read.
```

**Causa:** La función `handleDeleteConfirm` fue declarada pero nunca se llama desde ningún lugar del componente. Posiblemente quedó de una versión anterior del código.

**Solución:** Eliminar la función si ya no se necesita, o conectarla al flujo de eliminación si aún falta implementarlo.
