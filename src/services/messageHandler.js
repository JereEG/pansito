import whatsappService from "./whatsappService.js";
const cleanPhoneNumber = (number) => {
  return number.length >= 3 ? number.slice(0, 2) + number.slice(3) : number;
};
class MessageHandler {
  async handleIncomingMessage(message) {
    if (message?.type === "text") {
      const incomingMessage = message.text.body.toLowerCase().trim();

      if (this.isGreeting(incomingMessage)) {
        await this.sendWelcomeMessage(cleanPhoneNumber(message.from), message.id);
      } else {
        const response = `Echo: ${message.text.body}`;
        await whatsappService.sendMessage(
          cleanPhoneNumber(message.from),
          response,
          message.id
        );
      }
      await whatsappService.markAsRead(message.id);
    }
  }
  isGreeting(message) {
    const greetings = ["hola", "hello", "hi", "buenas tardes"];
    return greetings.includes(message);
  }

  async sendWelcomeMessage(to, messageId) {
    const welcomeMessage =
      "Hola, Bienvenido a nuestro servicio de Panaderia online." +
      "¿En Qué puedo ayudarte Hoy?";
    await whatsappService.sendMessage(to, welcomeMessage, messageId);
  }
}
export default new MessageHandler();
