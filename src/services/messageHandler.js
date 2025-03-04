import { response } from "express";
import whatsappService from "./whatsappService.js";
const cleanPhoneNumber = (number) => {
  return number.length >= 3 ? number.slice(0, 2) + number.slice(3) : number;
};
class MessageHandler {
  constructor() {
    this.appointmentState = {};
  }

  async handleIncomingMessage(message, senderInfo) {
    const mediaKeywords = ["media", "imagen", "video", "audio", "pdf"];

    if (message?.type === "text") {
      const incomingMessage = message.text.body.toLowerCase().trim();

      if (this.isGreeting(incomingMessage)) {
        await this.sendWelcomeMessage(
          cleanPhoneNumber(message.from),
          message.id,
          senderInfo
        );
        await this.sendWelcomeMenu(cleanPhoneNumber(message.from));
      } else if (mediaKeywords.includes(incomingMessage.toLowerCase().trim())) {
        await this.sendMedia(
          cleanPhoneNumber(message.from),
          incomingMessage.toLowerCase().trim()
        );
      } else if (this.appointmentState[cleanPhoneNumber(message.from)]) {
        await this.handleAppointmentFlow(
          cleanPhoneNumber(message.from),
          incomingMessage
        );
      } else {
        // const response = `Echo: ${message.text.body}`;
        // await whatsappService.sendMessage(
        //   cleanPhoneNumber(message.from),
        //   response,
        //   message.id
        // );
        await this.handleMenuOption(
          cleanPhoneNumber(message.from),
          incomingMessage
        );
      }
      await whatsappService.markAsRead(message.id);
    } else if (message?.type === "interactive") {
      const option = message?.interactive?.button_reply?.title
        .toLowerCase()
        .trim();
      await this.handleMenuOption(cleanPhoneNumber(message.from), option);
      await whatsappService.markAsRead(message.id);
    }
  }
  async sendMedia(to, incomingMessage) {
    let mediaUrl = "";
    let caption = "";
    let type = "";
    switch (incomingMessage) {
      case "imagen":
        mediaUrl = "https://s3.amazonaws.com/gndx.dev/medpet-imagen.png";
        caption = "¡Esto es una Imagen!";
        type = "image";
        break;
      case "video":
        mediaUrl = "https://s3.amazonaws.com/gndx.dev/medpet-video.mp4";
        caption = "¡Esto es una video!";
        type = "video";
        break;
      case "audio":
        mediaUrl = "https://s3.amazonaws.com/gndx.dev/medpet-audio.aac";
        caption = "Bienvenida";
        type = "audio";
        break;
      case "pdf":
        mediaUrl = "https://s3.amazonaws.com/gndx.dev/medpet-file.pdf";
        caption = "¡Esto es un PDF!";
        type = "document";
        break;
      default:
    }

    await whatsappService.sendMediaMessage(to, type, mediaUrl, caption);
  }
  isGreeting(message) {
    const greetings = ["hola", "hello", "hi", "buenas tardes"];
    return greetings.includes(message);
  }

  getSenderName(senderInfo) {
    return senderInfo.profile?.name || senderInfo.wa_id || "";
  }

  getFirstName = (fullName) => {
    const nameParts = fullName.split(" ");
    return nameParts[0];
  };
  async sendWelcomeMessage(to, messageId, senderInfo) {
    const fullName = this.getSenderName(senderInfo);
    const firstName = this.getFirstName(fullName);
    const welcomeMessage = `Hola ${firstName}, Bienvenido a Resiliencia, Tu panaderia en línea. ¿En qué puedo ayudarte hoy?`;
    await whatsappService.sendMessage(to, welcomeMessage, messageId);
  }

  async sendWelcomeMenu(to) {
    const menuMessage = "Elige una Opción";
    const buttons = [
      {
        type: "reply",
        reply: { id: "opcion_1", title: "Agendar" },
      },
      {
        type: "reply",
        reply: { id: "opcion_2", title: "Consultar" },
      },
      {
        type: "reply",
        reply: { id: "opcion_3", title: "Ubicación" },
      },
    ];

    await whatsappService.sendInteractiveButtons(to, menuMessage, buttons);
  }

  completeAppointment(to) {
    const appointment = this.appointmentState[to];
    delete this.appointmentState[to];

    const userData = [
      to,
      appointment.name,
      appointment.petName,
      appointment.petType,
      appointment.reason,
      new Date().toISOString(),
    ];
    console.log(userData);
    return `Gracias por agendar tu cita.
    Resumen de tu cita:
    
    Nombre: ${appointment.name}
    Nombre de tu mascota: ${appointment.petName}
    Tipo de mascota: ${appointment.petType}
    Motivo de la consulta: ${appointment.reason}
    
    Nos pondremos en contacto contigo pronto, para confirmar la fecha y hora de tu cita.`;
  }

  async handleMenuOption(to, option) {
    let response = "";
    switch (option) {
      case "agendar":
        // await this.sendBuyBreadMenu(to);
        this.appointmentState[to] = { step: "name" };
        response = "Por favor ingresa tu nombre:";
        break;
      case "consultar":
        // await this.sendConsultMenu(to);
        response = "Realiza tu consulta";
        break;
      case "ubicación":
        // await this.sendLocation(to);
        response = "google maps ubicación";
        break;
      default:
        // await this.sendDefaultMessage(to);
        response =
          "Lo siento, no entendi tu selección, Por favor, elige una de las opciones del menú";
        break;
    }
    await whatsappService.sendMessage(to, response);
  }

  async handleAppointmentFlow(to, message) {
    const state = this.appointmentState[to];
    let response;

    switch (state.step) {
      case "name":
        state.name = message;
        state.step = "petName";
        response = "Gracias, Ahora, ¿Cuál es el nombre de tu Mascota?";
        break;
      case "petName":
        state.petName = message;
        state.step = "petType";
        response =
          "¿Qué tipo de mascota es? (por ejemplo: perro, gato, huron, etc.)";
        break;
      case "petType":
        state.petType = message;
        state.step = "reason";
        response = "¿Cuál es el motivo de la Consulta?";
        break;
      case "reason":
        state.reason = message;
        response = "Gracias por agendar tu cita.";
        break;
    }
    await whatsappService.sendMessage(to, response);
  }
}
export default new MessageHandler();
