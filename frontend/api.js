import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || "http://localhost:5050",
  withCredentials: true,
});

export const getProfile = () => API.get("/user/profile");
export const register = (username, password, email) =>
  API.post("/user/register", { username, password, email });
export const updateUser = (details) => API.post("/user/update", details);
export const login = (email, password) =>
  API.post("/user/login", { email, password });
export const logout = () => API.get("/user/logout");

export const parseScript = (script) => API.post("/script/parse", { script });
export const allScripts = () => API.get("/script/all");
export const generateEmotionData = (name, script) =>
  API.post("/script/v2/generate", { script: { name, ...script } });
export const getScriptData = (name) => API.get(`/script/data/${name}`);
