# 🗺 Plan de desarrollo incremental — Mis Cuentas

Leyenda: ✅ terminado · 🚧 en curso · ⬜ pendiente

| Parte | Función (punto del README) | Estado |
|---|---|---|
| **1** | 🎨 Rediseño con tono profesional + 📊 anillo "Flujo del mes" (hero arriba, centrado): el ingreso del mes es el 100% y el arco rojo muestra lo gastado. Incluye correcciones: caché del SW, guardado robusto, validación visual y selector Gasto/Ingreso con botones reales | ✅ |
| **2** | 🔐 Bloqueo con PIN (6): huella SHA-256 con sal, pantalla de bloqueo con teclado táctil, re-bloqueo al salir de la app, activar/cambiar/desactivar desde Configuración | ✅ |
| **3** | 📆 Presupuestos por categoría (4): campo "Presup./mes" en cada categoría + panel con barras de avance del mes (verde/ámbar/rojo y excedente) | ✅ |
| **4** | 🔎 Búsqueda avanzada (9): rango de fechas (desde/hasta, anula el filtro de mes) y rango de montos (mín/máx), con panel desplegable, insignia de filtros activos y limpieza integrada | ✅ |
| **5** | 📅 Vista de calendario (8): pestaña Lista/Calendario, totales de ingreso/gasto por día, navegación entre meses, detalle del día al tocarlo y botón para agregar movimiento en esa fecha | ✅ |
| **6** | 📈 Metas de ahorro (11): crear/editar/eliminar metas con ícono, monto objetivo y fecha límite; abonar/retirar; barra de progreso, sugerencia de ahorro (semanal/mensual) y aviso de meta cumplida o plazo vencido | ✅ |
| **7** | 🏦 Múltiples cuentas (3): crear/editar/eliminar cuentas, strip con saldo en vivo por cuenta, filtro por cuenta al tocarla, transferencias entre cuentas (no afectan ingresos/gastos), cuenta en cada movimiento y plantilla, columnas de cuenta en el CSV y migración automática de datos y respaldos antiguos | ✅ |
| **8** | 🔁 Movimientos frecuentes (1): plantillas creadas/editadas por el usuario, chips de **registro rápido** (un toque las registra hoy) y recurrencia automática semanal/quincenal/mensual al abrir la app | ✅ |
| **9** | ☁️ Sincronización en la nube (5) — **Resuelta con opción C**: exportación/importación manual en JSON (botones ⬇️⬆️). No se implementará backend | ✅ |
| **Extra** | 🫣 **Dinero Oculto** (revisado): invisible en la pantalla principal (sin tarjeta ni saldo). Acceso solo desde Configuración → Dinero Oculto → **Detalles**, con verificación de PIN. Los movimientos hacia/desde Oculto no aparecen en el libro normal (solo se refleja la reducción del saldo) y su historial solo se muestra en la vista Oculto, con acciones "Apartar" y "Retirar" | ✅ |

### Nota sobre la Parte 9 (decisión del usuario)

Se eligió la **opción C** (sincronización manual por archivo), que ya está disponible:
botón ⬇️ para exportar el respaldo JSON completo (incluye movimientos, categorías,
cuentas, plantillas, metas y configuración) y ⬆️ para restaurarlo en otro dispositivo.

## Compatibilidad de datos

Cada parte migra el estado guardado (`localStorage`) de forma automática y conserva
la compatibilidad con los respaldos JSON exportados en versiones anteriores.
