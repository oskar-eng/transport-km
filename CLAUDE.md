# TransportKM — Contexto del Proyecto para Claude

## ¿Qué es este proyecto?
Sistema de gestión de flota de transporte de carga para empresa peruana.
App web en Next.js con base de datos, roles de usuario, y múltiples módulos.

## Stack técnico
- **Framework**: Next.js 16.2.7 (App Router, Turbopack, carpeta `src/`)
- **Base de datos**: SQLite (dev) / PostgreSQL (producción en Railway)
- **ORM**: Prisma 6.19.3
- **Auth**: next-auth v4 con JWT + CredentialsProvider
- **Estilos**: Tailwind CSS v4
- **Gráficos**: Recharts (BarChart, LineChart, PieChart)
- **Mapas**: Leaflet + react-leaflet (dynamic import, sin SSR)
- **IA**: @anthropic-ai/sdk (escaneo de documentos con visión)
- **Notificaciones**: web-push + VAPID (push notifications a conductores)
- **Excel**: xlsx (exportación de reportes)
- **Fechas**: date-fns

## Regla crítica — Prisma en Windows
**SIEMPRE** detener el servidor antes de `prisma generate` o `prisma db push`.
```
Stop-Process -Name "node" -Force   # PowerShell
npx prisma db push
npx prisma generate
```
Si no, da error EPERM en la DLL.

## Roles de usuario
- `ADMINISTRADOR` — acceso total
- `JEFE_TRANSPORTE` — gestión operativa
- `SUPERVISOR` — seguimiento y reportes
- `ANALISTA` — solo lectura y reportes
- `CONDUCTOR` — solo sus órdenes y cargas de combustible

## Módulos implementados

### ✅ Órdenes de Servicio (`/orders`)
- IMPORTACION / EXPORTACION con eventos secuenciales
- Estados automáticos de unidades (EN_SERVICIO / DISPONIBLE)
- Link público de seguimiento con mapa Leaflet
- Cierre anticipado con razón
- Bloqueo de unidades/conductores ya en servicio

### ✅ Dashboard (`/dashboard`)
- KPIs según rol
- Alertas de documentos y mantenimiento próximos
- Gráficos de actividad (Recharts)

### ✅ Unidades (`/units`)
- Formulario expandido: placa, marca, modelo, año, VIN, tipo, ejes, capacidad carga/combustible, empresa propietaria, fecha adquisición, foto
- **IA**: escanea tarjeta SUNARP → autocompleta el formulario (`/api/parse-vehicle`)
- Estados: Operativo (auto), En Servicio (auto), En Taller (manual), Inactivo (manual)
- Cards con foto de la unidad

### ✅ Conductores (`/drivers`)
- Perfil: DNI, nombres, apellidos, licencia, categoría (A-IIIb etc.), vencimiento, celular, fecha ingreso, estado, foto
- Tabla con alertas de licencias vencidas / por vencer (≤30 días)
- Unidad asignada en tiempo real

### ✅ Documentos (`/documents`)
- SOAT, Revisión Técnica, Seguro, Permiso MTC, etc.
- Auto-estado: VIGENTE / POR_VENCER / VENCIDO
- CRUD con modal

### ✅ Combustible (`/fuel`)
- **Conductores pueden registrar sus cargas**
- **IA**: escanea voucher Repsol/Niubiz/Primax → autocompleta (`/api/parse-fuel`)
- Convierte galones → litros automáticamente
- Calcula km/L entre cargas consecutivas
- Alertas de bajo rendimiento (<80% del promedio)
- Gráfico de eficiencia por unidad

### ✅ Mantenimiento (`/maintenance`)
- PREVENTIVO / CORRECTIVO / PREDICTIVO
- Estados con cambio rápido inline
- Próxima fecha y odómetro programados

### ✅ Neumáticos (`/tires`)
- 7 posiciones: DEL_IZQ, DEL_DER, TRA_IZQ_EXT, TRA_IZQ_INT, TRA_DER_EXT, TRA_DER_INT, REPUESTO
- Alerta a los 80,000 km
- Vista diagrama y vista lista
- Barra de desgaste con colores

### ✅ Costos (`/costs`)
- Consolidado: Combustible + Mantenimiento + Otros costos
- Categorías: PEAJE, SEGURO, LLANTAS, CONDUCTOR, ADMINISTRATIVO, OTRO
- KPIs por unidad, gráfico de torta
- CRUD de otros costos

### ✅ Reportes (`/reports`)
- Filtros: fecha desde/hasta, unidad, conductor
- **Exportar Excel** con 4 hojas: Órdenes, Combustible, Mantenimiento, Otros Costos
- Gráficos: órdenes por semana, distribución de costos, combustible por unidad
- 5 pestañas: Resumen, Órdenes, Combustible, Mantenimiento, Costos

### ✅ Seguimiento GPS (`/tracking`)
- Mapa en tiempo real con posiciones de conductores activos

### ✅ Usuarios (`/users`)
- CRUD de usuarios con roles

