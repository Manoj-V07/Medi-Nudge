import axios from "axios";

const resolveApiBaseUrl = () => {
  const baseUrl = import.meta.env.VITE_API_URL;

  if (!baseUrl) {
    throw new Error("VITE_API_URL is not configured. Set it in your environment file.");
  }

  return baseUrl;
};

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
});

export default api;
