import { google } from 'googleapis';


const userTokens = new Map(); // En producción deberías persistirlos
import config from "../config/env.js";
console.log(process.env.GOOGLE_CLIENT_ID)
const oauth2Client = new google.auth.OAuth2(
  config.GOOGLE_CLIENT_ID,
  config.CLIENT_SECRET,
  config.GOOGLE_REDIRECT_URI
);
// ===============================
// Autenticación
// ===============================
function obtenerUrlDeAutenticacion() {
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/calendar", "email", "profile"],
    prompt: "consent",
    redirect_uri: config.GOOGLE_REDIRECT_URI,
  });
}

async function manejarCallbackDeAutenticacion(code) {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const gmail = userInfo.data.email;

    userTokens.set(gmail, tokens);

    return {
      success: true,
      gmail,
      mensaje: "Autenticación exitosa"
    };

  } catch (error) {
    return {
      success: false,
      error: "Error en la autenticación",
      detalle: error.message
    };
  }
}

// ===============================
// Agendado de eventos
// ===============================
async function agendarEvento({
  gmail,
  titulo,
  fecha,
  hora,
  horaFinal,
  minutosDeAntelacion = 10,
}) {
  try {
    const tokens = userTokens.get(gmail);
    if (!tokens) {
      return { success: false, error: "Usuario no autenticado", status: 401 };
    }

    oauth2Client.setCredentials(tokens);

    // Refresca automáticamente si el access_token expiró
    await oauth2Client.getAccessToken();
    userTokens.set(gmail, oauth2Client.credentials);

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const startDateTime = new Date(`${fecha}T${hora}`);
    const endDateTime = new Date(`${fecha}T${horaFinal}`);
    const endRecurrence = new Date(startDateTime);
    endRecurrence.setMonth(endRecurrence.getMonth() + 4);

    const event = {
      summary: titulo,
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: "America/Argentina/Buenos_Aires",
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: "America/Argentina/Buenos_Aires",
      },
      recurrence: [
        `RRULE:FREQ=WEEKLY;UNTIL=${
          endRecurrence.toISOString().replace(/[-:]/g, "").split(".")[0]
        }Z`,
      ],
      reminders: {
        useDefault: false,
        overrides: [{ method: "popup", minutes: minutosDeAntelacion }],
      },
    };

    const response = await calendar.events.insert({
      calendarId: "primary",
      resource: event,
    });

    return { success: true, event: response.data };
  } catch (error) {
    console.error("Error agendando evento:", error);

    if (error.code === 401) {
      return {
        success: false,
        error: "Token inválido o expirado",
        authUrl: obtenerUrlDeAutenticacion(),
      };
    }

    return { success: false, error: "Error interno del servidor" };
  }
}

