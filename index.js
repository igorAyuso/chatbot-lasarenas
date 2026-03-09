const express = require("express");
const axios = require("axios");
const Anthropic = require("@anthropic-ai/sdk");

const app = express();
app.use(express.json());

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const ADMIN_PHONE = process.env.ADMIN_PHONE;

const conversaciones = {};
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
- Si dio fechas vagas (ej: "semana santa", "una semana en marzo") → pedí fecha exacta de ingreso y salida con ejemplo: "Por ejemplo: ingreso 20/03, salida 24/03"
- Si dio todo → directo al presupuesto
- SIEMPRE repreguntá hasta obtener fechas concretas con día y mes

═══════════════════════════════════════
DEPARTAMENTO
═══════════════════════════════════════
• 3 Ambientes — 65 M2
• 1 habitación matrimonial
• 1 habitación con 2 camas simples
• Living-comedor con sofá cama
• Baño completo (ducha, bañadera, inodoro, lava manos, bidet)
• 2do baño (ducha, inodoro, lava manos)
• Cocina lavadero + balcón
• Capacidad MÁXIMA: 6 personas
• Pisos 2 al 6 (no se elige piso ni unidad específica)
• Edificio con 1 ascensor

INCLUYE: Wi-Fi • TV Full HD • Sábanas • Toallas • Cochera cubierta (1 por reserva)
Check-in: 14hs | Check-out: 10hs

CLIMATIZACIÓN:
• 1 aire acondicionado en living/comedor
• 1 estufa tiro balanceado en living/comedor
• Ventiladores disponibles para habitaciones (pedir en recepción)
• Estufas eléctricas disponibles en recepción

EXTRAS DISPONIBLES:
• Practicuna: disponible, se reserva al momento de hacer la reserva
• Terraza descubierta en último piso: vista al centro, mesas, sillas y parrilla — se reserva en recepción sin cargo
• No tiene pileta

MASCOTAS: ✅ Se aceptan sin restricción de raza ni tamaño

COCHERA:
• 1 cochera cubierta subterránea incluida por reserva
• Si vienen con 2 autos: informar que solo hay 1 cochera incluida y que es seguro estacionar en la calle en Pinamar (NO sugerir estacionamientos pagos)
• La cochera es subterránea, entra hasta camioneta grande sin adicionales arriba — NO mencionar esto a menos que pregunten

UBICACIÓN:
• De las Toninas 24, Pinamar, Buenos Aires
• A 450 metros del mar
• Pleno centro: restaurantes a 50 metros, supermercado enfrente en diagonal

MUCAMA:
• Temporada alta (01/12 al 28/02): servicio de mucama diario incluido
• Resto del año (01/03 al 01/12): no incluye limpieza

EARLY CHECK-IN / LATE CHECK-OUT:
• Temporada alta (01/12 al 28/02): NO disponible
• Resto del año: disponible, costo aproximado 50% de una noche — avisar que hay que chequear disponibilidad y notificar al equipo

═══════════════════════════════════════
TARIFAS (USD por noche)
═══════════════════════════════════════
• Temporada alta (16 dic – 28 feb): USD 200/noche
• Fines de semana largos: USD 100/noche
• Resto del año (10 mar – 15 dic): USD 80/noche

Fines de semana largos 2026:
14-17 feb | 21-24 mar | 2-5 abr | 1-3 may | 23-25 may | 13-15 jun
9-12 jul | 15-17 ago | 10-12 oct | 21-23 nov | 5-8 dic | 25-27 dic

═══════════════════════════════════════
FORMAS DE PAGO
═══════════════════════════════════════
• Transferencia bancaria
• Depósito bancario
• Tarjeta de débito
• Tarjeta de crédito en 1 pago (NO se aceptan cuotas)
• Pesos: cotización dólar oficial venta Banco Nación Billete
• Precio FINAL con IVA incluido

