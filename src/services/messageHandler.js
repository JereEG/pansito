import { response } from "express";
import whatsappService from "./whatsappService.js";
import appendToSheet from "./googleSheetsService.js";
import appendToCalendar from "./googleCalendarService.js";
import openAiService from "./openAiService.js";

const cleanPhoneNumber = (number) => {
  return number.length >= 3 ? number.slice(0, 2) + number.slice(3) : number;
};
// Mapeo de días para calcular la próxima ocurrencia (domingo = 0, lunes = 1, etc.)
const dayMap = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miércoles: 3,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sábado: 6,
  sabado: 6,
};

class MessageHandler {
  constructor() {
    this.appointmentState = {};
    this.assistandState = {};
    this.horarioAgendado = {};
  }

  async handleIncomingMessage(message, senderInfo) {
    const mediaKeywords = ["media", "imagen", "video", "audio", "pdf"];

    if (message?.type === "text") { //Se recibio un mensaje de texto
      const incomingMessage = message.text.body.toLowerCase().trim();

      if (this.isGreeting(incomingMessage)) { //En el mensaje se recibio un saludo
        //mensaje de bienvenida
        await this.sendWelcomeMessage(
          cleanPhoneNumber(message.from),
          message.id,
          senderInfo
        );
        //menu de opciones
        await this.sendWelcomeMenu(cleanPhoneNumber(message.from));
      } else if (mediaKeywords.includes(incomingMessage.toLowerCase().trim())) { //prueba de mensaje de tipo media
        await this.sendMedia(
          cleanPhoneNumber(message.from),
          incomingMessage.toLowerCase().trim()
        );
      } else if (this.horarioAgendado[cleanPhoneNumber(message.from)]) { //camino de agendar cit
        // await this.handleAppointmentFlow(
        //   cleanPhoneNumber(message.from),
        //   incomingMessage
        // );
        await this.nuevoHorario(
          cleanPhoneNumber(message.from),
          incomingMessage
        );
      } else if (this.assistandState[cleanPhoneNumber(message.from)]) {
        //camino de consulta
        await this.handleAsistandFlow(
          cleanPhoneNumber(message.from),
          incomingMessage
        );
      } else { //camino de opciones
        await this.handleMenuOption(
          cleanPhoneNumber(message.from),
          incomingMessage
        );
      }
      await whatsappService.markAsRead(message.id);
    } else if (message?.type === "interactive") { // el mensaje no es de tipo texto
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
        reply: { id: "opcion_consultar", title: "Editar" },
      },
      {
        type: "reply",
        reply: { id: "opcion_ubicacion", title: "Eliminar" },
      },
    ];

