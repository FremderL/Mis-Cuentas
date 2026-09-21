# ✅ Plan de QA — Mis Cuentas

**Fecha:** 2026-09-20 · **Alcance:** todas las funciones de las Partes 1–9 + Dinero Oculto.
**Entorno de pruebas:** vista previa local (`server.py`, puerto 8000), Chrome/Firefox y móvil (responsive).

## 1. Pruebas automatizadas (ejecutadas en cada incremento)

| Prueba | Resultado |
|---|---|
| Sintaxis de `app.js` (`node --check`) | ✅ sin errores |
| Auditoría de IDs usados en JS vs. definidos en HTML | ✅ 160+ IDs, 0 faltantes |
| IDs duplicados en HTML | ✅ ninguno |
| Lógica de calendario (offsets, días/mes, bisiestos, formato compacto) | ✅ |
| Saldo por cuenta y global (con transferencias) | ✅ cálculos exactos |
| Migración de respaldos antiguos (sin cuentas → se asignan) | ✅ |
| Cálculo de plazos de metas (cumplida/sin plazo/semanal/mensual/vencida) | ✅ |
| Recurrencia (semanal/quincenal/mensual) | ✅ |
| Validación de `server.py` (py_compile) y cabeceras `no-store` | ✅ |

## 2. Checklist manual (verificar antes de publicar)

### Resumen y gráficas
- [ ] "Dinero total" = ingresos − gastos **sin** lo de Oculto.
- [ ] Anillo "Flujo del mes": ingreso = 100%, arco rojo correcto, exceso >100% sombreado.
- [ ] Presupuesto mensual: barra 75% ámbar / 100% rojo, disponible correcto.
- [ ] Presupuestos por categoría muestran % y excedente; dona y barras de 6 meses correctas.

### Movimientos
- [ ] Crear gasto e ingreso (tipo queda resaltado); validación marca campos en rojo.
- [ ] Editar y eliminar un movimiento existente.
- [ ] Campos obligatorios: monto, fecha, descripción (con `*`).

### Cuentas, transferencias y Oculto
- [ ] Crear cuenta → aparece tarjeta con saldo; tocar filtra el libro.
- [ ] Editar cuenta (✏️); eliminar cuenta reasigna movimientos.
- [ ] Transferencia entre dos cuentas normales: no afecta ingresos/gastos; saldos correctos.
- [ ] **Oculto no aparece en la pantalla principal**: ni tarjeta, ni saldo, ni movimientos.
- [ ] Configuración → **Cómo usar** abre la guía (scroll, sin desbordes en móvil) y **Acerca de** muestra la info de la app; ambos cierran bien.
- [ ] En Configuración no aparece el texto "Dinero Oculto": solo el botón **Detalles**, que pide el PIN; con PIN incorrecto no abre.
- [ ] Sin PIN configurado, "Detalles" obliga a crearlo primero.
- [ ] "Apartar dinero": el saldo de la cuenta normal **baja**, el total visible baja, y **no aparece ningún movimiento en el libro normal**.
- [ ] Dentro de Oculto: la transferencia sí aparece en "Movimientos ocultos" (Apartado/Retirado con cuenta y fecha), editable/eliminable.
- [ ] "Retirar" devuelve saldo a la cuenta normal, igualmente sin movimiento visible en el libro.

### Frecuentes, metas y calendario
- [ ] Chip de registro rápido registra con fecha de hoy en la cuenta elegida.
- [ ] Plantilla automática (mensual) se registra sola al cambiar de mes.
- [ ] Meta: crear, abonar, retirar (sin exceder), progreso y sugerencia de ahorro; 🎉 al cumplir.
- [ ] Calendario: totales por día correctos, navegación ‹ ›, "Hoy", detalle del día y "＋ Agregar" con fecha precargada.

### Filtros y búsqueda
- [ ] Texto, tipo, categoría, mes; avanzados (desde/hasta anulan mes; mín/máx); insignia de activos; "✕ Limpiar" restablece todo (incluye cuenta).

### Seguridad y datos
- [ ] Activar PIN → se pide al abrir y al volver a la app; cambiar y desactivar exigen el actual.
- [ ] Exportar JSON → importar en navegador/perfil limpio → todo restaurado (categorías, cuentas, plantillas, metas, ajustes).
- [ ] Exportar CSV abre en Excel con columnas cuenta/cuenta_destino.
- [ ] "Borrar todos los datos" pide doble confirmación.

### General
- [ ] Modo oscuro en todas las pantallas y modales.
- [ ] Responsive: móvil (FAB, modales pantalla completa, strips deslizables) y escritorio.
- [ ] Sin conexión (modo avión): la app abre desde caché PWA.
- [ ] Consola del navegador sin errores tras recorrer todo lo anterior.

### Móvil (360–420 px) — sin solapamientos ni desbordes
- [ ] Barra superior: logo + 4 botones entran, sin salto de línea raro.
- [ ] Tarjetas resumen (2×2): los montos largos se recortan con "…", nunca se salen.
- [ ] Filtros: buscador a renglón completo, selects en dos columnas, botones visibles.
- [ ] Filtros avanzados: los 4 campos entran sin desbordar.
- [ ] Calendario: 7 columnas legibles, celdas no se enciman; detalle del día cabe.
- [ ] Gestores (categorías/cuentas/frecuentes): filas envuelven sin superponer botones.
- [ ] Strip de cuentas y de registro rápido: deslizan horizontalmente con el dedo.
- [ ] Modales a pantalla completa; al enfocar campos iOS **no** hace zoom.
- [ ] Pantalla de bloqueo: teclado centrado, sin recortes con teclado virtual abierto.

## 3. Publicación
- [ ] Subir carpeta a GitHub → Pages rama `main` / root.
- [ ] Abrir con **HTTPS** (GitHub Pages lo da por defecto) → registrará el service worker.
- [ ] Tras futuras actualizaciones, subir los archivos: el SW (network-first) actualiza solo; solo hay que incrementar la versión en `sw.js` si se quiere forzar.

---
_Resultado esperado: todos los ✓ en verde antes de compartir el enlace._
