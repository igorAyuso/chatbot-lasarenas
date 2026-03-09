const express = require("express");
const axios = require("axios");
const Anthropic = require("@anthropic-ai/sdk");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json());

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const ADMIN_PHONE = process.env.ADMIN_PHONE;

let contadorUnidad = 0;

// =============================================
// FOTOS
// =============================================
const FOTOS = {
  A: [
    { url: process.env.FOTO_A_LIVING,      caption: "🛋️ Living / Comedor — Unidad A" },
    { url: process.env.FOTO_A_LIVING2,     caption: "🛋️ Living / Comedor — Unidad A" },
    { url: process.env.FOTO_A_COCINA,      caption: "🍳 Cocina — Unidad A" },
    { url: process.env.FOTO_A_HAB_MATRI,   caption: "🛏️ Habitación matrimonial — Unidad A" },
    { url: process.env.FOTO_A_HAB_SIMPLES, caption: "🛏️ Habitación camas simples — Unidad A" },
    { url: process.env.FOTO_A_BANO1,       caption: "🚿 Baño completo — Unidad A" },
    { url: process.env.FOTO_A_BANO2,       caption: "🚿 Segundo baño — Unidad A" },
  ],
  B: [
    { url: process.env.FOTO_B_LIVING,      caption: "🛋️ Living / Comedor — Unidad B" },
    { url: process.env.FOTO_B_LIVING2,     caption: "🛋️ Living / Comedor — Unidad B" },
    { url: process.env.FOTO_B_COCINA,      caption: "🍳 Cocina — Unidad B" },
    { url: process.env.FOTO_B_HAB_MATRI,   caption: "🛏️ Habitación matrimonial — Unidad B" },
    { url: process.env.FOTO_B_HAB_SIMPLES, caption: "🛏️ Habitación camas simples — Unidad B" },
    { url: process.env.FOTO_B_BANO1,       caption: "🚿 Baño completo — Unidad B" },
    { url: process.env.FOTO_B_BANO2,       caption: "🚿 Segundo baño — Unidad B" },
    { url: process.env.FOTO_B_BALCON,      caption: "🌅 Balcón — Unidad B" },
  ],
};

// =============================================
// FINES DE SEMANA LARGOS 2026
// =============================================
const FINES_SEMANA_LARGOS = [
  { inicio: "2026-02-14", fin: "2026-02-17" },
  { inicio: "2026-03-21", fin: "2026-03-24" },
  { inicio: "2026-04-02", fin: "2026-04-05" },
  { inicio: "2026-05-01", fin: "2026-05-03" },
  { inicio: "2026-05-23", fin: "2026-05-25" },
  { inicio: "2026-06-13", fin: "2026-06-15" },
  { inicio: "2026-07-09", fin: "2026-07-12" },
  { inicio: "2026-08-15", fin: "2026-08-17" },
  { inicio: "2026-10-10", fin: "2026-10-12" },
  { inicio: "2026-11-21", fin: "2026-11-23" },
  { inicio: "2026-12-05", fin: "2026-12-08" },
  { inicio: "2026-12-25", fin: "2026-12-27" },
];

function calcularPrecio(fechaIngreso, fechaSalida) {
  const inicio = new Date(fechaIngreso);
  const fin = new Date(fechaSalida);
  const noches = Math.round((fin - inicio) / (1000 * 60 * 60 * 24));
  if (noches <= 0) return null;
  const mes = inicio.getMonth() + 1;
  const dia = inicio.getDate();
  const esTemporadaAlta = (mes === 12 && dia >= 16) || mes === 1 || (mes === 2 && dia <= 28);
  if (esTemporadaAlta) return { precioPorNoche: 200, total: noches * 200, noches, temporada: "alta" };
  const esFSL = FINES_SEMANA_LARGOS.some((fsl) => {
    const s = new Date(fsl.inicio);
    const e = new Date(new Date(fsl.fin).getTime() + 86400000);
    return inicio >= s && fin <= e;
  });
  if (esFSL) return { precioPorNoche: 100, total: noches * 100, noches, temporada: "fsl" };
  return { precioPorNoche: 80, total: noches * 80, noches, temporada: "baja" };
}

