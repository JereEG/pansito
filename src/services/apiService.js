import axios from 'axios';
import config from "../config/env.js";
export const login = () => {
    window.open(`${config.API_BASE_URL}/auth`, '_blank'); // o '_self' si querés en la misma ventana
  };
  
  export const Auth = async () => {
    const response = await axios.get(`${config.API_BASE_URL}/auth`);
    return response.data.authUrl;
  };
  
export const agendarClase = async (evento) => {
    
    try {
      const response = await axios.post(
        `${config.API_BASE_URL}/api/agendar`,
        evento,
      );
      return response.data;
    } catch (error) {
      console.error("Error al agendar clase en la API:", error);
      throw error;
    }
  };
  

