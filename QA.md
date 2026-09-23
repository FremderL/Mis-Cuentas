# ✅ Plan de QA — Mis Cuentas

**Fecha:** 2026-09-20 · **Alcance:** todas las funciones de las Partes 1–9 + Dinero Oculto.
**Entorno de pruebas:** vista previa local (`server.py`, puerto 8000), Chrome/Firefox y móvil (responsive).

### Personalizar portada (1.14.0.0)
- [ ] Configuración → Portada → Personalizar… lista los 9 paneles; «Ocultar/Mostrar» funciona al instante.
- [ ] ‹ › reordenan y el cambio se ve en la portada; el registro rápido va fijo arriba (solo mostrar/ocultar).
- [ ] El orden y los ocultos persisten al recargar y en el respaldo JSON; «Restablecer» vuelve al diseño original.
- [ ] Ocultar un panel no altera cálculos (los totales del resumen siguen igual).

### Búsquedas guardadas (1.13.0.0)
- [ ] Con filtros activos, «☆ Guardar» pide un nombre y la combinación aparece en «Guardados…» y en el modal.
- [ ] Elegirla reaplica texto, tipo, categoría, cuenta, etiqueta y mes/periodo de inmediato.
- [ ] Sin filtros activos el modal solo lista los guardados (aviso en toast).
- [ ] Eliminar quita la entrada del selector y del modal; todo persiste al recargar y en el respaldo JSON.

### Respaldo automático a archivo (1.12.0.0)
- [ ] Configuración muestra «Respaldo automático a archivo» (solo Chrome/Edge); «Elegir carpeta…» pide permiso y respalda al instante.
- [ ] Al pasar la app a segundo plano se escribe mis-cuentas-AAAA-MM-DD.json; ese mismo día se sobreescribe (no duplica).
- [ ] Con más de 7 respaldos, los más viejos se borran solos (quedan 7).
- [ ] El estado indica «último respaldo: hoy/hace N días»; «Olvidar carpeta» detiene el respaldo sin borrar archivos.
- [ ] Si el último respaldo tiene más de 7 días, al abrir aparece un aviso.

### Resumen semanal (1.11.0.0)
- [ ] Panel «Tu semana» con gastado/ingresado de la semana en curso, top 3 de categorías con barras, día pico y comparativa ▲/▼.
- [ ] Al abrir la app por primera vez en la semana aparece el repaso de la semana anterior (solo si tuvo movimientos) y no se repite al recargar.
- [ ] «Ver repaso de la semana pasada» lo reabre cuando quieras; «No mostrar más los lunes» lo desactiva (reversible en Configuración).
- [ ] Con bloqueo activo, el repaso aparece solo después de desbloquear.

### Atajos y productividad (1.10.0.0)
- [ ] Con la app instalada, mantener pulsado el icono ofrece «Nuevo gasto» / «Nuevo ingreso»; abren la app directo al formulario con ese tipo (si hay bloqueo, tras desbloquear).
- [ ] En escritorio: `+` o `N` abre nuevo movimiento, `/` enfoca la búsqueda, `Esc` cierra la ventana abierta; los atajos no interfieren al escribir en campos ni dentro de modales.
- [ ] Ayuda incluye la sección «Atajos» con las teclas.
- [ ] El panel «Registro rápido» está arriba (tras las cuentas), destacado con borde de acento, y sus chips siguen registrando de un toque.

### Biometría y personalización (1.8.0.0)
- [ ] Con PIN activo aparece la fila «Huella / rostro» en Seguridad (solo en dispositivos compatibles); al activarla el sistema pide tu huella/rostro una vez.
- [ ] Al abrir la app bloqueada se intenta la biometría sola y también hay botón «Entrar con huella o rostro»; cancelar deja el PIN funcionando.
- [ ] Desactivar el PIN también retira la biometría; desactivar solo la biometría conserva el PIN.
- [ ] Configuración → Color de acento: elegir otro tono cambia botones y elementos activos al instante (tema claro y oscuro); «Predeterminado» restaura el verde.
- [ ] Las tarjetas de cuenta se arrastran para reordenarse (escritorio) y el gestor muestra ‹ › (táctil); el orden persiste al recargar.

### Préstamos y deudas (1.7.0.0)
- [ ] Panel con resumen «Me deben / Debo» en $0 al inicio; botón «＋ Nuevo registro» abre el modal.
- [ ] Crear «me deben» $500 ligado a una cuenta: el saldo baja $500 y aparece «Préstamo a …» con categoría Préstamos.
- [ ] Abonar $200: sube la barra, el restante baja y se registra la entrada real; liquidar registra los $300 finales y pasa a «liquidados».
- [ ] Crear «debo» $1,000 SIN ligar: solo información — no toca saldos ni el libro.
- [ ] «Ver liquidados (n)» despliega/oculta; «Reabrir» regresa el registro a activos.
- [ ] Editar cambia persona/monto/nota; Eliminar pide confirmación y no borra movimientos reales.

