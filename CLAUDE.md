# Las Arenas Pinamar — Chatbot + Portal

## Proyecto
Bot de WhatsApp ("Lara") para alquiler temporario en Pinamar, Argentina.
Responde consultas de publicidades de Meta (Facebook/Instagram), calcula presupuestos y envía fotos.

## Stack
- **Backend**: Node.js + Express (index.js)
- **Frontend/Dashboard**: React + Vite (carpeta /dashboard)
- **AI**: Claude (Anthropic API) — modelo haiku
- **DB**: Supabase (PostgreSQL)
- **WhatsApp**: Meta Cloud API
- **Deploy**: Render (Web Service para backend, Static Site para dashboard)

## Estructura del proyecto
```
/
├── index.js              # Backend principal (bot WhatsApp + API)
├── package.json          # Dependencias del backend
├── env.example           # Template de variables de entorno
├── fotos/                # Fotos de las unidades A y B
├── dashboard/            # Frontend React + Vite
│   ├── src/
│   │   ├── pages/        # Conversaciones, Estadísticas, Login
│   │   ├── components/   # Componentes reutilizables
│   │   └── lib/          # Supabase client, helpers
│   └── ...
└── CLAUDE.md             # Este archivo
```

## Base de datos (Supabase)

### Tabla: conversaciones (existente)
- `phone` (PK) — Teléfono del cliente
- `name` — Nombre del cliente
- `messages` — JSON array de mensajes
- `foto_enviada` — Boolean, si se enviaron fotos
- `pausado` — Boolean, si el admin tomó control
- `esperando_titular` — Boolean, esperando nombre de titular
- `updated_at` — Timestamp última actualización

### Tabla: estadisticas (nueva)
- Métricas de conversaciones, respuestas, ventas
- Se alimenta automáticamente del flujo del bot

### Tabla: publicidades (futura)
- Campañas de Meta Ads
- Métricas de rendimiento
- Feedback de Claude para optimización

## Endpoints API existentes
- `GET /` — Health check
- `GET /webhook` — Verificación Meta
- `POST /webhook` — Recepción de mensajes WhatsApp
- `GET /test?to=PHONE` — Enviar mensaje de prueba
- `GET /reactivar?phone=PHONE` — Reactivar conversación pausada
- `GET /pausadas` — Listar conversaciones pausadas

## Endpoints API nuevos (portal)
- `GET /api/conversaciones` — Listar todas las conversaciones
- `GET /api/conversaciones/:phone` — Detalle de una conversación
- `GET /api/estadisticas` — Métricas generales
- `GET /api/estadisticas/diarias` — Métricas por día

## Reglas de negocio clave
- Bot se llama "Lara", nunca admite ser IA
- Español argentino (vos, tenés, dale)
- Máximo 1 emoji por mensaje
- Precio alta: $200/noche, finde largo: $100, baja: $80
- Máx 6 huéspedes por unidad
- No fiestas, no música/DJ, no fumar adentro
- Check-in 14:00, Check-out 10:00

## Variables de entorno requeridas
```
WHATSAPP_TOKEN, PHONE_NUMBER_ID, VERIFY_TOKEN
ANTHROPIC_API_KEY
ADMIN_PHONE
SUPABASE_URL, SUPABASE_KEY
FOTO_A_*, FOTO_B_* (URLs de fotos)
DASHBOARD_PASSWORD (nuevo, para login del portal)
```

## Roadmap
1. ✅ Bot WhatsApp funcional
2. 🔄 Portal Web (conversaciones + estadísticas)
3. 📋 Plataforma de publicidades Meta
4. 📋 Sistema de retroalimentación AI para optimizar ads

## Convenciones
- Commits en español
- Un solo usuario admin (auth simple)
- Todo se despliega en Render
