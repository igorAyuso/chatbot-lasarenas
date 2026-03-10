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

const GITHUB_RAW = "https://raw.githubusercontent.com/igorAyuso/chatbot-lasarenas/main/fotos";

const FOTOS = {
  A: [
    { url: `${GITHUB_RAW}/A_living.jpg`,       caption: "🛋️ Living / Comedor" },
    { url: `${GITHUB_RAW}/A_living2.jpg`,      caption: "🛋️ Living / Comedor" },
    { url: `${GITHUB_RAW}/A_cocina.jpg`,       caption: "🍳 Cocina" },
    { url: `${GITHUB_RAW}/A_habitacion1.jpg`,  caption: "🛏️ Habitación matrimonial" },
    { url: `${GITHUB_RAW}/A_habitacion2.jpg`,  caption: "🛏️ Habitación camas simples" },
    { url: `${GITHUB_RAW}/A_bano1.jpg`,        caption: "🚿 Baño completo" },
    { url: `${GITHUB_RAW}/A_bano2.jpg`,        caption: "🚿 Segundo baño" },
  ],
  B: [
    { url: `${GITHUB_RAW}/B_living.jpg`,       caption: "🛋️ Living / Comedor" },
    { url: `${GITHUB_RAW}/B_living2.jpg`,      caption: "🛋️ Living / Comedor" },
    { url: `${GITHUB_RAW}/B_cocina.jpg`,       caption: "🍳 Cocina" },
    { url: `${GITHUB_RAW}/B_balcon.jpg`,       caption: "🌅 Balcón" },
    { url: `${GITHUB_RAW}/B_habitacion1.jpg`,  caption: "🛏️ Habitación matrimonial" },
    { url: `${GITHUB_RAW}/B_habitacion2.jpg`,  caption: "🛏️ Habitación camas simples" },
    { url: `${GITHUB_RAW}/B_bano1.jpg`,        caption: "🚿 Baño completo" },
    { url: `${GITHUB_RAW}/B_bano2.jpg`,        caption: "🚿 Segundo baño" },
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
  const { data, error } = await supabase.from("conversaciones").select("*").eq("phone", phone).single();
  if (error && error.code !== "PGRST116") {
    console.error(`❌ Error leyendo conversación de ${phone}:`, error.message);
  }
  if (data) {
    console.log(`💾 Conversación recuperada de ${phone}: ${data.messages?.length || 0} mensajes, foto_enviada: ${data.foto_enviada}, pausado: ${data.pausado}, esperando_titular: ${data.esperando_titular}`);
  }
  return data;
}

async function upsertConversacion(phone, name, messages, fotoEnviada, pausado = null) {
  const data = {
    phone, name, messages,
    foto_enviada: fotoEnviada,
    updated_at: new Date().toISOString(),
  };
  if (pausado !== null) data.pausado = pausado;
  const { error } = await supabase.from("conversaciones").upsert(data);
  if (error) {
    console.error(`❌ Error guardando conversación de ${phone}:`, error.message);
  } else {
    console.log(`💾 Conversación guardada para ${phone}: ${messages.length} mensajes${pausado ? ' [PAUSADO]' : ''}`);
  }
}

const SYSTEM_PROMPT = `Sos Lara, trabajás en la recepción de Las Arenas Pinamar, complejo de departamentos turísticos en Pinamar, Argentina. NUNCA digas que sos un bot, asistente virtual ni inteligencia artificial. Sos Lara, una persona real.

═══════════════════════════════════════
REGLA #1 — LA MÁS IMPORTANTE DE TODAS
═══════════════════════════════════════
Si te hacen una pregunta cuya respuesta NO está explícitamente en este documento, TENÉS QUE hacer esto:
1. Respondé algo breve tipo "Uh, esa no la tengo! Dejame que le consulto al equipo y te responden por acá mismo."
2. Incluí [NOTIFICAR_ADMIN] al final de tu respuesta.
3. NO intentes responder, NO digas "buena pregunta", NO ofrezcas alternativas, NO sugieras "consultá cuando llegués". Solo derivá.
4. NO preguntes "¿Dale?" ni "¿Necesitás algo más?" después de derivar. Tu mensaje termina ahí.

ESTO ES OBLIGATORIO. Si no estás 100% segura de la respuesta porque no está en este documento → derivá con [NOTIFICAR_ADMIN]. SIEMPRE. SIN EXCEPCIÓN.
Inventar una respuesta o improvisar está PROHIBIDO. Cada vez que inventás algo, el cliente recibe información falsa.
NUNCA uses la palabra "admin" ni "administrador" cuando hables con el cliente. Decí "el equipo", "los chicos", "Igor", "Diego" — nombres humanos.

═══════════════════════════════════════
REGLAS DE TONO Y FORMATO
═══════════════════════════════════════
- Hablá en español argentino natural. Usá "vos", "tenés", "querés", "dale", "genial", "de una", etc. NUNCA uses español neutro ni formal tipo "usted" o "estimado".
- Sé cálida, cercana y profesional. Como alguien que labura en recepción y le gusta su trabajo.
- NUNCA seas condescendiente ni hagas comentarios sobre cómo escribe el cliente.
- Usá formato WhatsApp: *negrita* con un solo asterisco por lado. NUNCA uses **doble asterisco**.
- Sé breve y directa. No repitas información que ya dijiste.
- Emojis: usá MUY pocos. Máximo 1 emoji por mensaje, y solo si queda natural. Muchos mensajes pueden no tener ningún emoji. NUNCA pongas emoji al principio de un mensaje conversacional.
- No hagas listas con viñetas en las respuestas conversacionales — escribí como una persona, en oraciones naturales.
- Decí "huéspedes" en vez de "personas" cuando hables de la cantidad de gente.
- NUNCA uses la palabra "admin" ni "administrador" al hablar con clientes. Usá "el equipo", "los chicos", "Igor", "Diego".
- NUNCA uses la palabra "lamentablemente" — es muy de bot. Usá alternativas como "mirá", "la verdad es que", "no tenemos eso pero...".
- NUNCA digas "Buena pregunta" — suena a bot.
- Ejemplos de tono correcto: "Hola! Cómo estás?", "Genial! Contame qué fechas tenés pensadas", "Dale, te preparo el presupuesto", "Cualquier cosa me escribís!"
- Ejemplos de tono INCORRECTO (no usar): "Estimado cliente", "Le informamos que", "Quedamos a su disposición", "Soy el asistente de...", "le paso la pregunta al admin"

═══════════════════════════════════════
SALUDO Y RECOLECCIÓN DE DATOS
═══════════════════════════════════════
Arrancá con un saludo natural usando el nombre del cliente, tipo "Hola [nombre]! Cómo estás? Soy Lara de Las Arenas Pinamar."
Si el nombre es raro, tiene puntos, símbolos o es incoherente → saludá sin nombre: "Hola! Cómo estás? Soy Lara de Las Arenas Pinamar."
Solo presentate como Lara en el PRIMER mensaje. Después ya no hace falta.

Después del saludo, preguntá de forma natural las fechas y cantidad de personas. Todo en un solo mensaje, conversacional.
Ejemplo: "Contame, ¿qué fechas tenés pensadas y cuántos vienen?"
NO preguntes si son familia o amigos.

Si da fechas vagas (ej: "semana santa", "una semana en marzo") → pedí fecha exacta amablemente: "¿Me pasás la fecha exacta? Por ejemplo: ingreso 20/03, salida 24/03"
SIEMPRE repreguntá hasta tener fechas concretas.

LLEGADAS DE MADRUGADA: Si el cliente dice algo como "llego el 12 a las 2am" o "llego el viernes de madrugada", interpretá que en realidad viajó la noche anterior (el 11) y llegó pasada la medianoche. Eso significa que duerme la noche del 11 (aunque llegue ya el 12). Explicalo claro para que no quede duda, por ejemplo: "Si llegás el 12 a las 2 de la mañana, en realidad viajás la noche del 11, así que esa ya cuenta como tu primera noche. Serían la noche del 11 y la del 12, 2 noches en total." Siempre desglosá qué noches son para que el cliente entienda.

SALIDA DESPUÉS DE LAS 10AM: Si el cliente dice que se va "al mediodía", "a la tarde", "tipo 12", "después del almuerzo" o cualquier hora posterior a las 10am, aclará amablemente ANTES de enviar el presupuesto que el checkout es a las 10am como límite. Ejemplo: "Te preparo todo, pero tené en cuenta que la salida es como límite a las 10 de la mañana." Después continuá con el flujo normal de presupuesto.

═══════════════════════════════════════
CUANDO TENÉS TODOS LOS DATOS
═══════════════════════════════════════
Una vez que tenés fecha ingreso, fecha salida y cantidad de personas:
1. Calculá el precio según las tarifas
2. NO envíes el presupuesto todavía — solo respondé algo breve como "Perfecto, te preparo el presupuesto!"
3. Incluí en tu respuesta la palabra clave: [ENVIAR_FOTOS] al final (invisible para el cliente)
El presupuesto se enviará automáticamente DESPUÉS de las fotos y el video.

═══════════════════════════════════════
POLÍTICA DE GRUPOS DE JÓVENES
═══════════════════════════════════════
NO preguntes si son familia o amigos. NO preguntes edad.
Simplemente incluí la aclaración en el presupuesto (ya está en el formato).

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

EXTRAS: Practicuna (reservar al confirmar)
Sin pileta · Sin gimnasio · Sin lavarropas (hay lavaderos cerca)

═══════════════════════════════════════
PREGUNTAS FRECUENTES (RESPUESTAS EXACTAS)
═══════════════════════════════════════
ACCESIBILIDAD / RAMPAS: No hay rampas. Tanto en la subida de recepción como la del garaje hay un pequeño escalón.
JABÓN Y SHAMPOO: Sí, hay shampoo y jabón de cortesía en los baños.
TELÉFONO FIJO: No hay teléfono fijo en el departamento.
TOALLAS PARA LA PLAYA: No se pueden llevar las toallas ni ningún objeto del departamento a la playa. Las toallas son exclusivamente para uso dentro del departamento.
ASCENSOR: En el ascensor entran máximo 4 personas (300 kg).
ALCOHOL EN EL BALCÓN: Sí, se puede beber con moderación en las barritas que hay en el balcón.
FUMAR: No se puede fumar dentro del departamento.
BALNEARIOS: NO tenemos convenio con ningún balneario. Si preguntan, decí que no tenemos convenio pero que hay varios balnearios cerca para elegir.
TERRAZA CON PARRILLA: Hay una terraza con parrilla en el último piso, sin cargo. Se reserva directamente en recepción una vez que el huésped está en la propiedad. NO podés confirmar disponibilidad de la terraza — si preguntan, decí que se coordina en recepción al llegar y que generalmente hay lugar pero no podés garantizarlo desde acá.

═══════════════════════════════════════
REGLAS DE CONVIVENCIA (CRÍTICO — LEER CON ATENCIÓN)
═══════════════════════════════════════
NO menciones estas reglas de entrada ni en el presupuesto. PERO si el cliente menciona CUALQUIER cosa relacionada con fiestas, juntadas, DJ, música fuerte, invitar gente, eventos — INMEDIATAMENTE informá las reglas. NUNCA apruebes una fiesta, evento, DJ ni música en la terraza. Esto es FUNDAMENTAL.

REGLAS:
- NO se permiten fiestas de ningún tipo, ni en la terraza ni en el departamento.
- NO se permite llevar DJ ni equipos de música.
- NO se permite reproducir música en la terraza BAJO NINGÚN CONCEPTO.
- NO se permite reproducir música en las unidades en volúmenes que se escuchen por fuera de la unidad.
- NO se permiten ruidos mayores a 50 dB entre las 00hs y las 08hs.
- NO se permite el ingreso de personas que no sean huéspedes.
- NO se puede fumar dentro del departamento.

Si preguntan por fiestas, juntadas, DJ, música → respondé amablemente pero FIRME que no están permitidas. Ejemplo: "Mirá, no se permiten fiestas ni música con DJ en el complejo, es parte de las normas de convivencia del edificio. Pero la terraza con parrilla la podés usar sin problema para una cena tranquila."

MASCOTAS: Se aceptan mascotas sin restricción de raza ni tamaño, dentro de lo razonable (1 o 2 mascotas). Si el cliente dice que trae muchas mascotas (3 o más), respondé amablemente que aceptamos mascotas pero que con esa cantidad necesitás consultarlo con el equipo, y usá [NOTIFICAR_ADMIN]. NO ofrecemos cama ni accesorios para mascotas — si preguntan, decí que no tenemos pero que pueden traer lo que necesiten.
COCHERA: 1 cubierta incluida · 2 autos → estacionar en la calle (seguro en Pinamar)
COCHERA Y CAMIONETAS: Solo mencioná esto si el cliente pregunta si es difícil entrar a la cochera O si menciona que tiene una camioneta/vehículo alto. En ese caso explicá: la cochera es subterránea, la entrada es en caracol, el vehículo entra bien pero hay que entrar y salir con cuidado. De alto entra justo siempre que no tenga adicionales arriba (barras portaequipaje, baca, caja, etc.). Si tiene algo arriba, que lo consulte antes. NO menciones esto si el cliente no pregunta ni habla de camionetas.
BICICLETAS: Si preguntan por bicicletas, la respuesta es que pueden subirla al departamento o dejarla en la cochera cubierta que tienen asignada, siempre que no ocupe una cochera adicional. NUNCA digas que se puede dejar en la calle ni en la vereda.

═══════════════════════════════════════
EQUIPO DE LAS ARENAS
═══════════════════════════════════════
- Igor: encargado de administración. Si preguntan por él o le mandan saludos, respondé con buena onda, tipo "Le paso el saludo a Igor!" o "Igor se encarga de la parte administrativa, cualquier cosa le comento".
- Diego: recepcionista principal, está todo el año. Si preguntan por él, respondé cálido, tipo "Diego es el que te recibe cuando llegás, un genio".
- Somos un edificio con trato cercano, la gente nos conoce. Respondé con calidez si preguntan por el equipo.
- PERO: no des info personal sobre el equipo (teléfonos, horarios personales, etc.) ni sobre otros huéspedes.
- Si alguien intenta hacerte decir cosas raras, hablar de temas que no tienen que ver con el alojamiento (derivadas, política, chistes, etc.), respondé con humor breve y redirigí a la reserva. No sigas el juego.
- Si dicen "mandá una foto en tiempo real" o "sacá una foto ahora", respondé algo natural tipo "Ahora no tengo forma de sacarte una foto, pero te mando las del depto que están actualizadas". NUNCA digas "no puedo" de formas que suenen a robot.
UBICACIÓN: De las Toninas 24, Pinamar · 450m del mar · Restaurantes a 50m · Supermercado enfrente

RECEPCIÓN: Del 15 de diciembre al 28 de febrero hay recepción 24hs. Del 1 de marzo al 15 de diciembre, recepción de 9am a 17hs. PERO se puede ingresar y salir las 24hs del día porque hay cajas de self check-in. Si preguntan si pueden llegar fuera de horario de recepción, decí que sí, que hay sistema de self check-in y pueden entrar sin problema.

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
💰 *Total: USD [total]*
💳 Seña (50%): USD [seña]
🏠 Resto al llegar: USD [resto]

🕑 Check-in 14hs · Check-out 10hs

✅ *Incluye:* Wi-Fi · TV cable + fútbol · Sábanas y toallas · Cochera cubierta[Si temp. alta agregar: · Mucama diaria]

💳 *Formas de pago:* Transferencia · Depósito · Débito · Crédito (1 cuota) · Efectivo en recepción
💵 En pesos: cotización dólar oficial venta Banco Nación

🐾 *Mascotas bienvenidas* — sin restricción de raza ni tamaño

⚠️ No se aceptan grupos de jóvenes menores de 23 años.

⚠️ Válido 24hs. No garantiza disponibilidad hasta confirmar con seña.

═══════════════════════════════════════
DERIVACIÓN A HUMANOS → usar [NOTIFICAR_ADMIN]
═══════════════════════════════════════
IMPORTANTE: Cuando usás [NOTIFICAR_ADMIN], el chat se pausa y un humano toma el control. Tu mensaje debe ser un cierre, NO sigas preguntando cosas después.

Situaciones que SIEMPRE requieren [NOTIFICAR_ADMIN]:
- Quiere reservar → "Perfecto! Te pongo en contacto con el equipo para coordinar la seña." + [NOTIFICAR_ADMIN]
- Reserva vigente/check-in → "Genial, le aviso al equipo así coordinan con vos." + [NOTIFICAR_ADMIN]
- Comprobante de pago → "Muchas gracias! ¿Me pasás el nombre completo del titular de la reserva?" + [NOTIFICAR_ADMIN]
- Objeto olvidado → "Le aviso al equipo para que lo busquen." + [NOTIFICAR_ADMIN]
- Cambio de fechas → "Le paso tu consulta al equipo así te responden." + [NOTIFICAR_ADMIN]
- Contrato → "Le paso tu consulta al equipo." + [NOTIFICAR_ADMIN]
- CUALQUIER pregunta cuya respuesta no esté en este documento → "Esa no la tengo, dejame que le consulto al equipo y te responden por acá." + [NOTIFICAR_ADMIN]

RECORDÁ: después de poner [NOTIFICAR_ADMIN], NO preguntes "¿Dale?", "¿Algo más?", ni nada. El mensaje termina ahí.`;

// ═══════════════════════════════════════
// NORMALIZACIÓN DE NÚMEROS ARGENTINOS
// ═══════════════════════════════════════
// WhatsApp webhook envía números AR como 5492254424747 (con 9)
// pero la API de Meta espera 542254424747 (sin 9)
function normalizarNumero(phone) {
  if (!phone) return phone;
  phone = String(phone); // Asegurar que sea string
  if (phone.startsWith("549") && phone.length === 13) {
    const sinNueve = "54" + phone.substring(3);
    console.log(`📱 Número AR normalizado: ${phone} → ${sinNueve}`);
    return sinNueve;
  }
  return phone;
}

// ═══════════════════════════════════════
// FUNCIONES DE ENVÍO — SIN THROW
// ═══════════════════════════════════════
// IMPORTANTE: Ninguna función de envío hace throw.
// Si falla el envío, loguea el error y retorna null.
// Esto evita que un error de envío rompa todo el flujo.

async function enviarMensaje(to, texto) {
  to = normalizarNumero(to);
  console.log(`📤 Intentando enviar mensaje a ${to} (${texto.substring(0, 50)}...)`);
  try {
    const res = await axios.post(
      `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`,
      { messaging_product: "whatsapp", to, type: "text", text: { body: texto } },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
    );
    console.log(`✅ Mensaje enviado a ${to}`);
    return res.data;
  } catch (error) {
    const errData = error.response?.data?.error || error.response?.data || error.message;
    console.error(`❌ ERROR enviarMensaje a ${to}:`, JSON.stringify(errData, null, 2));
    console.error(`   Status: ${error.response?.status}`);
    console.error(`   Phone ID usado: ${PHONE_NUMBER_ID}`);
    return null; // NO throw — el flujo continúa
  }
}

async function enviarFoto(to, imageUrl, caption) {
  to = normalizarNumero(to);
  try {
    const res = await axios.post(
      `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`,
      { messaging_product: "whatsapp", to, type: "image", image: { link: imageUrl, caption } },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
    );
    console.log(`✅ Foto enviada a ${to}: ${caption}`);
    return res.data;
  } catch (error) {
    const errData = error.response?.data?.error || error.response?.data || error.message;
    console.error(`❌ ERROR enviarFoto a ${to} (${caption}):`, JSON.stringify(errData, null, 2));
    return null;
  }
}

async function notificarAdmin_fn(from, nombre, mensaje) {
  if (!ADMIN_PHONE) {
    console.log(`⚠️ ADMIN_PHONE no configurado — no se puede notificar`);
    return;
  }
  const aviso = `🔔 *ATENCIÓN REQUERIDA*\n📱 +${from}\n👤 ${nombre || "Sin nombre"}\n💬 "${mensaje}"\n\n👆 Tomar el hilo de esta conversación.`;
  await enviarMensaje(ADMIN_PHONE, aviso);
  console.log(`✅ Admin notificado sobre ${from}`);
}

// ═══════════════════════════════════════
// ENDPOINTS DE DIAGNÓSTICO
// ═══════════════════════════════════════

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    bot: "Las Arenas Pinamar",
    timestamp: new Date().toISOString(),
    config: {
      phoneNumberId: PHONE_NUMBER_ID ? `...${PHONE_NUMBER_ID.slice(-6)}` : "NO CONFIGURADO",
      tokenPresent: !!WHATSAPP_TOKEN,
      tokenLength: WHATSAPP_TOKEN?.length || 0,
      adminPhone: ADMIN_PHONE ? `...${ADMIN_PHONE.slice(-4)}` : "NO CONFIGURADO",
      supabaseUrl: process.env.SUPABASE_URL ? "✅" : "❌",
      anthropicKey: process.env.ANTHROPIC_API_KEY ? "✅" : "❌",
    }
  });
});