### Etiquetas e importación CSV (1.6.0.0)
- [ ] Agrega etiquetas (coma) a un movimiento: se ven como chips (#hogar) en la lista y se pueden editar.
- [ ] El selector «Todas las etiquetas» filtra; el resumen de etiquetas muestra totales y los chips alternan el filtro.
- [ ] Exportar CSV incluye la columna «etiquetas» e importarla de vuelta conserva las etiquetas.
- [ ] Importar un CSV de 5+ filas: vista previa mapeada, conteo de válidas/omitidas y categoría por defecto marcada con *.
- [ ] Importar un movimiento igual a uno existente: se marca como duplicado y se omite (salvo «Incluir duplicados»).
- [ ] Montos «1.234,56», negativos y fechas DD/MM/AAAA se interpretan bien; los negativos entran como gasto.

### Multi-moneda (1.5.0.0)
- [ ] Crea una cuenta en USD: en el gestor lleva etiqueta «· USD» y en su tarjeta el saldo en USD con «≈ $…» en base.
- [ ] En Configuración aparece «Tipos de cambio» con la moneda en uso; define la tasa y se conserva al recargar.
- [ ] Un gasto de 100 USD con tasa 20 suma $2,000 al gasto del mes; cambiar la tasa a 25 mueve el «Dinero total» pero NO el gasto del mes (tasa histórica).
- [ ] Al capturar un monto en cuenta USD se muestra el aviso de conversión (≈ al guardar).
- [ ] La lista muestra el monto en su moneda con «≈» en base; el CSV trae moneda/tasa/monto_base.
- [ ] Cambiar la moneda de una cuenta con movimientos pide confirmación y no altera los montos registrados.

### Presupuestos con arrastre (1.4.0.0)
- [ ] En el panel de presupuestos, cada categoría tiene «↺ Arrastre»: al activarlo persiste al recargar.
- [ ] Categoría con $500/mes: $250 hace 2 meses, $0 el mes pasado → presupuesto efectivo $1,250 y «arrastre +$750».
- [ ] Si el mes pasado excediste, el arrastre es negativo y el presupuesto efectivo baja (o llega a 0 → excedido).
- [ ] «Historial ▾» muestra 6 meses con % y colores (verde/ámbar/rojo); «Ocultar» lo cierra.
- [ ] Sin arrastre, la fila se comporta como antes (base igual al presupuesto mensual).

### Estadísticas anuales (1.3.0.0)
- [ ] Panel «Resumen anual» visible con las 12 barras del año; el mes actual aparece resaltado.
- [ ] Navegar con ‹ › entre años; no permite años futuros y marca «Sin movimientos» en años vacíos.
- [ ] Las tarjetas muestran ingresos, gastos, ahorro neto y tasa de ahorro del año (sin contar transferencias).
- [ ] La comparativa interanual muestra el mes actual vs. el del año pasado con ▲/▼ y %.
- [ ] «Exportar CSV del año» descarga 12 filas + TOTAL abrible en Excel.


### Notificaciones (1.2.0.0)
- [ ] Configuración → Notificaciones: activar el recordatorio diario pide el permiso del sistema y muestra el estado del permiso.
- [ ] Elegir una hora pasada de hoy y esperar ~1 min (o recargar): si no registraste nada hoy, llega el aviso.
- [ ] Con presupuesto puesto, gastar hasta el 90 % → un solo aviso; pasar del 100 % → otro; no se repiten al recargar.
- [ ] Con una plantilla automática vencida, al abrir la app llega el aviso de movimientos automáticos.
- [ ] "Probar notificación" muestra el aviso de prueba.
- [ ] Con PIN activo y pantalla bloqueada, no aparece contenido en notificaciones.
- [ ] Los tres interruptores (diario / presupuesto / automáticos) se pueden desactivar y recuerdan su estado al recargar.

## Persistencia y modo sin conexión (antes de subir y después)
- [ ] Registrar un movimiento y **recargar la página**: el movimiento y el balance siguen ahí.
- [ ] Con la app ya publicada (HTTPS), en el teléfono aparece el botón **Instalar** (icono de teléfono) en la barra superior: en Android un toque la instala; en iPhone muestra los pasos de «Agregar a pantalla de inicio». Una vez instalada, el botón desaparece.
- [ ] Cerrar la pestaña y volver a abrir la app (mismo navegador y URL): los datos persisten.
- [ ] Activar el modo avión (sin conexión) y recargar: la app abre y muestra los datos.
- [ ] En DevTools → Application → Storage: figura `misCuentas.v1` **y** `misCuentas.v1.backup`.
- [ ] (Opcional) "Agregar a pantalla de inicio" instala la app con su icono verde.

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
