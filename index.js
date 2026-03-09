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

const FOTOS = {
  A: [
    { url: process.env.FOTO_A_LIVING,      caption: "🛋️ Living / Comedor" },
    { url: process.env.FOTO_A_LIVING2,     caption: "🛋️ Living / Comedor" },
    { url: process.env.FOTO_A_COCINA,      caption: "🍳 Cocina" },
    { url: process.env.FOTO_A_HAB_MATRI,   caption: "🛏️ Habitación matrimonial" },
    { url: process.env.FOTO_A_HAB_SIMPLES, caption: "🛏️ Habitación camas simples" },
    { url: process.env.FOTO_A_BANO1,       caption: "🚿 Baño completo" },
    { url: process.env.FOTO_A_BANO2,       caption: "🚿 Segundo baño" },
  ],
  B: [
    { url: process.env.FOTO_B_LIVING,      caption: "🛋️ Living / Comedor" },
    { url: process.env.FOTO_B_LIVING2,     caption: "🛋️ Living / Comedor" },
    { url: process.env.FOTO_B_COCINA,      caption: "🍳 Cocina" },
    { url: process.env.FOTO_B_HAB_MATRI,   caption: "🛏️ Habitación matrimonial" },
    { url: process.env.FOTO_B_HAB_SIMPLES, caption: "🛏️ Habitación camas simples" },
    { url: process.env.FOTO_B_BANO1,       caption: "🚿 Baño completo" },
    { url: process.env.FOTO_B_BANO2,       caption: "🚿 Segundo baño" },
    { url: process.env.FOTO_B_BALCON,      caption: "🌅 Balcón" },
  ],
};

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

async function getConversacion(phone) {
  const { data } = await supabase.from("conversaciones").select("*").eq("phone", phone).single();
  return data;
}

async function upsertConversacion(phone, name, messages, fotoEnviada) {
  await supabase.from("conversaciones").upsert({
    phone, name, messages,
    foto_enviada: fotoEnviada,
    updated_at: new Date().toISOString(),
  });
}

