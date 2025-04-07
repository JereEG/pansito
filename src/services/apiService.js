import axios from 'axios';

const API_BASE_URL = 'https://localhost:3000'; // Cambia esto por la URL real

const agendarClase = async (evento) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/agendar`, evento);
    return response.data;
  } catch (error) {
    console.error("Error al agendar clase en la API:", error);
    throw error;
  }
};

export default {
  agendarClase,
};