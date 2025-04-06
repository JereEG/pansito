import path from "path";
import { google } from "googleapis";

const calendar = google.calendar("v3");

const auth = new google.auth.GoogleAuth({
  keyFile: path.join(process.cwd(), "src/credentials", "credentials.json"),
  scopes: ["https://www.googleapis.com/auth/calendar"],
});

/**
 * Agrega un evento al calendario de Google
 * @param {object} eventData - Datos del evento
 */
const appendToCalendar = async (eventData) => {
  try {
    const authClient = await auth.getClient();
    const calendarId = "primary";

    const response = await calendar.events.insert({
      auth: authClient,
      calendarId,
      resource: eventData,
    });

    console.log("✅ Evento agregado:", response.data.summary);
    return response.data;
  } catch (error) {
    console.error("❌ Error al agregar evento:", error);
    throw error;
  }
};

export default appendToCalendar;
