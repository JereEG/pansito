import appendToSheet from "./googleSheetsService.js";

// Datos de prueba
const testData = [
  "TEST_USER",
  "Test Name",
  "Test Pet",
  "Test Type",
  "Test Reason",
  new Date().toISOString(),
];

// Ejecuta la prueba
async function testAppend() {
  try {
    console.log("Iniciando prueba...");
    const result = await appendToSheet(testData);
    console.log("Resultado:", result);
    console.log("✅ Prueba exitosa. Revisa tu Google Sheet.");
  } catch (error) {
    console.error("❌ Error en prueba:", error);
  }
}

testAppend();