    await whatsappService.sendInteractiveButtons(to, menuMessage, buttons);
  }

  // async completeAppointment(to) {
  //   const state = this.appointmentState[to];
  //   delete this.appointmentState[to]; // Limpia el estado una vez usado

  //   const event = {
  //     summary: state.title,
  //     start: {
  //       dateTime: `${state.startTime}:00-03:00`,
  //       timeZone: "America/Argentina/Buenos_Aires",
  //     },
  //     end: {
  //       dateTime: `${state.endTime}:00-03:00`,
  //       timeZone: "America/Argentina/Buenos_Aires",
  //     },
  //     reminders: {
  //       useDefault: false,
  //       overrides: [
  //         {
  //           method: "popup",
  //           minutes: state.reminderMinutes,
  //         },
  //       ],
  //     },
  //   };

  //   try {
  //     await appendToCalendar(event);
  //     return `✅ Clase agendada con éxito en Google Calendar.\n\n🗓️ Detalles:\n📌 Título: ${state.title}\n🕒 Desde: ${state.startTime}\n🕔 Hasta: ${state.endTime}\n⏰ Recordatorio: ${state.reminderMinutes} minutos antes.`;
  //   } catch (err) {
  //     console.error("Error al insertar evento:", err);
  //     return "❌ Hubo un error al agendar la clase. Por favor, intentá más tarde.";
  //   }
  // }


  async handleMenuOption(to, option) {
    let response = "";
    switch (option) {
      case "opcion_agendar":
        // await this.sendBuyBreadMenu(to);
        this.horarioAgendado[to] = { step: "startTime" };
        response = "¿Cuándo comienza la clase? (ej: lunes 14:00)";
        break;
      case "opcion_consultar":
        this.assistandState[to] = { step: "question" };
        response = "Realiza tu consulta";
        break;
      case "opcion_ubicacion":
        await this.sendLocation(to);
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

  // async handleAppointmentFlow(to, message) {
  //   const state = this.appointmentState[to];
  //   let response;

  //   switch (state.step) {
  //     case "name":
  //       state.name = message;
  //       state.step = "petName";
  //       response = "Gracias, Ahora, ¿Cuál es el nombre de tu Mascota?";
  //       break;
  //     case "petName":
  //       state.petName = message;
  //       state.step = "petType";
  //       response =
  //         "¿Qué tipo de mascota es? (por ejemplo: perro, gato, huron, etc.)";
  //       break;
  //     case "petType":
  //       state.petType = message;
  //       state.step = "reason";
  //       response = "¿Cuál es el motivo de la Consulta?";
  //       console.log("1Motivo de consulta recibido:", state.step);
  //       break;
  //     case "reason":
  //       console.log("2Motivo de consulta recibido:", state.step);
  //       state.step = message;
  //       console.log("3Motivo de consulta recibido:", state.reason);
  //       console.log("4Motivo de consulta recibido:", state.step);

  //       response = this.completeAppointment(to);
  //       break;
  //   }
  //   await whatsappService.sendMessage(to, response);
  // }
  getNextDateForDay(dayName, hour, minute) {
    const today = new Date();
    const year = today.getFullYear();
    const startDate = new Date(`${year}-03-01T00:00:00`);

    const targetDay = dayMap[dayName.toLowerCase()];
    const startDay = startDate.getDay();
    const diff = (targetDay - startDay + 7) % 7;

    const firstOccurrence = new Date(startDate);
    firstOccurrence.setDate(startDate.getDate() + diff);
    firstOccurrence.setHours(hour, minute, 0, 0);

    return firstOccurrence;
  }
  /**
   * Función que registra definitivamente el evento en Google Calendar.
   * Utiliza el estado almacenado en this.appointmentState[to].
   */
  async agendarHorario(to) {
    // Obtenemos y limpiamos el estado final
    const state = this.horarioAgendado[to];
    delete this.horarioAgendado[to];

    const event = {
      summary: state.title,
      start: {
        dateTime: state.startTime,
        timeZone: "America/Argentina/Buenos_Aires",
      },
      end: {
        dateTime: state.endTime,
        timeZone: "America/Argentina/Buenos_Aires",
      },
      recurrence: [`RRULE:FREQ=WEEKLY;UNTIL=20240630T235900Z`],
      reminders: {
        useDefault: false,
        overrides: [
          {
            method: "popup",
            minutes: state.reminderMinutes,
          },
        ],
      },
    };

    try {
      await appendToCalendar(event);
      return `✅ Clase agendada con éxito en Google Calendar.\n\n🗓️ Detalles:\n📌 Título: ${state.title}\n🕒 Desde: ${state.startTime}\n🕔 Hasta: ${state.endTime}\n⏰ Recordatorio: ${state.reminderMinutes} minutos antes.`;
    } catch (err) {
      console.error("Error al insertar evento:", err);
      return "❌ Hubo un error al agendar la clase. Por favor, intentá más tarde.";
    }
  }
  /**
   * Función para ir recolectando los datos de la clase a agendar.
   * Una vez ingresados todos los datos, transfiere el estado a agendarHorario.
   */
  async nuevoHorario(to, message) {
    // Utilizamos this.horarioAgendado para recolectar los datos
    const state = this.horarioAgendado[to] || { step: "startTime" };
    let response;
    switch (state.step) {
      case "startTime":
        // Se espera el formato "díaHora" (ej: "lunes 14:00")
        const [diaSemana, horaInicio] = message.toLowerCase().split(" ");
        const [hInicio, mInicio] = horaInicio.split(":").map(Number);
        state.startDay = diaSemana;
        state.startHour = hInicio;
        state.startMinute = mInicio;
        state.step = "endTime";
        response = "¿A qué hora termina la clase? (ej: 15:00)";
        break;

      case "endTime":
        // Se espera solo la hora de fin, ej "15:00"
        const [hFin, mFin] = message.split(":").map(Number);
        state.endHour = hFin;
        state.endMinute = mFin;
        state.step = "reminderMinutes";
        response = "¿Con cuántos minutos de antelación deseas el recordatorio?";
        break;

      case "reminderMinutes":
        state.reminderMinutes = parseInt(message, 10);
        state.step = "done";

        // Calcular la primera fecha de inicio y fin según el día de la semana ingresado
        const startDate = getNextDateForDay(
          state.startDay,
          state.startHour,
          state.startMinute
        );
        const endDate = getNextDateForDay(
          state.startDay,
          state.endHour,
          state.endMinute
        );

        // Actualizamos el estado para que agendarHorario trabaje con los formatos ISO
        state.startTime = startDate.toISOString();
        state.endTime = endDate.toISOString();

        // Transferimos el estado final a horarioAgendado para usarlo en agendarHorario
        this.horarioAgendado = this.horarioAgendado || {};
        this.horarioAgendado[to] = state;

        // Se llama a agendarHorario para registrar el evento
        response = await this.agendarHorario(to);
        // Limpiamos el estado de este flujo
        delete this.horarioAgendado[to];
        break;
    }

    this.horarioAgendado = this.horarioAgendado || {};
    this.horarioAgendado[to] = state;
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
        reply: {
          id: "opcion_hacer_otra_pregunta",
          title: "Hacer otra pregunta",
        },
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
  async sendLocation(to) {
    const latitud = 6.2071694;
    const longitud = -75.574607;
    const name = "Platzi Medellín";
    const address = "Cra. 43A #5A -113, El Poblado, Medellín, Antioquia";

    await whatsappService.sendLocationMessage(
      to,
      latitud,
      longitud,
      name,
      address
    );
  }
}
export default new MessageHandler();
