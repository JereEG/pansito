import path from "path";
import { google } from "googleapis";

const calendar = google.calendar("v3");

// Inicializa la autenticación una sola vez
const auth = new google.auth.GoogleAuth({
  keyFile: path.join(process.cwd(), "src/credentials", "credentials.json"),
  scopes: ["https://www.googleapis.com/auth/calendar"],
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
const appendToCalendar = async (eventData) => {
  try {
    const authClient = await auth.getClient();
    const calendarId = "primary"; // Cambia esto si necesitas un calendario específico

    const response = await addEventToCalendar(
      authClient,
      calendarId,
      eventData
    );
    return "Evento agregado correctamente";
  } catch (error) {
    console.error("Error en appendToCalendar:", error);
    throw new Error(`Error general: ${error.message || error}`);
  }
};

export default appendToCalendar;
