import whatsappService from "./whatsappService.js";
const cleanPhoneNumber = (number) => {
  return number.length >= 3 ? number.slice(0, 2) + number.slice(3) : number;
};
class MessageHandler {
  async handleIncomingMessage(message) {
    if (message?.type === "text") {
      const response = `Echo: ${message.text.body}`;
      await whatsappService.sendMessage(
        cleanPhoneNumber(message.from),
        response,
        message.id
      );
      await whatsappService.markAsRead(message.id);
    }
  }
}

export default new MessageHandler();
