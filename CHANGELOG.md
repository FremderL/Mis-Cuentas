# Historial de versiones — Mis Cuentas

Formato de versión: `MAYOR.MENOR.PARCHE.REVISIÓN`
La versión visible de la app vive en `app.js` → constante `APP_VERSION`
(y se muestra en Configuración → Acerca de).

---

## 1.14.0.0 — Actual (2026-09-22)
**Personalizar portada**
- Configuración → **Personalizar…**: muestra u **oculta cada panel** (registro rápido, flujo del mes, presupuestos, gastos por categoría, metas, préstamos, tu semana, comparativa y año) y **cámbialos de orden** con ‹ ›.
- Ocultar no borra nada: los cálculos siguen corriendo; solo cambia la presentación.
- **Restablecer** vuelve a la portada original de un toque; la elección viaja en el respaldo JSON.

## 1.13.0.0 (2026-09-22)
**Búsquedas guardadas (filtros favoritos)**
- Botón **«☆ Guardar»** en la barra de filtros: da nombre a la combinación actual (texto, tipo, categoría, cuenta, etiqueta, mes o rango y montos).
- Menu **«Guardados…»** para reaplicar cualquiera con un toque; el modal gestor muestra el resumen («gastos · Comida · septiembre 2026 · «café»») y permite aplicar o eliminar.
- Las combinaciones viajan en el respaldo JSON (`savedFilters`) y sobreviven importaciones.

## 1.12.0.0 (2026-09-22)
**Respaldo automático a archivo (sin nube)**
- Elige una carpeta una vez (Configuración → Respaldo automático) y la app escribe `mis-cuentas-AAAA-MM-DD.json` cada vez que pasa a segundo plano.
- **Rotación:** se conservan los 7 respaldos más recientes (del mismo día, solo uno).
- Botones **«Respaldar ahora»** y **«Olvidar carpeta»**; el estado muestra la fecha del último respaldo (verde si es reciente).
- **Aviso** al abrir si el último respaldo tiene más de 7 días (p. ej. por permisos caducados).
- Usa File System Access API (Chrome/Edge); en navegadores sin soporte la sección no se muestra. El archivo jamás sale del dispositivo.

## 1.11.0.0 (2026-09-22)
**Resumen semanal ("wrapped" de los lunes)**
- Nuevo panel permanente **«Tu semana»**: gastado/ingresado de la semana en curso (lunes–domingo), top 3 de categorías con barras, día de mayor gasto y comparativa ▲/▼ contra la semana anterior.
- **Repaso conmemorativo:** la primera vez que abres la app cada semana (p. ej. el lunes) aparece un resumen de la semana anterior — una sola vez por semana.
- Desactivable: desde el propio repaso («No mostrar más los lunes») o en Configuración; siempre consultable con «Ver repaso de la semana pasada».
- Respeta el bloqueo (aparece tras desbloquear) y todo se calcula localmente.

## 1.10.0.0 (2026-09-22)
**Atajos y productividad** (se omite 1.9.0.0 · adjuntos de momento)
- **Atajos de la app instalada:** pulsación larga sobre el icono ofrece «Nuevo gasto» y «Nuevo ingreso», que abren la app con el tipo ya elegido (respetando el bloqueo con PIN/biometría).
- **Atajos de teclado** en escritorio: `+`/`N` nuevo movimiento, `/` ir a la búsqueda, `Esc` cierra la ventana abierta. Documentados en Ayuda.
- **Registro rápido destacado:** el widget sube a la parte superior de la pantalla (tras las cuentas) con realce de acento.

## 1.8.0.0 (2026-09-22)
**Biometría y personalización**
- **Desbloqueo con huella o rostro (WebAuthn)** como alternativa al PIN: se registra desde Configuración → Seguridad (requiere PIN activo) y la pantalla de bloqueo lo intenta automáticamente; el PIN siempre queda como respaldo.
- **Color de acento** a elección: 7 tonos sobrios + «Predeterminado», aplicados a botones principales, elementos activos y enlaces, en ambos temas.
- **Reordenar cuentas**: arrastra las tarjetas (escritorio) o usa los botones ‹ › del gestor de cuentas (táctil); el orden se conserva.

## 1.7.0.0 (2026-09-22)
**Préstamos y deudas**
- Nuevo panel: «Presté dinero (me deben)» y «Pedí prestado (debo)» por persona, con fecha y nota.
- Resumen en vivo: total que te deben y total que debes (consolidado en tu moneda base).
- **Abonos parciales** con barra de progreso y restante; liquidación con un toque (el restante opcionalmente entra como abono final) y reabrir liquidados.
- **Vinculación opcional a cuenta real**: al crearla registra el movimiento (salida si me deben, entrada si debo) y los abonos también (categoría «Préstamos» autocreada). Sin vincular funciona como registro informativo.
- Historial de liquidados desplegable.

