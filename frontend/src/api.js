import axios from "axios";

const resolveApiBaseUrl = () => {
  return import.meta.env.VITE_API_URL || "http://localhost:5000";
};

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
});

export default api;
