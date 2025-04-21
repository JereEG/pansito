import { google } from 'googleapis';
import { saveLastMessage } from './storageMessages.js';
import { getLastMessageFrom } from "./storageMessages.js"; // o ruta según donde esté
import { response } from 'express';
import whatsappService from './whatsappService.js';
import appendToSheet from './googleSheetsService.js';
import {
  Auth, 
  agendarClase as appendToCalendar  // Renamed to match your usage
} from './apiService.js';
import openAiService from './openAiService.js';
import {
  listarEventosPorUsuario,
  eliminarEventosPorTitulo,
} from "./googleCalendarService.js";
import { validate } from 'tough-cookie/dist/validators.js';

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
function parsearFechaHora(input) {
  console.log("🔍 Input recibido:", JSON.stringify(input));

  const dias = {
    lunes: 1,
    martes: 2,
    miércoles: 3,
    miercoles: 3,
    jueves: 4,
    viernes: 5,
    sábado: 6,
    sabado: 6,
    domingo: 0,
  };

  const partes = input.trim().toLowerCase().split(/\s+/);

  console.log("🧩 Partes:", partes);

  if (partes.length !== 2) {
    throw new Error("Formato incorrecto. Por favor usa: 'día hora' (ej: lunes 14:00)");
  }

  const [diaStr, hora] = partes;
  const diaTarget = dias[diaStr];

  const horaRegex = /^([01]?\d|2[0-3]):[0-5]\d$/;

  if (diaTarget === undefined || !horaRegex.test(hora)) {
    throw new Error("Formato incorrecto. Por favor usa: 'día hora' (ej: lunes 14:00)");
  }

  const hoy = new Date();
  const hoyDia = hoy.getDay();
  let diferencia = diaTarget - hoyDia;
  if (diferencia <= 0) diferencia += 7;

  const fechaObjetivo = new Date(hoy);
  fechaObjetivo.setDate(hoy.getDate() + diferencia);

  const año = fechaObjetivo.getFullYear();
  const mes = String(fechaObjetivo.getMonth() + 1).padStart(2, '0');
  const dia = String(fechaObjetivo.getDate()).padStart(2, '0');

  return {
    fecha: `${año}-${mes}-${dia}`,
    hora
  };
}
// Función auxiliar para formatear fechas y horas
function formatDateTime(isoString) {
  if (!isoString) return "Fecha no disponible";
  
  const date = new Date(isoString);
  return date.toLocaleString('es-AR', { 
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

class MessageHandler {
  constructor() {
    //Memoria de trabajo
    this.appointmentState = {};
    this.assistandState = {};
    this.horarioAgendado = {};
    this.eventHandlers = {};
    this.awaitingResponses = {}; // nuevo
     this.deleteEventState = {};
  }

  async handleIncomingMessage(message, senderInfo) {
    const mediaKeywords = ["media", "imagen", "video", "audio", "pdf"];

    if (message?.type === "text") { //Se recibio un mensaje de texto
      const incomingMessage = message.text.body.toLowerCase().trim();
      const userPhone = cleanPhoneNumber(message.from);

// Si está esperando una respuesta del usuario (por ejemplo, "listo"

      if (this.isGreeting(incomingMessage)) { //En el mensaje se recibio un saludo
        //mensaje de bienvenida
        await this.sendWelcomeMessage(
          cleanPhoneNumber(message.from),
          message.id,
          senderInfo
        );
        //menu de opciones
        await this.sendWelcomeMenu(cleanPhoneNumber(message.from));
      } 
      // else if (mediaKeywords.includes(incomingMessage.toLowerCase().trim())) { //prueba de mensaje de tipo media
      //   await this.sendMedia(
      //     cleanPhoneNumber(message.from),
      //     incomingMessage.toLowerCase().trim()
      //   );
      // } 
      else if (this.horarioAgendado[cleanPhoneNumber(message.from)]) { //camino de agendar cit
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
      } else if (this.deleteEventState[cleanPhoneNumber(message.from)]) {
        // Nuevo: camino de eliminar eventos
        await this.handleDeleteEventFlow(
          cleanPhoneNumber(message.from),
          incomingMessage
        );
      } else if (this.awaitingResponses[cleanPhoneNumber(message.from)]) {
        const callback = this.awaitingResponses[userPhone];

        // Limpiamos la espera para que no se dispare dos veces
        delete this.awaitingResponses[userPhone];

        // Ejecutamos la función que esperaba esta respuesta
        await callback(incomingMessage);
        await whatsappService.markAsRead(message.id);
        return; // no seguir con el flujo normal
      } else {
        //camino de opciones
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
    const from = message.from;
    const body = message.text?.body || "";

    // Guarda el último mensaje del usuario
    saveLastMessage(from, body);
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
    const welcomeMessage = `Hola ${firstName}, Bienvenido a botsito, Tu agenda en línea. ¿En qué puedo ayudarte hoy?`;
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
        reply: { id: "opcion_eliminar", title: "Eliminar" },
      },
    ];

    await whatsappService.sendInteractiveButtons(to, menuMessage, buttons);
  }


  /**
   * Función que registra definitivamente el evento en Google Calendar.
   * Utiliza el estado almacenado en this.appointmentState[to].
   */
  
  async agendarHorario(to) {
    // Obtenemos y limpiamos el estado final
    const state = this.horarioAgendado[to];
    delete this.horarioAgendado[to];

    
  const evento = {
    gmail:state.gmail,
    titulo: state.title,
    fecha: state.startTime.split("T")[0],
    hora: state.startTime.split("T")[1],
    horaFinal: state.endTime.split("T")[1],
  };

    try {
      await appendToCalendar(evento);
      return `✅ Clase agendada con éxito en Google Calendar.\n\n🗓️ Detalles:\n📌 Título: ${state.title}\n🕒 Desde: ${state.startTime}\n🕔 Hasta: ${state.endTime}\n⏰ Recordatorio: ${state.reminderMinutes} minutos antes.`;
    } catch (err) {
      console.error("Error al insertar evento:", err);
      return "❌  un error al agendar la clase. Por favor, intentá más tarde.";
    }
  }
  /**
   * Función para ir recolectando los datos de la clase a agendar.
   * Una vez ingresados todos los datos, transfiere el estado a agendarHorario.
   */
  // Dentro de la clase MessageHandler
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
  
  async nuevoHorario(to, message) {
    // Utilizamos this.horarioAgendado para recolectar los datos
    const state = this.horarioAgendado[to] || { step: "startTime" };
    let response;
    switch (state.step) {
      case "startTime":
    const partes = message.toLowerCase().trim().split(" ");

    if (partes.length !== 2) {
      response = "Por favor ingresá el día y la hora en el formato correcto (ej: lunes 14:00)";
      break;
    }

    const [diaSemana, horaInicio] = partes;

    if (!horaInicio.includes(":")) {
      response = "La hora debe incluir los dos puntos, por ejemplo: lunes 14:00";
      break;
    }

    const [hInicioStr, mInicioStr] = horaInicio.split(":");
    const hInicio = parseInt(hInicioStr, 10);
    const mInicio = parseInt(mInicioStr, 10);

    if (
      isNaN(hInicio) || isNaN(mInicio) ||
      hInicio < 0 || hInicio > 23 ||
      mInicio < 0 || mInicio > 59
    ) {
      response = "La hora no es válida. Asegurate de usar el formato HH:MM con valores válidos.";
      break;
    }

    // Si todo está bien, guardamos y pasamos al siguiente paso
    state.startDay = diaSemana;
    state.startHour = hInicio;
    state.startMinute = mInicio;
    state.step = "endTime";
    response = "¿A qué hora termina la clase? (ej: 15:00)";
    break;


      case "endTime":
        // Se espera solo la hora de fin, ej "15:00"
        const horaFin = message.trim();

        if (!horaFin.includes(":")) {
          response = "La hora debe incluir los dos puntos, por ejemplo: 17:00";
          break;
        }
      
        const [hFinStr, mFinStr] = horaFin.split(":");
        const hFin = parseInt(hFinStr, 10);
        const mFin = parseInt(mFinStr, 10);
      
        if (
          isNaN(hFin) || isNaN(mFin) ||
          hFin < 0 || hFin > 23 ||
          mFin < 0 || mFin > 59
        ) {
          response = "La hora no es válida. Asegurate de usar un formato HH:MM correcto.";
          break;
        }
        state.endHour = hFin;
        state.endMinute = mFin;
        state.step = "title";
        response = "¿Nombre de la materia ?";
        break;

      case "title":
        state.title = message;
        
        state.step = "gmail";
        response = "Envie su gmail por favor";
      case "gmail":

        const email = message.trim();

  // Expresión regular básica para validar emails
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    response = "Por favor ingresá un correo electrónico válido (ej: ejemplo@gmail.com)";
    break;
  }

  state.gmail = email;
  state.step = "done";
        // Calcular la primera fecha de inicio y fin según el día de la semana ingresado
        const startDate = this.getNextDateForDay(
          state.startDay,
          state.startHour,
          state.startMinute
        );
        const endDate = this.getNextDateForDay(
          state.startDay,
          state.endHour,
          state.endMinute
        );

        // Actualizamos el estado para que agendarHorario trabaje con los formatos ISO
        state.startTime = startDate.toISOString();
        state.endTime = endDate.toISOString();

        // Se llama a agendarHorario para registrar el evento
        response = await this.agendarHorario(to);

        break;
    }
    // Guardamos el estado actualizado
    this.horarioAgendado[to] = state;
    await whatsappService.sendMessage(to, response);
  }

  waitForUserResponse(to, timeout) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), timeout);
      
      const messageHandler = (msg) => {
        if (msg.from === to) {
          clearTimeout(timer);
          this.removeListener('message', messageHandler);
          resolve(msg.body);
        }
      };
      
      this.on('message', messageHandler);
    });
  }
  on(eventName, callback) {
    this.eventHandlers[eventName] = callback;
  }

