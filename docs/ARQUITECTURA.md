# Arquitectura del Sistema — Las Arenas Pinamar

## Visión general

```
┌──────────────────┐     ┌──────────────────┐     ┌───────────────┐
│   Meta Ads       │     │   WhatsApp       │     │   Dashboard   │
│   (Facebook/IG)  │────▶│   Cloud API      │     │   React+Vite  │
└──────────────────┘     └────────┬─────────┘     └───────┬───────┘
                                  │                        │
                                  ▼                        │
                         ┌──────────────────┐              │
                         │   Backend        │              │
                         │   Express.js     │◀─────────────┘
                         │   (Render)       │    /api endpoints
                         └────────┬─────────┘
                                  │
                         ┌────────┴─────────┐
                         │                  │
                    ┌────▼─────┐     ┌──────▼──────┐
                    │ Supabase │     │  Anthropic  │
                    │ (DB)     │     │  Claude API │
                    └──────────┘     └─────────────┘
```

## Componentes

### 1. Bot de WhatsApp (index.js)
- **Puerto**: Definido por `PORT` env var (3000 local)
- **Framework**: Express.js
- **Responsabilidad**: Recibir mensajes de WhatsApp, procesarlos con Claude, responder automáticamente
- **Endpoints**:
  - `GET /webhook` — Verificación de Meta
  - `POST /webhook` — Recepción de mensajes
  - `GET /reactivar?phone=X` — Reactivar conversación pausada
  - `GET /pausadas` — Listar conversaciones pausadas
  - `GET /api/conversaciones` — API para el dashboard
  - `GET /api/conversaciones/:phone` — Detalle para el dashboard
  - `GET /api/estadisticas` — Métricas para el dashboard

### 2. Dashboard (dashboard/)
- **Framework**: React + Vite
- **Deploy**: Render Static Site
- **Responsabilidad**: Portal de administración para ver conversaciones y estadísticas
- **Páginas**:
  - `/login` — Autenticación simple con contraseña
  - `/conversaciones` — Lista y detalle de todas las conversaciones
  - `/estadisticas` — KPIs, funnel de conversión, gráficos

### 3. Base de datos (Supabase)
- **Tipo**: PostgreSQL (administrado por Supabase)
- **Tablas**:
  - `conversaciones` — Todas las conversaciones del bot
  - `eventos` — Log de eventos para estadísticas avanzadas (futuro)
- **Vistas**:
  - `vista_estadisticas` — Métricas precalculadas

### 4. IA (Anthropic Claude)
- **Modelo**: claude-haiku-4-5-20251001
- **Uso**: Generar respuestas naturales en español argentino
- **Personalidad**: "Lara", recepcionista del complejo

---

## Flujo de datos

### Flujo principal (Bot)
```
1. Cliente envía mensaje por WhatsApp
2. Meta envía webhook a POST /webhook
3. Express recibe y extrae: teléfono, nombre, texto
4. Se busca/crea conversación en Supabase
5. Se envía historial + system prompt a Claude
6. Claude genera respuesta
7. Se detectan acciones especiales:
   - [ENVIAR_FOTOS] → Se envían fotos de la unidad
   - [NOTIFICAR_ADMIN] → Se pausa y avisa al admin
   - [PRESUPUESTO] → Se envía presupuesto formateado
8. Se guarda conversación actualizada en Supabase
9. Se envía respuesta al cliente via WhatsApp API
```

### Flujo del Dashboard
```
1. Admin ingresa al dashboard con contraseña
2. Dashboard consulta Supabase directamente (lectura)
3. Se muestran conversaciones y estadísticas en tiempo real
4. Admin puede revisar calidad de respuestas
```

---

## Deploy en Render

### Backend (Web Service)
- **Build Command**: `npm install`
- **Start Command**: `node index.js`
- **Variables de entorno**: Ver env.example

### Dashboard (Static Site)
- **Root Directory**: `dashboard`
- **Build Command**: `npm install && npm run build`
- **Publish Directory**: `dashboard/dist`
- **Variables de entorno**: Ver dashboard/.env.example

---

## Seguridad

- **Auth del dashboard**: Contraseña simple (sessionStorage), suficiente para un usuario
- **Supabase RLS**: Habilitado, permite lectura desde la anon key
- **WhatsApp**: Token de Meta verificado en cada request
- **Secrets**: Nunca se commitean, van en variables de entorno de Render
