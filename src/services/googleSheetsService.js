import path from "path";
import { google } from "googleapis";

const sheets = google.sheets("v4");

async function addRowToSheet(auth, spreadsheetId, values) {
  const request = {
    spreadsheetId,
    range: "reservas",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    resource: {
      values: [values],
    },
    auth,
  };

  try {
    const response = (await sheets.spreadsheets.values.append(request)).data;
    console.log(
      "Respuesta de Google Sheets:",
      JSON.stringify(response, null, 2)
    );
    return response;
  } catch (error) {
    console.error("Error en addRowToSheet:", error.message);
    throw error; // Propaga el error para manejarlo en appendToSheet
  }

}

const appendToSheet = async (data) => {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: path.join(process.cwd(), "src/credentials", "credentials.json"),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const authClient = await auth.getClient();
    const spreadsheetId = "15qAal6v21qtK3-_39LWY7i3MPsWVExIzn0rUSh8it0s";

    const response = await addRowToSheet(authClient, spreadsheetId, data);
    console.log("Datos agregados:", response);
    return "Datos correctamente agregados";
  } catch (error) {
    console.error("Error en appendToSheet:", error.message);
    throw error; // Opcional: propaga el error si es necesario
  }
};

export default appendToSheet;
