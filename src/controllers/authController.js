import {
  obtenerUrlDeAutenticacion,
  manejarCallbackDeAutenticacion,
} from "../services/googleCalendarService.js"; // ajustá si el archivo tiene otro nombre

class AuthController {
  redirectToGoogle(req, res) {
    const url = obtenerUrlDeAutenticacion();
    res.redirect(url);
  }

  async googleCallback(req, res) {
    const code = req.query.code;
    if (!code) return res.status(400).send("Código no provisto");

    const resultado = await manejarCallbackDeAutenticacion(code);

    if (resultado.success) {
      res.send(`✅ Autenticación exitosa para ${resultado.gmail}`);
    } else {
      res.status(500).send(`❌ ${resultado.error}: ${resultado.detalle}`);
    }
  }
}

export default new AuthController();