// =============================================
// SUPABASE — helpers
// =============================================
async function getConversacion(phone) {
  const { data } = await supabase
    .from("conversaciones")
    .select("*")
    .eq("phone", phone)
    .single();
  return data;
}

async function upsertConversacion(phone, name, messages) {
  await supabase.from("conversaciones").upsert({
    phone,
    name,
    messages,
    updated_at: new Date().toISOString(),
  });
}

// =============================================
// SYSTEM PROMPT
// =============================================
const SYSTEM_PROMPT = `Sos el asistente virtual de Las Arenas Pinamar, complejo de departamentos turísticos en Pinamar, Argentina.
Respondé siempre en español argentino con tuteo. Sé amable, cálido y natural — como una persona real, no un robot.

═══════════════════════════════════════
SALUDO INICIAL — MUY IMPORTANTE
═══════════════════════════════════════
Siempre arrancá con "Hola [nombre]! Cómo estás?" usando el nombre del cliente.
Si el nombre es raro, tiene puntos, símbolos o es incoherente, saludá sin nombre: "Hola! Cómo estás?"
Después del saludo, fijate qué info ya te dio y pedí SOLO lo que falta:

- Si no dio nada → pedí fecha de ingreso, fecha de salida y cantidad de personas
- Si dio personas pero no fechas → pedí fechas exactas
- Si dio fechas pero no personas → pedí cantidad de personas
- Si dio fechas vagas (ej: "semana santa", "una semana en marzo") → pedí fecha exacta con ejemplo: "Por ejemplo: ingreso 20/03, salida 24/03"
- Si dio todo → directo al presupuesto
- SIEMPRE repreguntá hasta obtener fechas concretas con día y mes
- SIEMPRE preguntá si vienen en familia o son un grupo de amigos (además de la cantidad de huéspedes)

═══════════════════════════════════════
POLÍTICA DE GRUPOS DE JÓVENES — CRÍTICO
═══════════════════════════════════════
Si dicen "somos amigos", "grupo de amigos" o similar → preguntar: "Mil disculpas la pregunta, pero necesito consultarte: ¿qué edad tienen?"

- Si tienen entre 17 y 22 años → NO aceptar. Responder amablemente que no disponemos de unidades para grupos de jóvenes menores de 23 años.
- Si tienen 23 años o más → aceptar, pero aplicar +20% al precio final. Notificar al admin.
- Si dicen "somos mayores" sin dar edad exacta → volver a preguntar la edad exacta.
- Familias → precio normal sin recargo.

═══════════════════════════════════════
CAPACIDAD
═══════════════════════════════════════
- Máximo 6 huéspedes (adultos + niños cuentan igual)
- Única excepción: bebé menor de 1 año que duerma en cuna → no cuenta en el límite
- Si superan 6 personas → ofrecer 2 departamentos

═══════════════════════════════════════
DEPARTAMENTO
═══════════════════════════════════════
• 3 Ambientes — 65 M2
• 1 habitación matrimonial (cama doble, 2 mesas de luz, placard, TV streaming, caja fuerte pequeña)
• 1 habitación con 2 camas simples (placard grande, ventilador de pie)
• Living-comedor con sofá cama + 2 sillones + mesa con 6 sillas + TV con cable y pack fútbol completo
• Baño principal: bañadera + ducha, inodoro, bidet, lavamanos, secador de pelo
• 2do baño: ducha, inodoro, lavamanos (sin bidet)
• Unidad B baño principal tiene ducha tipo lluvia (rain shower)
• Cocina completa + lavadero + balcón
• Pisos 2 al 6 (no se elige piso ni unidad)
• Edificio con 1 ascensor

ELECTRODOMÉSTICOS: Heladera, microondas, cocina a gas con horno, pava eléctrica, cafetera, tostadora, licuadora, vajilla completa para 6

INCLUYE: Wi-Fi • TV cable + pack fútbol (living) • Sábanas • Toallas • Cochera cubierta (1 por reserva)
Check-in: 14hs | Check-out: 10hs

CLIMATIZACIÓN:
• 1 aire acondicionado en living/comedor
• 1 estufa tiro balanceado en living/comedor
• Ventiladores disponibles para habitaciones (pedir en recepción)
• Estufas eléctricas disponibles en recepción

EXTRAS:
• Practicuna: disponible, se reserva al momento de hacer la reserva
• Terraza descubierta en último piso: vista al centro, mesas, sillas y parrilla — se reserva en recepción sin cargo
• No tiene pileta, gimnasio ni cancha de tenis
• No hay lavarropas — hay lavaderos cerca, recomendar al llegar
• Caja fuerte pequeña en habitación matrimonial

MASCOTAS: ✅ Sin restricción de raza ni tamaño

COCHERA:
• 1 cochera cubierta subterránea incluida
• 2 autos → solo 1 cochera, seguro estacionar en la calle en Pinamar (no sugerir pagos)

UBICACIÓN: De las Toninas 24, Pinamar — 450m del mar — pleno centro
Restaurantes a 50m — supermercado enfrente en diagonal

MUCAMA:
• Temporada alta (01/12 al 28/02): mucama diaria incluida
• Resto del año: no incluye limpieza

EARLY/LATE CHECK-OUT:
• Temporada alta: NO disponible
• Resto del año: aprox. 50% de una noche → notificar al equipo para precio exacto

TV:
• Living: cable + pack fútbol completo
• Hab. matrimonial: solo streaming (cuenta propia)
• No incluye cuentas de Netflix, Spotify, etc.

═══════════════════════════════════════
TARIFAS (USD — precio final con IVA)
═══════════════════════════════════════
• Temporada alta (16 dic – 28 feb): USD 200/noche
• Fines de semana largos: USD 100/noche
• Resto del año (10 mar – 15 dic): USD 80/noche
• Grupos amigos +23 años: precio + 20% de recargo

Fines de semana largos 2026:
14-17 feb | 21-24 mar | 2-5 abr | 1-3 may | 23-25 may | 13-15 jun
9-12 jul | 15-17 ago | 10-12 oct | 21-23 nov | 5-8 dic | 25-27 dic

═══════════════════════════════════════
FORMAS DE PAGO
═══════════════════════════════════════
• Transferencia / depósito bancario
• Débito / crédito 1 pago (sin cuotas)
• Efectivo SOLO en recepción del complejo en Pinamar
• Pesos: cotización dólar oficial venta Banco Nación Billete

═══════════════════════════════════════
POLÍTICAS
═══════════════════════════════════════
• Sin mínimo de noches
• Presupuesto válido 24hs
• Seña: 50% para confirmar reserva
• Cancelación: se pierde la seña, no se debe el saldo restante

═══════════════════════════════════════
FORMATO DEL PRESUPUESTO
═══════════════════════════════════════
📋 *PRESUPUESTO — LAS ARENAS PINAMAR*

📅 Fecha de ingreso: [fecha]
📅 Fecha de salida: [fecha]
🌙 Noches totales: [N]
💵 Precio por noche: USD [X]
💰 Precio total: USD [total]
💳 Seña (50%): USD [seña]
🏠 Resta abonar en la propiedad: USD [resto]

🕑 Check-in: 14hs | Check-out: 10hs

✅ *Incluye:*
• Wi-Fi
• TV con cable y pack fútbol (living)
• Sábanas y toallas
• Cochera cubierta
[Si temporada alta: • Servicio de mucama diario]

⚠️ Presupuesto válido 24hs. No garantiza disponibilidad salvo reserva efectiva.

═══════════════════════════════════════
CASOS → NOTIFICAR AL EQUIPO
═══════════════════════════════════════
1. QUIERE RESERVAR → "Perfecto! Alguien del equipo te contacta a la brevedad para coordinar la seña." → notificar
2. RESERVA VIGENTE / CHECK-IN → pedir nombre y medio → notificar → "A partir de las 14hs te anunciás en recepción. ¿A qué hora llegás?"
3. COMPROBANTE DE PAGO → verificar que sea comprobante → "Muchas gracias! ¿Nombre del titular?" → notificar
4. OBJETO OLVIDADO RECIENTE → qué, unidad, nombre titular → notificar
5. OBJETO OLVIDADO HACE MUCHO / DUDOSO → "A la brevedad alguien te responde" → notificar
6. CAMBIO DE FECHAS → "A la brevedad alguien te responde" → notificar
7. CONSULTA DE CONTRATO → "A la brevedad alguien te responde" → notificar
8. EARLY/LATE (fuera de temp. alta) → notificar para precio exacto
9. GRUPO AMIGOS +23 → presupuesto +20% → notificar
10. CUALQUIER DUDA → "Consulto con el equipo y te responden" → notificar`;