async function listarEventosPorUsuario(gmail) {
  try {
    const tokens = userTokens.get(gmail);
    if (!tokens) {
      return { success: false, error: "Usuario no autenticado" };
    }

    oauth2Client.setCredentials(tokens);
    await oauth2Client.getAccessToken();
    userTokens.set(gmail, oauth2Client.credentials);

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    // Calcular rango de la semana actual (lunes a domingo)
    const hoy = new Date();
    const diaSemana = hoy.getDay(); // 0 (Dom) - 6 (Sáb)
    const diffLunes = (diaSemana === 0 ? -6 : 1) - diaSemana;

    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() + diffLunes);
    lunes.setHours(0, 0, 0, 0);

    const domingo = new Date(lunes);
    domingo.setDate(lunes.getDate() + 6);
    domingo.setHours(23, 59, 59, 999);

    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin: lunes.toISOString(),
      timeMax: domingo.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    });

    const eventos = res.data.items;
    if (!eventos || eventos.length === 0) {
      return {
        success: true,
        eventos: [],
        mensaje: "No hay eventos esta semana.",
      };
    }

    const dias = [
      "domingo",
      "lunes",
      "martes",
      "miércoles",
      "jueves",
      "viernes",
      "sábado",
    ];
    const eventosPorDia = {};

    eventos.forEach((event) => {
      const inicioStr = event.start.dateTime || event.start.date;
      const finStr = event.end?.dateTime || event.end?.date;
      const inicio = new Date(inicioStr);
      const fin = new Date(finStr);

      const dia = dias[inicio.getDay()];
      const horaInicio = inicioStr.includes("T")
        ? `${inicio.getHours()}hs`
        : null;
      const horaFin = finStr?.includes("T") ? `${fin.getHours()}hs` : null;

      const textoEvento =
        horaInicio && horaFin
          ? `📅 ${event.summary} ${horaInicio} a ${horaFin}`
          : `📅 ${event.summary}`;

      if (!eventosPorDia[dia]) {
        eventosPorDia[dia] = [];
      }

      eventosPorDia[dia].push(textoEvento);
    });

    const ordenDias = [
      "lunes",
      "martes",
      "miércoles",
      "jueves",
      "viernes",
      "sábado",
      "domingo",
    ];
    const lista = ordenDias.map((dia) => {
      const eventos = eventosPorDia[dia];
      if (eventos) {
        return `${dia.charAt(0).toUpperCase() + dia.slice(1)}:\n${eventos.join(
          "\n"
        )}`;
      } else {
        return `${
          dia.charAt(0).toUpperCase() + dia.slice(1)
        }:\neste día no tienes nada programado`;
      }
    });

    return {
      success: true,
      eventos: lista,
    };
  } catch (error) {
    console.error("Error al listar eventos:", error);
    return {
      success: false,
      error: "Error al obtener los eventos",
    };
  }
}

/**
 * Elimina eventos de Google Calendar que coincidan con el título/summary especificado
 * @param {string} gmail - Correo del usuario autenticado
 * @param {string} titulo - Título/summary del evento a eliminar
 * @returns {Promise<Object>} - Resultado de la operación
 */
async function eliminarEventosPorTitulo(gmail, titulo) {
  try {
    const tokens = userTokens.get(gmail);
    if (!tokens) {
      return { success: false, error: "Usuario no autenticado", status: 401 };
    }

    oauth2Client.setCredentials(tokens);

    // Refresca automáticamente si el access_token expiró
    await oauth2Client.getAccessToken();
    userTokens.set(gmail, oauth2Client.credentials);

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    // Buscar eventos con el título/summary especificado
    const res = await calendar.events.list({
      calendarId: "primary",
      q: titulo, // Buscar eventos que contengan este texto en su título
      timeMin: new Date().toISOString(), // Buscar desde ahora hacia adelante
      singleEvents: true,
      orderBy: "startTime",
    });

    const eventos = res.data.items;
    if (!eventos || eventos.length === 0) {
      return {
        success: false,
        error: `No se encontraron eventos con el título "${titulo}"`,
      };
    }

    // Eliminar cada evento encontrado
    const eliminados = [];
    const errores = [];

    for (const evento of eventos) {
      try {
        await calendar.events.delete({
          calendarId: "primary",
          eventId: evento.id,
        });
        eliminados.push({
          id: evento.id,
          titulo: evento.summary,
          inicio: evento.start.dateTime || evento.start.date,
        });
      } catch (err) {
        console.error(`Error al eliminar evento ${evento.id}:`, err);
        errores.push({
          id: evento.id,
          error: err.message,
        });
      }
    }

    return {
      success: true,
      mensaje: `Se eliminaron ${eliminados.length} eventos con título "${titulo}"`,
      eventosEliminados: eliminados,
      errores: errores.length > 0 ? errores : undefined,
    };
  } catch (error) {
    console.error("Error eliminando eventos:", error);

    if (error.code === 401) {
      return {
        success: false,
        error: "Token inválido o expirado",
        authUrl: obtenerUrlDeAutenticacion(),
      };
    }

    return { 
      success: false, 
      error: "Error interno del servidor",
      detalle: error.message
    };
  }
}


// ===============================
// Export
// ===============================
export {
  obtenerUrlDeAutenticacion,
  manejarCallbackDeAutenticacion,
  agendarEvento,
  listarEventosPorUsuario,
  eliminarEventosPorTitulo,
};