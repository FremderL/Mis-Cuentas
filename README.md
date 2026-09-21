# 💰 Mis Cuentas — Libro de gastos e ingresos

Aplicación web **100% estática** (HTML + CSS + JavaScript, sin dependencias ni build) para administrar tus finanzas personales como un libro de cuentas de banco. Funciona en **móvil y computadora**, guarda todo localmente en tu navegador y permite exportar respaldos para migrar de dispositivo.

## ✨ Funciones actuales

| Área | Función |
|---|---|
| 💵 **Resumen** | Dinero total (histórico), ingresos y gastos del período filtrado |
| 🎯 **Presupuesto** | Límite de gasto mensual definido por el usuario, con barra de progreso y alertas visuales (75% / 100%) |
| 📒 **Libro de cuentas** | Movimientos agrupados por día (con balance neto diario), fecha amigable ("Hoy", "Ayer"), descripción, categoría y monto |
| ➕ **Movimientos** | Crear, editar y eliminar gastos e ingresos con monto, categoría, fecha y descripción |
| 🏷 **Categorías** | Predefinidas (Comida, Transporte, Salario…) + crear las tuyas con emoji, color y tipo (gasto/ingreso/ambos) |
| 🔍 **Filtros** | Por texto, tipo, categoría y mes + **búsqueda avanzada**: rango de fechas (desde/hasta) y de montos (mín/máx) |
| 📊 **Gráficas** | Anillo "Flujo del mes" (ingreso = 100%, avance rojo del gasto), dona de gastos por categoría y comparativa de los últimos 6 meses |
| 🎨 **Diseño** | Interfaz con tono profesional, modo claro/oscuro y diseño adaptable a móvil y escritorio |
| 🔐 **Seguridad** | Bloqueo con PIN (4-6 dígitos, huella SHA-256 con sal), pantalla de bloqueo con teclado táctil y re-bloqueo automático al salir de la app |
| 📆 **Presupuestos por categoría** | Define "Ocio ≤ $1,500/mes" en cada categoría y sigue el avance con barras verde/ámbar/rojo y excedente |
| ⚡ **Registro rápido y recurrentes** | Plantillas creadas por ti: regístralas con un toque o hazlas automáticas (semanal/quincenal/mensual) |
| 📅 **Vista de calendario** | Mes visual con totales por día, navegación entre meses, detalle al tocar un día y registro directo en esa fecha |
| 📈 **Metas de ahorro** | Metas con objetivo y fecha límite, abonos/retiros, progreso, sugerencia de ahorro mensual y celebración al cumplirla 🎉 |
| 🏦 **Múltiples cuentas** | Efectivo, banco, tarjetas… saldo en vivo por cuenta, filtro al tocarla y **transferencias** entre cuentas (no alteran ingresos/gastos) |
| 🫣 **Dinero Oculto** | Apartado invisible en la pantalla principal: solo se abre desde Configuración → Detalles (sin etiqueta) **con tu PIN**. Sus movimientos no aparecen en el libro normal (solo baja el saldo) y su historial es privado |
| ⬇️⬆️ **Exportar / Importar** | Respaldo completo en JSON (para migrar) y CSV de los movimientos filtrados (para Excel) |
| 🌙 **Extras** | Modo oscuro, multi-moneda (MXN, USD, EUR…), datos de ejemplo, PWA instalable y usable sin conexión |

## 🚀 Publicación

### Opción A — GitHub Pages (gratis)
1. Crea un repositorio en GitHub y sube todos los archivos de esta carpeta.
2. En el repo: **Settings → Pages → Source: `Deploy from a branch`**, rama `main`, carpeta `/ (root)` → **Save**.
3. En 1-2 minutos estará en `https://TU-USUARIO.github.io/TU-REPO/`.

### Opción B — Render (gratis)
1. Sube la carpeta a un repositorio de GitHub/GitLab.
2. En [render.com](https://render.com): **New → Static Site**, conecta el repo.
3. **Build Command:** *(vacío)* · **Publish Directory:** `.` → **Create Static Site**.

### Opción C — Descargable / uso local
- Descarga la carpeta como `.zip` y abre `index.html` con doble clic. Funciona sin servidor.
- Opcionalmente, sírvela local: `python3 -m http.server 8000` → `http://localhost:8000`.
- En el móvil, desde el menú del navegador: **"Agregar a pantalla de inicio"** para instalarla como app (PWA).

## 💾 Migración de datos
1. En el dispositivo origen: botón **⬇️** → descarga `mis-cuentas-respaldo-FECHA.json`.
2. En el dispositivo destino: botón **⬆️** → selecciona ese archivo. Listo.

## 🧭 Lista de funciones útiles futuras (roadmap)

> 🚧 Este roadmap se está ejecutando por partes — consulta el avance detallado en **[PLAN.md](PLAN.md)**.

1. 🔁 **Gastos/ingresos recurrentes** — registrar "renta mensual" una vez y que se repita solo.
2. 🔔 **Alertas y recordatorios** — avisar al acercarse al límite del presupuesto o recordar pagos fijos.
3. 🏦 **Múltiples cuentas** — efectivo, débito, crédito, ahorros, con transferencias entre ellas.
4. 📆 **Presupuestos por categoría** — no solo uno global: "Ocio ≤ $1,500/mes".
5. ☁️ **Sincronización en la nube** — Google Drive / cuenta propia para no depender de exportaciones manuales.
6. 🔐 **Bloqueo con PIN o huella** — privacidad al abrir la app.
7. 🧾 **Adjuntar fotos de tickets/recibos** a cada movimiento.
8. 📅 **Vista de calendario** para ver en qué días se gasta más.
9. 🔎 **Búsqueda avanzada por rango de fechas y montos**.
10. 🧮 **División de gastos** entre varias personas (viajes, roommates).
11. 📈 **Metas de ahorro** — "quiero juntar $20,000 para diciembre" con progreso.
12. 🌍 **Conversión de divisas** si manejas gastos en varias monedas.
13. 📤 **Exportación a PDF** con reporte mensual imprimible.
14. 👥 **Modo compartido/familiar** con varios usuarios y permisos.

## 📁 Estructura

```
mis-cuentas/
├── index.html              ← estructura de la app
├── styles.css              ← diseño responsivo + modo oscuro
├── app.js                  ← toda la lógica (localStorage)
├── sw.js                   ← service worker (offline / PWA)
├── manifest.webmanifest    ← instalación como app
├── icon.svg                ← ícono
└── README.md               ← este archivo
```

Sin frameworks, sin build, sin rastreo: tus datos nunca salen de tu navegador. 🔒
