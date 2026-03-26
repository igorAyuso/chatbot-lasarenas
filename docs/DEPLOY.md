# Guía de Deploy — Las Arenas Pinamar

## Requisitos previos
- Cuenta en [Render](https://render.com)
- Cuenta en [Supabase](https://supabase.com) (ya la tenés)
- Repo en GitHub (ya lo tenés)

---

## 1. Deploy del Backend (Web Service)

### En Render:
1. Dashboard > **New** > **Web Service**
2. Conectar repo GitHub: `igorAyuso/chatbot-lasarenas`
3. Configurar:
   - **Name**: `chatbot-lasarenas`
   - **Root Directory**: (vacío, raíz del repo)
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`
   - **Instance Type**: Free

### Variables de entorno (copiar de Render > Environment):
```
WHATSAPP_TOKEN=tu_token_de_meta
PHONE_NUMBER_ID=101922383877946197
VERIFY_TOKEN=lasarenas2026
ANTHROPIC_API_KEY=tu_api_key_de_claude
ADMIN_PHONE=5492254424747
SUPABASE_URL=https://ztksmwghmmarojxavyce.supabase.co
SUPABASE_KEY=tu_supabase_key
```

---

## 2. Deploy del Dashboard (Static Site)

### En Render:
1. Dashboard > **New** > **Static Site**
2. Conectar el mismo repo GitHub
3. Configurar:
   - **Name**: `lasarenas-dashboard`
   - **Root Directory**: `dashboard`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`

### Variables de entorno:
```
VITE_SUPABASE_URL=https://ztksmwghmmarojxavyce.supabase.co
VITE_SUPABASE_KEY=tu_supabase_anon_key
VITE_DASHBOARD_PASSWORD=tu_password_seguro
```

### Configurar Redirects (SPA):
En Render > Redirects/Rewrites, agregar:
```
Source: /*
Destination: /index.html
Action: Rewrite
```
(Esto es necesario para que react-router funcione correctamente)

---

## 3. Configurar Supabase

1. Ir a Supabase > SQL Editor
2. Copiar y pegar el contenido de `docs/supabase-setup.sql`
3. Ejecutar
4. Verificar que las tablas e índices se crearon correctamente

---

## 4. Configurar Meta Webhook

1. Ir a [Meta Business Suite](https://business.facebook.com)
2. En la app de WhatsApp > Configuration > Webhook
3. Callback URL: `https://chatbot-lasarenas.onrender.com/webhook`
4. Verify Token: `lasarenas2026`
5. Subscribirse a: `messages`

---

## 5. Verificar

- Backend: Visitar `https://chatbot-lasarenas.onrender.com/` (debería mostrar status)
- Dashboard: Visitar `https://lasarenas-dashboard.onrender.com/login`
- Bot: Enviar mensaje de prueba por WhatsApp

---

## Troubleshooting

### El dashboard no carga
- Verificar que las variables VITE_* están configuradas en Render
- Verificar el redirect rule (/* → /index.html)
- Revisar los logs en Render

### El bot no responde
- Verificar WHATSAPP_TOKEN es válido (expirar cada 24h si es token de prueba)
- Revisar logs en Render > Logs
- Verificar que el webhook está bien configurado en Meta

### Las conversaciones no aparecen en el dashboard
- Verificar VITE_SUPABASE_URL y VITE_SUPABASE_KEY
- Verificar que RLS está configurado (ejecutar supabase-setup.sql)
- Abrir la consola del navegador para ver errores
