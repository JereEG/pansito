import axios from "axios";
import config from "../../config/env.js";

const sendToWhatsapp = async (data) => {
    const baseUrl = `${config.BASE_URL}/${config.API_VERSION}/${config.BUSINESS_PHONE}/messages`;
    const headers = {
        Authorization: `Bearer ${config.API_TOKEN}`,
    };
    try {   
        const response = await axios({
            method: "POST",
            url: baseUrl,
            headers,
            data,
        });
        return response.data;
    } catch (error) {
        console.error("Error sendToWhatsapp:", error);
    }
};

export default sendToWhatsapp;