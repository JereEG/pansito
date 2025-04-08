import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001'; // Cambia esto por la URL real

export const login = () => {
    window.open(`${API_BASE_URL}/auth`, '_blank'); // o '_self' si querés en la misma ventana
  };
  
  export const Auth = async () => {
    const response = await axios.get(`${API_BASE_URL}/auth`);
    return response.data.authUrl;
  };
  
export const agendarClase = async (evento) => {
    
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/agendar`,
        evento,
      );
      return response.data;
    } catch (error) {
      console.error("Error al agendar clase en la API:", error);
      throw error;
    }
  };
  

