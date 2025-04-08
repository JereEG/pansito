import path from "path";
import { google } from "googleapis";

const calendar = google.calendar("v3");

// Inicializa la autenticación una sola vez
const auth = new google.auth.GoogleAuth({
  keyFile: path.join(process.cwd(), "src/credentials", "credentials.json"),
  scopes: ["https://www.googleapis.com/auth/calendar"],
});
const OAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.REDIRECT_URI
);

// Configura el token de acceso (debes obtenerlo via flujo OAuth2)
OAuth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});
/**
 * Agrega un evento al calendario de Google
 * @param {object} authClient - Cliente autenticado
 * @param {string} calendarId - ID del calendario
 * @param {object} eventData - Datos del evento
 */
async function addEventToCalendar(authClient, calendarId, eventData) {
  try {
    const response = await calendar.events.insert({
      auth: authClient,
      calendarId,
      resource: eventData,
      sendNotifications: true, // Notificar a los participantes
    });

    console.log("Evento agregado con éxito:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error en addEventToCalendar:", error);
    throw new Error(`Error agregando evento: ${error.message || error}`);
  }
}

/**
 * Función para manejar la autenticación y agregar eventos al calendario
 * @param {object} eventData - Datos del evento (título, fecha, etc.)
 */
const agregarEventoAlCalendario = async (
  title,
  startTime,
  endTime,
  reminderMinutes,
  correo
) => {
  try {
    const calendar = google.calendar({ version: "v3", auth: OAuth2Client });

    const event = {
      summary: title,
      start: {
        dateTime: startTime,
        timeZone: "America/Argentina/Buenos_Aires",
      },
      end: { dateTime: endTime, timeZone: "America/Argentina/Buenos_Aires" },
      attendees: [{ email: correo }],
      reminders: {
        useDefault: false,
        overrides: [
          { method: "popup", minutes: reminderMinutes },
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId: "primary",
      resource: event,
      sendUpdates: "all", // Reemplaza sendNotifications
    });

    return "Evento agregado correctamente";
  } catch (error) {
    console.error("Error detallado:", error.response?.data);
    throw new Error(`Error al crear evento: ${error.message}`);
  }
};


export default agregarEventoAlCalendario;