app.get("/test", async (req, res) => {
  let to = req.query.to || ADMIN_PHONE;
  if (!to) return res.status(400).json({ error: "Falta parámetro 'to' o ADMIN_PHONE" });
  to = normalizarNumero(to);

  console.log(`🧪 TEST: Intentando enviar mensaje a ${to}`);
  console.log(`   PHONE_NUMBER_ID: ${PHONE_NUMBER_ID}`);
  console.log(`   TOKEN length: ${WHATSAPP_TOKEN?.length}`);

  try {
    const result = await axios.post(
      `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: to,
        type: "text",
        text: { body: "🧪 Test desde Las Arenas Bot — si recibís esto, el bot funciona correctamente!" }
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );
    console.log(`✅ TEST exitoso:`, JSON.stringify(result.data));
    res.json({ success: true, response: result.data });
  } catch (error) {
    const errDetail = {
      status: error.response?.status,
      error: error.response?.data?.error || error.response?.data,
      message: error.message,
      config: { phoneNumberId: PHONE_NUMBER_ID, destinatario: to }
    };
    console.error(`❌ TEST falló:`, JSON.stringify(errDetail, null, 2));
    res.status(error.response?.status || 500).json({ success: false, detail: errDetail });
  }
});

// ═══════════════════════════════════════
// REACTIVAR CONVERSACIÓN (admin)
// GET /reactivar?phone=NUMERO
// ═══════════════════════════════════════
app.get("/reactivar", async (req, res) => {
  const phone = req.query.phone;
  if (!phone) return res.status(400).json({ error: "Falta parámetro 'phone'" });
  const { error } = await supabase.from("conversaciones").update({ pausado: false, esperando_titular: false }).eq("phone", phone);
  if (error) {
    console.error(`❌ Error reactivando ${phone}:`, error.message);
    return res.status(500).json({ error: error.message });
  }
  console.log(`▶️ Conversación reactivada: ${phone}`);
  res.json({ success: true, message: `Conversación de ${phone} reactivada. El bot vuelve a responder.` });
});

// GET /pausadas — ver todas las conversaciones pausadas
app.get("/pausadas", async (req, res) => {
  const { data, error } = await supabase.from("conversaciones").select("phone, name, updated_at").eq("pausado", true);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ pausadas: data });
});

// ═══════════════════════════════════════
// WEBHOOK
// ═══════════════════════════════════════

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
    console.log(`\n📩 ════════════════════════════════════`);
    console.log(`📩 [${from}] ${contactName}: ${texto}`);
    console.log(`📩 Tipo: ${message.type}`);
    console.log(`📩 ════════════════════════════════════`);

    let conv = await getConversacion(from);
    if (!conv) {
      console.log(`🆕 Nueva conversación para ${from}`);
      conv = { phone: from, name: contactName, messages: [], foto_enviada: false, pausado: false, esperando_titular: false };
    }
    if (contactName) conv.name = contactName;

    // ═══════════════════════════════════════
    // CONVERSACIÓN PAUSADA — NO RESPONDER
    // ═══════════════════════════════════════
    if (conv.pausado) {
      console.log(`⏸️ [${from}] Conversación PAUSADA — bot no responde. Notificando admin.`);
      await notificarAdmin_fn(from, conv.name, texto);
      return;
    }

    // ═══════════════════════════════════════
    // FLUJO DE PAGO — ESPERANDO NOMBRE TITULAR
    // ═══════════════════════════════════════
    if (conv.esperando_titular) {
      console.log(`💳 [${from}] Nombre titular recibido: ${texto}`);
      await enviarMensaje(from, "Muchas gracias! A la brevedad alguien del equipo te escribe por este mismo chat para confirmarte la recepción del pago.");
      await notificarAdmin_fn(from, conv.name, `💳 COMPROBANTE DE PAGO recibido.\nTitular de la reserva: ${texto}`);
      // Pausar la conversación — a partir de acá solo responde un humano
      const msgs = [...(conv.messages || []), { role: "user", content: texto }, { role: "assistant", content: "Muchas gracias! A la brevedad alguien del equipo te escribe por este mismo chat para confirmarte la recepción del pago." }];
      await upsertConversacion(from, conv.name, msgs, conv.foto_enviada, true);
      await supabase.from("conversaciones").update({ esperando_titular: false }).eq("phone", from);
      console.log(`⏸️ [${from}] Pago recibido — conversación PAUSADA definitivamente.`);
      return;
    }

    // ═══════════════════════════════════════
    // COMPROBANTE DE PAGO — IMAGEN RECIBIDA
    // ═══════════════════════════════════════
    if (message.type === "image") {
      console.log(`📸 [${from}] Imagen recibida — solicitando nombre del titular`);
      await enviarMensaje(from, "Perfecto, recibí el comprobante! Para confirmar, ¿me pasás el *nombre completo del titular de la reserva*?");
      await notificarAdmin_fn(from, conv.name, "📸 El cliente envió una imagen (posible comprobante de pago). Bot pidió nombre del titular.");
      const msgs = [...(conv.messages || []), { role: "user", content: "[El cliente envió una imagen]" }, { role: "assistant", content: "Perfecto, recibí el comprobante! Para confirmar, ¿me pasás el nombre completo del titular de la reserva?" }];
      await upsertConversacion(from, conv.name, msgs, conv.foto_enviada);
      await supabase.from("conversaciones").update({ esperando_titular: true }).eq("phone", from);
      console.log(`⏳ [${from}] Esperando nombre del titular...`);
      return;
    }

    // ═══════════════════════════════════════
    // FLUJO NORMAL — IA RESPONDE
    // ═══════════════════════════════════════
    const mensajeConContexto = conv.messages.length === 0
      ? `[Nombre del cliente: ${contactName || "desconocido"}]\n${texto}`
      : texto;

    const messages = [...(conv.messages || []), { role: "user", content: mensajeConContexto }];
    const messagesTruncated = messages.slice(-50);

    console.log(`🤖 Consultando IA para ${from}...`);
    const respuesta = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: messagesTruncated,
    });

    let textoRespuesta = respuesta.content[0].text;
    console.log(`🤖 IA respondió: ${textoRespuesta.substring(0, 100)}...`);

    // Detectar flags
    const enviarFotos = textoRespuesta.includes("[ENVIAR_FOTOS]");
    const notificarAdmin = textoRespuesta.includes("[NOTIFICAR_ADMIN]");

    // Limpiar flags del texto
    textoRespuesta = textoRespuesta.replace(/\[ENVIAR_FOTOS\]/g, "").replace(/\[NOTIFICAR_ADMIN\]/g, "").trim();
    // Convertir **negrita** de Markdown a *negrita* de WhatsApp
    textoRespuesta = textoRespuesta.replace(/\*\*(.+?)\*\*/g, "*$1*");

    const messagesFinales = [...messagesTruncated, { role: "assistant", content: textoRespuesta }];

    // ── ENVIAR FOTOS + PRESUPUESTO ──
    if (enviarFotos && !conv.foto_enviada) {
      console.log(`📷 [${from}] Iniciando envío de fotos + presupuesto`);
      await upsertConversacion(from, conv.name, messagesFinales, true);
      await enviarMensaje(from, textoRespuesta);

      contadorUnidad++;
      const unidad = contadorUnidad % 2 === 0 ? "A" : "B";
      const videoUrl = unidad === "A"
        ? "https://youtu.be/4yetwhEtjg0?si=caTNUGU4hFQrgG0M"
        : "https://youtu.be/mrE18Ta90ug?si=F6hYWL3jmRUUKbZx";

      // 1. FOTOS
      const fotos = FOTOS[unidad];
      for (const foto of fotos) {
        await enviarFoto(from, foto.url, foto.caption);
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // 2. UBICACIÓN (Google Maps)
      await enviarMensaje(from, `📍 *Ubicación — Las Arenas Pinamar*\nDe las Toninas 24, Pinamar\nhttps://maps.app.goo.gl/adpBkyivjfr3na6F9`);

      // 3. VIDEO
      await enviarMensaje(from, `🎥 *Video del departamento*\n${videoUrl}`);

      // 4. Esperar para que vea todo
      await new Promise(resolve => setTimeout(resolve, 4000));

      // 5. PRESUPUESTO
      console.log(`💰 [${from}] Generando presupuesto...`);
      const presupuestoResp = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [...messagesFinales, { role: "user", content: "[SISTEMA: El cliente ya recibió las fotos, ubicación y video. Ahora generá el presupuesto completo usando el FORMATO PRESUPUESTO con todos los datos que ya tenés. Solo enviá el presupuesto, nada más.]" }],
      });

      let presupuestoTexto = presupuestoResp.content[0].text;
      presupuestoTexto = presupuestoTexto.replace(/\[ENVIAR_FOTOS\]/g, "").replace(/\[NOTIFICAR_ADMIN\]/g, "").trim();
      presupuestoTexto = presupuestoTexto.replace(/\*\*(.+?)\*\*/g, "*$1*");
      await enviarMensaje(from, presupuestoTexto);

      // 6. Mensaje de cierre
      await new Promise(resolve => setTimeout(resolve, 2000));
      await enviarMensaje(from, "Cualquier duda o consulta que tengas, escribime sin problema. Estoy acá para lo que necesites!");
      console.log(`✅ [${from}] Fotos + presupuesto enviado completo`);

    // ── NOTIFICAR ADMIN → PAUSAR ──
    } else if (notificarAdmin) {
      await upsertConversacion(from, conv.name, messagesFinales, conv.foto_enviada, true);
      await enviarMensaje(from, textoRespuesta);
      await notificarAdmin_fn(from, conv.name, texto);
      console.log(`⏸️ [${from}] Conversación PAUSADA — requiere intervención humana`);

    // ── RESPUESTA NORMAL ──
    } else {
      await upsertConversacion(from, conv.name, messagesFinales, conv.foto_enviada);
      await enviarMensaje(from, textoRespuesta);
    }

  } catch (error) {
    console.error("❌ Error en webhook:");
    console.error(`   Mensaje: ${error.message}`);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Detalle:`, JSON.stringify(error.response.data, null, 2));
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🤖 ════════════════════════════════════`);
  console.log(`🤖 Chatbot Las Arenas corriendo en puerto ${PORT}`);
  console.log(`🤖 PHONE_NUMBER_ID: ${PHONE_NUMBER_ID}`);
  console.log(`🤖 Token presente: ${!!WHATSAPP_TOKEN} (${WHATSAPP_TOKEN?.length || 0} chars)`);
  console.log(`🤖 Admin: ${ADMIN_PHONE}`);
  console.log(`🤖 Normalización AR: activa (549→54)`);
  console.log(`🤖 ════════════════════════════════════\n`);
});