## 1.6.0.0 (2026-09-22)
**Etiquetas e importación CSV**
- Etiquetas libres por movimiento (#hogar, #trabajo): campo en el modal, chips en la lista.
- Nuevo filtro por etiqueta (selector) + **totales por etiqueta** en filtros avanzados, con chips que filtran al tocarlos (neto en tu moneda base).
- **Importar CSV** (Excel/bancos): archivo con encabezados; reconoce fecha, monto (incluye formato 1.234,56 y negativos), descripcion, tipo, categoria, cuenta, moneda, tasa y etiquetas.
- Vista previa de mapeo (primeras 8 filas) y resumen antes de importar: válidas, omitidas por fecha/monto inválido y columnas por defecto.
- **Detección de duplicados** (fecha + monto + descripción, también dentro del propio archivo): se excluyen por defecto o se incluyen con un botón.
- Categorías por nombre (si no coinciden usan la por defecto y se avisa), cuenta por nombre o la elegida.
- El CSV exportado añade la columna «etiquetas» (round-trip con la importación).

## 1.5.0.0 (2026-09-22)
**Multi-moneda**
- Moneda por cuenta (ej. tarjeta en USD): selector al crear/editar cuentas y etiqueta en el gestor.
- Tipos de cambio manuales en Configuración (1 unidad → moneda base); aparecen automáticamente las monedas en uso.
- Cada movimiento guarda su **moneda y tasa histórica**: los flujos, gráficas y presupuestos no se alteran aunque la tasa cambie después.
- Totales consolidados en tu moneda base: «Dinero total», tarjetas (con equivalente ≈), presupuestos, filtros min/max, calendario, año y dona.
- Saldo de cada cuenta en su moneda nativa (consolidado con la tasa actual).
- Aviso de conversión mientras capturas montos (≈ al guardar).
- El CSV exportado añade columnas: moneda, tasa_base y monto_base.

## 1.4.0.0 (2026-09-22)
**Presupuestos con arrastre (rollover)**
- Botón «↺ Arrastre» por categoría en el panel de presupuestos: lo no gastado de cada mes **suma** al mes siguiente y lo excedido **se descuenta**.
- La barra usa el presupuesto efectivo (base + arrastre) y la fila lo desglosa («base $500 · arrastre +$750»).
- El arrastre se calcula desde el primer mes con movimientos de la categoría; persiste por categoría.
- Historial de cumplimiento por categoría: botón «Historial ▾» muestra los últimos 6 meses con su % (verde < 90 %, ámbar ≥ 90 %, rojo ≥ 100 %).

## 1.3.0.0 (2026-09-22)
**Estadísticas anuales y comparativa interanual**
- Nuevo panel «Resumen anual»: barras mes a mes del año (ingreso/gasto) con mes actual resaltado y meses vacíos en gris; navegación por años (‹ ›, sin años futuros).
- Cuatro totales del año: ingresos, gastos, **ahorro neto** y **tasa de ahorro** (% del ingreso que conservas).
- Comparativa interanual: «Sep 2026 vs Sep 2025» en ingresos y gastos con variación porcentual (▲/▼).
- Exportar el resumen del año a CSV (12 filas + TOTAL, con tasa de ahorro mensual).

## 1.2.0.0 (2026-09-21)
**Recordatorios y notificaciones locales** (sin servidor, sin internet)
- **Recordatorio diario**: eliges la hora; si a esa hora aún no registras movimientos, te avisa (se revisa cada minuto con la app abierta y al abrirla).
- **Alertas de presupuesto**: aviso una sola vez cuando el gasto del mes cruza el 90 % y el 100 % del presupuesto; se rearma si bajas el gasto y se reinicia cada mes.
- **Aviso de movimientos automáticos**: cuando las plantillas automáticas se registran al abrir la app.
- Avisos inteligentes: toast si la app está al frente, **notificación del sistema** (vía service worker) si está al fondo; botón "Probar notificación" y estado del permiso visible en Configuración.
- Privacidad: con el bloqueo PIN activo, ninguna notificación muestra contenido hasta desbloquear.

## 1.1.0.0 (2026-09-21)
**Persistencia, PWA e instalación**
- Fix crítico: los datos se reiniciaban al recargar (el estado se cargaba antes de inicializar el almacenamiento).
- Respaldo automático `misCuentas.v1.backup` con autorrecuperación si la clave principal se corrompe.
- Guardado extra al cerrar la pestaña y al enviar la app al fondo (móviles).
- Service worker reforzado (navegación network-first, recursos stale-while-revalidate) → app 100% funcional **sin conexión**.
- PWA **instalable**: iconos PNG 192/512 + maskable, manifest completo.
- Botón **Instalar** en la barra superior (instalación nativa en Android/desktop; instrucciones «Agregar a pantalla de inicio» en iPhone).
- Verificación E2E automatizada con navegador real (16/16): persistencia al recargar, offline, instalación.

## 1.0.0.0 — Primera versión completa
**Todas las partes del roadmap inicial**
1. Rediseño profesional + gráfica de anillo (ingreso = 100%, gasto en rojo).
2. Bloqueo con PIN (SHA-256, pantalla de bloqueo con teclado).
3. Presupuestos por categoría + presupuesto mensual general.
4. Búsqueda y filtros avanzados (texto, tipo, categoría, mes, rango de fechas y montos).
5. Calendario mensual con detalle por día.
6. Metas de ahorro con abonos/retiros.
7. Múltiples cuentas + transferencias.
8. Movimientos frecuentes: acceso rápido y automáticos (semanal/quincenal/mensual).
9. Respaldo manual: exportar/importar JSON + exportar CSV.
- Extra: **Dinero Oculto** (apartado invisible, acceso con PIN, movimientos privados).
- Extra: tono serio (iconos SVG, sin emojis en la interfaz), endurecimiento móvil, modales «Cómo usar» y «Acerca de».

---

*Próximas versiones planeadas: ver `ROADMAP.md`.*