═══════════════════════════════════════
POLÍTICAS
═══════════════════════════════════════
• Presupuesto válido 24hs (no garantiza disponibilidad)
• Reserva efectiva = 50% de seña
• Saldo restante: se abona al llegar

═══════════════════════════════════════
FORMATO DEL PRESUPUESTO
═══════════════════════════════════════
Usá exactamente este formato:

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
• TV Full HD
• Sábanas y toallas
• Cochera cubierta
[Si temporada alta agregar: • Servicio de mucama diario]

⚠️ Presupuesto válido 24hs. No garantiza disponibilidad salvo reserva efectiva.

═══════════════════════════════════════
CASOS ESPECIALES — NOTIFICAR AL EQUIPO
═══════════════════════════════════════

1. QUIERE RESERVAR: Decile que el equipo lo contacta para coordinar la seña → notificar

2. RESERVA YA VIGENTE / CHECK-IN: Pedí nombre del titular y medio de reserva → notificar al equipo para que cheque → mientras tanto decile: "A partir de las 14hs te anunciás en recepción con tu nombre completo. ¿Aproximadamente a qué hora llegás a Pinamar?"

3. COMPROBANTE DE PAGO (Booking u otro): Si manda imagen o menciona comprobante → verificar que sea un comprobante → responder: "Muchas gracias! Alguien del equipo lo chequea pronto. Me podrías decir el nombre del titular de la reserva?" → notificar

4. OBJETO OLVIDADO RECIENTE: Preguntar qué se olvidó, en qué unidad y nombre del titular → notificar

5. OBJETO OLVIDADO HACE MUCHO o CASO DUDOSO: "Gracias por tu mensaje, a la brevedad alguien del equipo te responde" → notificar

6. EARLY CHECK-IN / LATE CHECK-OUT (fuera de temporada alta): Decir que hay que chequear disponibilidad y precio exacto → notificar

7. CUALQUIER COSA QUE NO SEPAS RESPONDER CON CERTEZA: "Voy a consultar con el equipo y te responden a la brevedad" → notificar`;

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

    // Solo procesamos mensajes de texto e imágenes
    if (message.type !== "text" && message.type !== "image") return;

    const texto = message.type === "text"
      ? message.text.body
      : "[El cliente envió una imagen]";

    console.log(`📩 [${from}] ${contactName}: ${texto}`);

    // Primera vez — enviar fotos, ubicación y video
    if (!conversaciones[from]) {
      conversaciones[from] = { messages: [], name: contactName };
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
    }

    // Actualizar nombre si lo tenemos
    if (contactName) conversaciones[from].name = contactName;

    // Agregar contexto del nombre al mensaje
    const mensajeConContexto = conversaciones[from].messages.length === 0
      ? `[Nombre del cliente: ${contactName || "desconocido"}]\n${texto}`
      : texto;

    conversaciones[from].messages.push({ role: "user", content: mensajeConContexto });
    if (conversaciones[from].messages.length > 20) {
      conversaciones[from].messages = conversaciones[from].messages.slice(-20);
    }

    // Respuesta de Claude
    const respuesta = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: conversaciones[from].messages,
    });

    const textoRespuesta = respuesta.content[0].text;
    conversaciones[from].messages.push({ role: "assistant", content: textoRespuesta });
    await enviarMensaje(from, textoRespuesta);

    // Notificar al admin según el caso
    const notificar = [
      "reservar", "reserva", "señar", "seña", "confirmar", "pagar",
      "comprobante", "transferencia", "booking", "check-in", "llegamos",
      "olvidé", "olvidamos", "perdí", "perdimos", "early", "late", "tardío"
    ];
    if (notificar.some((p) => texto.toLowerCase().includes(p)) || message.type === "image") {
      await notificarAdmin(from, contactName, texto);
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

// =============================================
// INICIO
// =============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🤖 Chatbot Las Arenas corriendo en puerto ${PORT}`));
