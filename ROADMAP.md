# ROADMAP — Próximas actualizaciones de Mis Cuentas

Versión actual: **1.14.0.0** (ver `CHANGELOG.md` para el historial).

Reglas de versionado: `MAYOR.MENOR.PARCHE.REVISIÓN`
- **MAYOR**: cambios grandes de experiencia o estructura de datos.
- **MENOR**: nuevas funciones completas.
- **PARCHE**: mejoras pequeñas / ajustes visuales.
- **REVISIÓN**: corrección de errores.

Al publicar una actualización: subir `APP_VERSION` en `app.js`, documentarla
en `CHANGELOG.md` y renumerar el caché del service worker (`sw.js`).

---

## 1.2.0.0 · Recordatorios y notificaciones locales ✅ ENTREGADA
- Aviso diario configurable ("registra tus gastos de hoy").
- Aviso cuando un movimiento automático vence / se registró.
- Alertas de presupuesto cerca del límite (90 %, 100 %).
- Todo local: sin servidores, notificaciones del propio navegador.

## 1.3.0.0 · Estadísticas anuales y comparativa interanual ✅ ENTREGADA
- Vista anual: ingreso/gasto/ahorro mes a mes (12 barras).
- Comparador "este mes vs. el mismo mes del año pasado".
- Tasa de ahorro (% del ingreso que te quedas) por mes y por año.
- Exportar resumen anual a CSV.

## 1.4.0.0 · Presupuestos con arrastre (rollover) ✅ ENTREGADA
- Lo no gastado de un mes se suma al presupuesto del siguiente (opción por categoría).
- Lo excedido se descuenta del mes siguiente.
- Historial visual de cumplimiento por categoría.

## 1.5.0.0 · Multi-moneda ✅ ENTREGADA
- Moneda por cuenta (ej. tarjeta en USD).
- Tipo de cambio manual configurable; totales consolidados en tu moneda base.
- Historial de la tasa usada en cada movimiento.

## 1.6.0.0 · Etiquetas e importación CSV ✅ ENTREGADA
- Etiquetas libres por movimiento (#hogar, #trabajo) filtrables y con totales.
- Importar movimientos desde CSV (Excel/bancos) con vista previa de mapeo.
- Detección de posibles duplicados al importar.

## 1.7.0.0 · Préstamos y deudas ✅ ENTREGADA
- "Me deben" y "debo" por persona, con fecha y notas.
- Abonos parciales y marcado de liquidado; opción de ligarlo a cuentas reales.

## 1.8.0.0 · Biometría y personalización ✅ ENTREGADA
- Desbloqueo con huella/rostro (WebAuthn) como alternativa al PIN.
- Color de acento de la app a elección del usuario.
- Reordenar tarjetas de cuentas con arrastrar y soltar.

## 1.12.0.0 · Respaldo automático a archivo ✅ ENTREGADA
- Carpeta elegida por la persona (File System Access), respaldo al pasar a segundo plano.
- Rotación de 7 archivos diarios, «Respaldar ahora», aviso si el respaldo es viejo.

## 1.11.0.0 · Resumen semanal ✅ ENTREGADA
- Panel «Tu semana» con top de categorías, día pico y comparativa.
- Repaso de la semana anterior una vez por semana (los lunes), desactivable.

## 1.13.0.0 · Búsquedas guardadas ✅ ENTREGADA
- «☆ Guardar» los filtros actuales con nombre; selector «Guardados…» para reaplicar.
- Gestor con resumen legible, aplicar/eliminar; incluidas en el respaldo JSON.

## 1.14.0.0 · Personalizar portada ✅ ENTREGADA
- Mostrar/ocultar y reordenar los paneles de la portada desde Configuración.
- Ocultar no borra datos, solo la presentación; restablecible y exportable.

## 1.9.0.0 · Adjuntos (fotos de tickets) — ⏸ POSPUESTA (poco útil ahora, según decisión del usuario)
- Foto o imagen por movimiento, guardada localmente (IndexedDB, compresión).
- Visor al tocar el movimiento; incluida en el respaldo JSON (opcional).

## 1.10.0.0 · Atajos y productividad ✅ ENTREGADA
- Atajos de la app instalada ("Nuevo gasto" / "Nuevo ingreso" desde el icono).
- Atajos de teclado en escritorio (+ nuevo, / buscar, Esc cierra).
- "Registro rápido" también como widget de la pantalla principal destacado.

---

> 📌 **Para agendar**: eliges la versión, la implemento, pruebo con el
> navegador automatizado, subo `APP_VERSION` + `CHANGELOG.md` + caché SW
> y te entrego el ZIP actualizado listo para publicarse.