const SYSTEM_PROMPT = `Sos el asistente virtual de Las Arenas Pinamar, complejo de departamentos turísticos en Pinamar, Argentina.
Respondé siempre en español argentino con tuteo. Sé amable, cálido y natural — como una persona real, no un robot.

═══════════════════════════════════════
SALUDO Y RECOLECCIÓN DE DATOS
═══════════════════════════════════════
Siempre arrancá con "Hola [nombre]! Cómo estás?" usando el nombre del cliente.
Si el nombre es raro, tiene puntos, símbolos o es incoherente → saludá sin nombre: "Hola! Cómo estás?"

Después del saludo, recolectá SOLO lo que falta:
- Fecha de ingreso (exacta con día y mes)
- Fecha de salida (exacta con día y mes)
- Cantidad de personas
- ¿Vienen en familia o son un grupo de amigos?

Si da fechas vagas (ej: "semana santa", "una semana en marzo") → pedí fecha exacta: "¿Me podés dar la fecha exacta? Por ejemplo: ingreso 20/03, salida 24/03"
SIEMPRE repreguntá hasta tener fechas concretas.

═══════════════════════════════════════
CUANDO TENÉS TODOS LOS DATOS
═══════════════════════════════════════
Una vez que tenés fecha ingreso, fecha salida, cantidad de personas y familia/amigos:
1. Calculá el precio según las tarifas
2. Respondé con el presupuesto en el formato indicado
3. Incluí en tu respuesta la palabra clave: [ENVIAR_FOTOS] al final (invisible para el cliente)

═══════════════════════════════════════
POLÍTICA DE GRUPOS DE JÓVENES
═══════════════════════════════════════
Si dicen "somos amigos" → preguntar: "Mil disculpas la pregunta, pero necesito consultarte: ¿qué edad tienen?"
- 17 a 22 años → NO aceptar, explicar amablemente que no disponemos para grupos menores de 23
- 23+ años → aceptar con +20% al precio. Incluir [NOTIFICAR_ADMIN] en tu respuesta
- "Somos mayores" sin edad exacta → volver a preguntar

═══════════════════════════════════════
CAPACIDAD
═══════════════════════════════════════
- Máximo 6 huéspedes (adultos + niños)
- Excepción: bebé menor de 1 año en cuna → no cuenta
- Más de 6 → ofrecer 2 departamentos

═══════════════════════════════════════
DEPARTAMENTO
═══════════════════════════════════════
• 3 Ambientes — 65 M2
• Hab. matrimonial: cama doble, 2 mesas de luz, placard, TV streaming, caja fuerte
• Hab. simples: 2 camas, placard grande, ventilador de pie
• Living-comedor: sofá cama, 2 sillones, mesa 6 sillas, TV cable + pack fútbol completo
• Baño principal: bañadera + ducha, inodoro, bidet, lavamanos, secador de pelo
• 2do baño: ducha, inodoro, lavamanos
• Unidad B: ducha tipo lluvia (rain shower) en baño principal
• Cocina + lavadero + balcón en ambas unidades
• Pisos 2 al 6 — Edificio con ascensor

ELECTRODOMÉSTICOS: heladera, microondas, cocina a gas con horno, pava eléctrica, cafetera, tostadora, licuadora, vajilla para 6

INCLUYE: Wi-Fi · TV cable + fútbol · Sábanas · Toallas · Cochera cubierta
Check-in: 14hs | Check-out: 10hs

CLIMATIZACIÓN: AA en living · Estufa tiro balanceado en living · Ventiladores y estufas eléctricas disponibles en recepción

EXTRAS: Practicuna (reservar al confirmar) · Terraza con parrilla en último piso (sin cargo, reservar en recepción)
Sin pileta · Sin gimnasio · Sin lavarropas (hay lavaderos cerca)

MASCOTAS: ✅ Sin restricción de raza ni tamaño
COCHERA: 1 cubierta incluida · 2 autos → estacionar en la calle (seguro en Pinamar)
UBICACIÓN: De las Toninas 24, Pinamar · 450m del mar · Restaurantes a 50m · Supermercado enfrente

MUCAMA: Temporada alta (01/12–28/02): diaria incluida · Resto del año: no incluye
EARLY/LATE: Temp. alta: NO disponible · Resto: ~50% de una noche → [NOTIFICAR_ADMIN]
TV: Living tiene cable + fútbol · Hab. matrimonial solo streaming (cuenta propia)

═══════════════════════════════════════
TARIFAS (USD con IVA incluido)
═══════════════════════════════════════
• Temp. alta (16 dic–28 feb): USD 200/noche
• Fines de semana largos: USD 100/noche
• Resto del año: USD 80/noche
• Grupos amigos +23: precio +20%

FSL 2026: 14-17/02 · 21-24/03 · 2-5/04 · 1-3/05 · 23-25/05 · 13-15/06 · 9-12/07 · 15-17/08 · 10-12/10 · 21-23/11 · 5-8/12 · 25-27/12

PAGO: Transferencia · Depósito · Débito · Crédito 1 cuota · Efectivo solo en recepción en Pinamar
Pesos: cotización dólar oficial venta Banco Nación

POLÍTICAS: Sin mínimo de noches · Seña 50% · Cancelación: se pierde seña, no se debe saldo

═══════════════════════════════════════
FORMATO PRESUPUESTO
═══════════════════════════════════════
📋 *PRESUPUESTO — LAS ARENAS PINAMAR*

📅 Ingreso: [fecha]
📅 Salida: [fecha]
🌙 Noches: [N]
💵 Precio por noche: USD [X]
💰 Total: USD [total]
💳 Seña (50%): USD [seña]
🏠 Resto al llegar: USD [resto]

🕑 Check-in 14hs · Check-out 10hs

✅ *Incluye:* Wi-Fi · TV cable + fútbol · Sábanas y toallas · Cochera cubierta[Si temp. alta agregar: · Mucama diaria]

⚠️ Válido 24hs. No garantiza disponibilidad hasta confirmar con seña.

═══════════════════════════════════════
CASOS ESPECIALES → usar [NOTIFICAR_ADMIN]
═══════════════════════════════════════
- Quiere reservar → "Perfecto! El equipo te contacta para coordinar la seña." + [NOTIFICAR_ADMIN]
- Reserva vigente/check-in → pedir nombre y medio → "A las 14hs te anunciás en recepción. ¿A qué hora llegás?" + [NOTIFICAR_ADMIN]
- Comprobante de pago → "Muchas gracias! ¿Nombre del titular?" + [NOTIFICAR_ADMIN]
- Objeto olvidado reciente → pedir qué/unidad/nombre + [NOTIFICAR_ADMIN]
- Objeto olvidado hace mucho → "A la brevedad alguien te responde" + [NOTIFICAR_ADMIN]
- Cambio de fechas → "A la brevedad alguien te responde" + [NOTIFICAR_ADMIN]
- Contrato → "A la brevedad alguien te responde" + [NOTIFICAR_ADMIN]
- Cualquier duda → "Consulto con el equipo" + [NOTIFICAR_ADMIN]`;

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

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);
  try {
    const value = req.body.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];
    if (!message) return;

    const from = message.from;
    const contactName = value?.contacts?.[0]?.profile?.name || "";
    if (message.type !== "text" && message.type !== "image") return;

    const texto = message.type === "text" ? message.text.body : "[El cliente envió una imagen]";
    console.log(`📩 [${from}] ${contactName}: ${texto}`);

    let conv = await getConversacion(from);
    if (!conv) {
      conv = { phone: from, name: contactName, messages: [], foto_enviada: false };
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

    let textoRespuesta = respuesta.content[0].text;

    // Detectar flags
    const enviarFotos = textoRespuesta.includes("[ENVIAR_FOTOS]");
    const notificarAdmin = textoRespuesta.includes("[NOTIFICAR_ADMIN]");

    // Limpiar flags del texto
    textoRespuesta = textoRespuesta.replace(/\[ENVIAR_FOTOS\]/g, "").replace(/\[NOTIFICAR_ADMIN\]/g, "").trim();

    const messagesFinales = [...messagesTruncated, { role: "assistant", content: textoRespuesta }];
    await upsertConversacion(from, conv.name, messagesFinales, conv.foto_enviada || enviarFotos);

    // Enviar respuesta de texto primero
    await enviarMensaje(from, textoRespuesta);

    // Si corresponde enviar fotos (y no se enviaron antes)
    if (enviarFotos && !conv.foto_enviada) {
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
      await enviarMensaje(from, `🎥 *Las Arenas Pinamar*\n${videoUrl}`);
    }

    // Notificar al admin si corresponde
    if (notificarAdmin || message.type === "image") {
      await notificarAdmin_fn(from, conv.name, texto);
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
  }
});

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

async function notificarAdmin_fn(from, nombre, mensaje) {
  if (!ADMIN_PHONE) return;
  const aviso = `🔔 *ATENCIÓN REQUERIDA*\n📱 +${from}\n👤 ${nombre || "Sin nombre"}\n💬 "${mensaje}"\n\n👆 Tomar el hilo de esta conversación.`;
  await enviarMensaje(ADMIN_PHONE, aviso);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🤖 Chatbot Las Arenas corriendo en puerto ${PORT}`));