## APIs creadas
```
/api/auth/[...nextauth]   — autenticación
/api/orders               — CRUD órdenes
/api/orders/[id]          — detalle/editar/cerrar
/api/orders/[id]/share    — generar link público
/api/events               — registrar eventos GPS
/api/units                — CRUD unidades
/api/units/[id]           — editar/eliminar unidad
/api/drivers              — perfiles de conductores
/api/drivers/[id]         — editar perfil conductor
/api/fuel                 — CRUD combustible
/api/fuel/[id]            — editar/eliminar registro
/api/maintenance          — CRUD mantenimiento
/api/maintenance/[id]     — editar/eliminar
/api/tires                — CRUD neumáticos
/api/tires/[id]           — editar/eliminar
/api/documents            — CRUD documentos
/api/documents/[id]       — editar/eliminar
/api/costs                — CRUD otros costos
/api/costs/[id]           — editar/eliminar
/api/reports              — datos consolidados con filtros
/api/share/[token]        — página pública de seguimiento (sin auth)
/api/upload               — subida de fotos (local dev / Cloudinary producción)
/api/parse-vehicle        — IA: extrae datos de tarjeta SUNARP
/api/parse-fuel           — IA: extrae datos de voucher combustible
/api/tracking             — posiciones GPS en tiempo real
/api/push/subscribe       — suscripción notificaciones push
/api/push/send            — enviar notificación a conductor
```

## Variables de entorno (.env)
```
DATABASE_URL="file:./dev.db"                    # SQLite local / PostgreSQL en Railway
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"
VAPID_PUBLIC_KEY="..."
NEXT_PUBLIC_VAPID_PUBLIC_KEY="..."
VAPID_PRIVATE_KEY="..."
VAPID_EMAIL="mailto:admin@transport.com"
ANTHROPIC_API_KEY=""                            # Para escaneo IA (pendiente)
CLOUDINARY_CLOUD_NAME=""                        # Para fotos en producción
CLOUDINARY_API_KEY=""
CLOUDINARY_API_SECRET=""
```

## Sidebar — Menú lateral
```
Dashboard      → todos
Órdenes        → todos
Seguimiento    → ADMIN, JEFE, SUPERVISOR
Unidades       → ADMIN, JEFE, SUPERVISOR, ANALISTA
Conductores    → ADMIN, JEFE, SUPERVISOR, ANALISTA
Documentos     → ADMIN, JEFE, SUPERVISOR, ANALISTA
Combustible    → ADMIN, JEFE, SUPERVISOR, ANALISTA + CONDUCTOR
Mantenimiento  → ADMIN, JEFE, SUPERVISOR, ANALISTA
Neumáticos     → ADMIN, JEFE, SUPERVISOR, ANALISTA
Costos         → ADMIN, JEFE, SUPERVISOR, ANALISTA
Usuarios       → solo ADMIN
Reportes       → ADMIN, JEFE, SUPERVISOR, ANALISTA
```

## Sidebar minimizable
- Botón `‹` / `›` colapsa a solo íconos (w-16) con tooltips
- Estado guardado en `localStorage`
- `AppShell.tsx` maneja el estado y pasa props a `Sidebar.tsx`

## Estructura de archivos importante
```
src/
  app/
    (auth)/login/         — página de login
    api/                  — todas las rutas API
    dashboard/page.tsx    — usa AppShell
    orders/page.tsx       — usa AppShell
    units/page.tsx        — usa AppShell
    drivers/page.tsx      — usa AppShell
    fuel/page.tsx         — usa AppShell
    maintenance/page.tsx  — usa AppShell
    tires/page.tsx        — usa AppShell
    costs/page.tsx        — usa AppShell
    reports/page.tsx      — usa AppShell
    tracking/page.tsx     — usa AppShell
    share/[token]/page.tsx — pública, sin auth
  components/
    layout/
      AppShell.tsx        — wrapper con sidebar, maneja collapsed state
      Sidebar.tsx         — menú lateral con minimizar
    orders/               — OrderDetail, NewOrderForm, etc.
    units/UnitsClient.tsx
    drivers/DriversClient.tsx
    fuel/FuelClient.tsx + FuelEfficiencyChart.tsx
    maintenance/MaintenanceClient.tsx
    tires/TiresClient.tsx
    costs/CostsClient.tsx + CostBreakdownChart.tsx
    reports/ReportsClient.tsx
    dashboard/DashboardCharts.tsx + ActiveOrdersTable.tsx
    share/PublicTracker.tsx + PublicMapView.tsx
  lib/
    auth.ts               — configuración next-auth
    prisma.ts             — cliente Prisma singleton
    events.ts             — definición de eventos por tipo de orden
prisma/
  schema.prisma           — modelos de datos
  seed.ts                 — crear primer usuario admin
public/
  uploads/units/          — fotos locales (en producción usar Cloudinary)
```

## Estado de deploy
- **Local**: SQLite (`file:./dev.db`), servidor en puerto 3000
- **Producción (pendiente)**: Railway + PostgreSQL + dominio propio
- **Pendiente configurar**: ANTHROPIC_API_KEY, Cloudinary, subdominio

## Tareas pendientes
- [ ] Conseguir ANTHROPIC_API_KEY para activar escaneo IA
- [ ] Configurar Cloudinary para fotos en producción
- [ ] Deploy en Railway con PostgreSQL
- [ ] Conectar subdominio propio
- [ ] Crear usuario admin inicial en producción (seed.ts)
