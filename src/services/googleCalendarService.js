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

    // Refresca el token si hace falta
    await oauth2Client.getAccessToken();
    userTokens.set(gmail, oauth2Client.credentials);

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin: new Date().toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: "startTime",
    });

    const eventos = res.data.items;

    if (!eventos || eventos.length === 0) {
      return {
        success: true,
        eventos: [],
        mensaje: "No se encontraron eventos",
      };
    }

    const lista = eventos.map((event) => {
      const inicio = event.start.dateTime || event.start.date;
      return `📅 ${inicio} | ${event.summary}`;
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


// ===============================
// Export
// ===============================
export {
  obtenerUrlDeAutenticacion,
  manejarCallbackDeAutenticacion,
  agendarEvento,
  listarEventosPorUsuario,
};