import { response } from "express";
import whatsappService from "./whatsappService.js";
import appendToSheet from "./googleSheetsService.js";
import openAiService from "./openAiService.js";

const cleanPhoneNumber = (number) => {
  return number.length >= 3 ? number.slice(0, 2) + number.slice(3) : number;
};
class MessageHandler {
  constructor() {
    this.appointmentState = {};
    this.assistandState = {};
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
      } else if (this.assistandState[cleanPhoneNumber(message.from)]) {
        await this.handleAsistandFlow(
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
      // const option = message?.interactive?.button_reply?.title
      //   .toLowerCase()
      //   .trim();
        const option = message?.interactive?.button_reply?.id;
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
        reply: { id: "opcion_agendar", title: "Agendar" },
      },
      {
        type: "reply",
        reply: { id: "opcion_consultar", title: "Consultar" },
      },
      {
        type: "reply",
        reply: { id: "opcion_ubicacion", title: "Ubicación" },
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
    appendToSheet(userData);
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
      case "opcion_agendar":
        // await this.sendBuyBreadMenu(to);
        this.appointmentState[to] = { step: "name" };
        response = "Por favor ingresa tu nombre:";
        break;
      case "opcion_consultar":
        this.assistandState[to] = { step: "question" };
        response = "Realiza tu consulta";
        break;
      case "opcion_ubicacion":
        // await this.sendLocation(to);
        response = "google maps ubicación";
        break;
      case "emergencia":
        response =
          "Si esto es una emergencia, te invitamos a llamar a nuestra linea de atención";
        await this.sendContact(to);
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
        response = this.completeAppointment(to);
        break;
    }
    await whatsappService.sendMessage(to, response);
  }
  async handleAsistandFlow(to, message) {
    const state = this.assistandState[to];
    let response;

    const menuMessage = "¿La respuesta fue de tu ayuda?";
    const buttons = [
      {
        type: "reply",
        reply: { id: "opcion_si_gracias", title: "Sí, Gracias" },
      },
      {
        type: "reply",
        reply: { id: "opcion_hacer_otra_pregunta", title: "Hacer otra pregunta" },
      },
      {
        type: "reply",
        reply: { id: "opcion_emergencia", title: "Emergencia" },
      },
    ];

    if (state.step === "question") {
      response = await openAiService(message);
    }
    delete this.assistandState[to];
    await whatsappService.sendMessage(to, response);
    await whatsappService.sendInteractiveButtons(to, menuMessage, buttons);
  }
  async sendContact(to) {
    const contact = {
      addresses: [
        {
          street: "123 Calle de las Mascotas",
          city: "Ciudad",
          state: "Estado",
          zip: "12345",
          country: "País",
          country_code: "PA",
          type: "WORK",
        },
      ],
      emails: [
        {
          email: "contacto@medpet.com",
          type: "WORK",
        },
      ],
      name: {
        formatted_name: "MedPet Contacto",
        first_name: "MedPet",
        last_name: "Contacto",
        middle_name: "",
        suffix: "",
        prefix: "",
      },
      org: {
        company: "MedPet",
        department: "Atención al Cliente",
        title: "Representante",
      },
      phones: [
        {
          phone: "+1234567890",
          wa_id: "1234567890",
          type: "WORK",
        },
      ],
      urls: [
        {
          url: "https://www.medpet.com",
          type: "WORK",
        },
      ],
    };

    await whatsappService.sendContactMessage(to, contact);
  }
}
export default new MessageHandler();