async handleMenuOption(to, option) {
  let response = "";
  switch (option) {
    case "opcion_agendar":
      this.horarioAgendado[to] = { step: "startTime" };
      response = "¿Cuándo comienza la clase? (ej: lunes 14:00)";
      break;
    case "opcion_consultar":
      this.assistandState[to] = { step: "question" };
      response =
        "Escribe tu correo para realizar la consulta (ej: fulanito@gmail.com)";
      break;
    case "listo":
      break;
    case "opcion_eliminar":
      this.deleteEventState[to] = { step: "gmail" };
      response = "Para eliminar un evento, primero necesito tu correo Gmail:";
      break;
    case "emergencia":
      response =
        "Si esto es una emergencia, llamá a nuestra línea de atención.";
      await this.sendContact(to);
      break;
    default:
      response =
        "Lo siento, no entendí tu selección. Por favor, elegí una opción del menú.";
      break;
  }
  await whatsappService.sendMessage(to, response);
}

  async handleAsistandFlow(to, message) {
    const state = this.assistandState[to];
    let response;
    if (state.step === "question") {
      const respuesta = await listarEventosPorUsuario(message);

      if (respuesta.success) {
        if (respuesta.eventos.length === 0) {
          response = "No tenés eventos próximos.";
        } else {
          const mensajeEventos = respuesta.eventos.join("\n");
          response = `Tus próximos eventos:\n${mensajeEventos}`;
        }
      } else {
        response = "Error: " + respuesta.error;
      }
    }
    delete this.assistandState[to];
    await whatsappService.sendMessage(to, response);
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
  async handleDeleteEventFlow(to, message) {
  const state = this.deleteEventState[to];
  let response;

  switch (state.step) {
    case "gmail":
      // Guardamos el correo del usuario
      state.gmail = message.trim();
      state.step = "title";
      response = "Ahora, escribe el título exacto del evento que deseas eliminar:";
      break;

    case "title":
      // Eliminamos los eventos con el título proporcionado
      const titulo = message.trim();
      try {
        const resultado = await eliminarEventosPorTitulo(state.gmail, titulo);
        
        if (resultado.success) {
          if (resultado.eventosEliminados.length > 0) {
            const eventosText = resultado.eventosEliminados.map(e => 
              `• ${e.titulo} (${formatDateTime(e.inicio)})`
            ).join('\n');
            
            response = `✅ Se eliminaron ${resultado.eventosEliminados.length} eventos:\n${eventosText}`;
          } else {
            response = resultado.mensaje;
          }
          
          // Si hay errores, los añadimos al mensaje
          if (resultado.errores && resultado.errores.length > 0) {
            response += `\n\n⚠️ Hubo ${resultado.errores.length} errores al eliminar algunos eventos.`;
          }
        } else {
          response = `❌ ${resultado.error}`;
          
          // Si el token expiró y tenemos una URL de autenticación, podríamos
          // ofrecer al usuario volver a autenticarse (lógica adicional necesaria)
          if (resultado.authUrl) {
            response += "\n\nNecesitas volver a autenticarte para continuar.";
            // Aquí podríamos implementar un flujo de reautenticación si es necesario
          }
        }
      } catch (error) {
        console.error("Error en flujo de eliminación:", error);
        response = "❌ Ocurrió un error al intentar eliminar los eventos. Por favor, inténtalo de nuevo más tarde.";
      }
      
      // Limpiamos el estado cuando terminamos
      delete this.deleteEventState[to];
      
      // Volvemos a mostrar el menú principal después de la eliminación
      await whatsappService.sendMessage(to, response);
      
      const menuMessage = "¿Necesitas algo más?";
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
          reply: { id: "opcion_ubicacion", title: "Eliminar" },
        },
      ];
      
      await whatsappService.sendInteractiveButtons(to, menuMessage, buttons);
      return;
  }

  await whatsappService.sendMessage(to, response);
}



  
}
export default new MessageHandler();
