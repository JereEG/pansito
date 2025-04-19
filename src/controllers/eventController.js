import { agendarEvento } from "../services/googleCalendarService.js";

class EventController {
  async agendarClase(req, res) {
    const resultado = await agendarEvento(req.body);

    if (resultado.success) {
      res.json({ success: true, event: resultado.event });
    } else {
      res.status(resultado.status || 500).json({
        error: resultado.error,
        ...(resultado.authUrl && { authUrl: resultado.authUrl }),
      });

    }
  }
}

export default new EventController();
