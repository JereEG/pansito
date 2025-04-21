import dotenv from "dotenv";

dotenv.config();

export default {
  WEBHOOK_VERIFY_TOKEN: process.env.WEBHOOK_VERIFY_TOKEN,
  API_TOKEN: process.env.API_TOKEN,
  BUSINESS_PHONE: process.env.BUSINESS_PHONE,
  API_VERSION: process.env.API_VERSION,
  PORT: process.env.PORT || 3000,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  BASE_URL: process.env.BASE_URL,
  API_BASE_URL: process.env.API_BASE_URL
};
