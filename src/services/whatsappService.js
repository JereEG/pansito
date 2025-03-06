import sendToWhatsapp from "./httpRequest/sendToWhatsapp.js";
class WhatsAppService {
  async sendMessage(to, body, messageId) {
   const data = {
      messaging_product: "whatsapp",
      to,
      text: {
        body,
      },
    }

    await sendToWhatsapp(data);
  }

  async markAsRead(messageId) {
    const data = {
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    };

    await sendToWhatsapp(data);
  }
  async sendInteractiveButtons(to, BodyText, buttons) {
   const data ={
          messaging_product: "whatsapp",
          to,
          type: "interactive",
          interactive: {
            type: "button",
            body: { text: BodyText },
            action: {
              buttons: buttons,
            },
          },
        };
    await sendToWhatsapp(data);
  }
  async sendMediaMessage(to, type, mediaUrl, caption) {
    const mediaObject = {};

    switch (type) {
      case "image":
        mediaObject.image = { link: mediaUrl, caption: caption };
        break;
      case "audio":
        mediaObject.audio = { link: mediaUrl };
        break;
      case "video":
        mediaObject.video = { link: mediaUrl, caption: caption };
        break;
      case "document":
        mediaObject.document = {
          link: mediaUrl,
          caption: caption,
          filename: "medpet.pdf",
        };
        break;
      default:
        throw new Error("Not Soported Media Type");
    }
    const data = {
          messaging_product: "whatsapp",
          to,
          type: type,
          ...mediaObject,
        };
    await sendToWhatsapp(data);
  }
  async sendContactMessage(to, contact) {
    const data= {
          messaging_product: "whatsapp",
          to,
          type: "contacts",
          contacts: [contact],
        };
    await sendToWhatsapp(data);
  }
  async sendLocationMessage(to, latitud, longitud, name, address) {
    const data= {
          messaging_product: "whatsapp",
          to,
          type: 'location',
          location: {
            latitude: latitud,
            longitude: longitud,
            name: name,
            address: address,
          },
      };
   await sendToWhatsapp(data);
  }
}
export default new WhatsAppService();