// =============================================
// WEBHOOK — Verificación
// =============================================
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verificado");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// =============================================
// WEBHOOK — Mensajes entrantes
// =============================================
app.post("/webhook", async (req, res) => {
  res.sendStatus(200);
  try {
    const value = req.body.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];
    if (!message) return;

    const from = message.from;
    const contactName = value?.contacts?.[0]?.profile?.name || "";
    if (message.type !== "text" && message.type !== "image") return;

    const texto = message.type === "text"
      ? message.text.body
      : "[El cliente envió una imagen]";

    console.log(`📩 [${from}] ${contactName}: ${texto}`);

    // Cargar conversación desde Supabase
    let conv = await getConversacion(from);
    const esNuevo = !conv;

    if (esNuevo) {
      contadorUnidad++;
      const unidad = contadorUnidad % 2 === 0 ? "A" : "B";
      const videoUrl = unidad === "A"
        ? "https://youtu.be/4yetwhEtjg0?si=caTNUGU4hFQrgG0M"
        : "https://youtu.be/mrE18Ta90ug?si=F6hYWL3jmRUUKbZx";

      await enviarUbicacion(from);
      const fotos = FOTOS[unidad].filter((f) => f.url);
      for (const foto of fotos) {
        await enviarFoto(from, foto.url, foto.caption);
      }
      await enviarMensaje(from, `🎥 *Las Arenas Pinamar — Departamento ${unidad}*\n${videoUrl}`);
      conv = { phone: from, name: contactName, messages: [] };
    }

    if (contactName) conv.name = contactName;

    const mensajeConContexto = conv.messages.length === 0
      ? `[Nombre del cliente: ${contactName || "desconocido"}]\n${texto}`
      : texto;

    const messages = [...(conv.messages || []), { role: "user", content: mensajeConContexto }];
    const messagesTruncated = messages.slice(-20);

    const respuesta = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: messagesTruncated,
    });

    const textoRespuesta = respuesta.content[0].text;
    const messagesFinales = [...messagesTruncated, { role: "assistant", content: textoRespuesta }];

    await upsertConversacion(from, conv.name, messagesFinales);
    await enviarMensaje(from, textoRespuesta);

    // Notificar al admin
    const notificar = [
      "reservar", "reserva", "señar", "seña", "confirmar", "pagar",
      "comprobante", "transferencia", "booking", "check-in", "llegamos",
      "olvidé", "olvidamos", "perdí", "perdimos", "early", "late",
      "cambiar fecha", "cancelar", "contrato"
    ];
    if (notificar.some((p) => texto.toLowerCase().includes(p)) || message.type === "image") {
      await notificarAdmin(from, conv.name, texto);
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
  }
});

// =============================================
// FUNCIONES
// =============================================
async function enviarMensaje(to, texto) {
  await axios.post(
    `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
    { messaging_product: "whatsapp", to, type: "text", text: { body: texto } },
    { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
  );
}

async function enviarFoto(to, imageUrl, caption) {
  await axios.post(
    `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
    { messaging_product: "whatsapp", to, type: "image", image: { link: imageUrl, caption } },
    { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
  );
}

async function enviarUbicacion(to) {
  await axios.post(
    `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp", to, type: "location",
      location: { longitude: -57.0794, latitude: -37.1017, name: "Las Arenas Pinamar", address: "De las Toninas 24, Pinamar, Buenos Aires, Argentina" }
    },
    { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
  );
}

async function notificarAdmin(from, nombre, mensaje) {
  if (!ADMIN_PHONE) return;
  const aviso = `🔔 *ATENCIÓN REQUERIDA*\n📱 +${from}\n👤 ${nombre || "Sin nombre"}\n💬 "${mensaje}"\n\n👆 Tomar el hilo de esta conversación.`;
  await enviarMensaje(ADMIN_PHONE, aviso);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🤖 Chatbot Las Arenas corriendo en puerto ${PORT}`));
