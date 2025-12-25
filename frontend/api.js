import axios from "axios";

const BackendAPI = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || "http://localhost:5050",
  withCredentials: true,
});

// ==============================
// AUTHENTICATION
// ==============================
export const getProfile = () => BackendAPI.get("/user/profile");
export const register = (username, password, email) =>
  BackendAPI.post("/user/register", { username, password, email });
export const updateUser = (details) => BackendAPI.post("/user/update", details);
export const login = (email, password) =>
  BackendAPI.post("/user/login", { email, password });
export const logout = () => BackendAPI.get("/user/logout");

// ==============================
// SCRIPT PARSING & GENERATION
// ==============================
export const parseScript = (script) => BackendAPI.post("/script/parse", { script });
export const generateEmotionData = (name, script) =>
  BackendAPI.post("/script/v2/generate", { script: { name, ...script } });

// ==============================
// SCRIPT MANAGEMENT (NEW)
// ==============================

/**
 * Creates a new empty script
 * @param {string} name - The name of the script
 */
export const createScript = (name) => BackendAPI.post("/script", { name });

/**
 * Gets a list of all scripts (Owned + Shared)
 * Returns { scripts: [ { id, title, permission, ownerName ... } ] }
 */
export const allScripts = () => BackendAPI.get("/script/all");

/**
 * Gets a single script by ID (Includes role/permission info)
 * Use this for loading the editor
 */
export const getScriptById = (id) => BackendAPI.get(`/script/${id}`);

/**
 * Renames a script
 */
export const renameScript = (id, newName) =>
  BackendAPI.patch(`/script/${id}`, { name: newName });

/**
 * Deletes a script permanently
 */
export const deleteScript = (id) => BackendAPI.delete(`/script/${id}`);

// ==============================
// ACCESS CONTROL & COLLABORATION
// ==============================

/**
 * Share script with a user via email
 * @param {string} id - Script ID
 * @param {string} email - User's email
 * @param {string} role - 'viewer' or 'editor'
 */
export const shareScript = (id, email, role) =>
  BackendAPI.post(`/script/${id}/access`, { email, role });

/**
 * Update an existing collaborator's permission
 * @param {string} id - Script ID
 * @param {string} userId - The _id of the user to update
 * @param {string} role - 'viewer' or 'editor'
 */
export const updateScriptPermission = (id, userId, role) =>
  BackendAPI.patch(`/script/${id}/access/${userId}`, { role });

/**
 * Remove a collaborator (or leave script if self)
 * @param {string} id - Script ID
 * @param {string} userId - The _id of the user to remove
 */
export const removeCollaborator = (id, userId) =>
  BackendAPI.delete(`/script/${id}/access/${userId}`);

/**
 * Transfer ownership of the script to another user
 * @param {string} id - Script ID
 * @param {string} newOwnerId - The _id of the new owner
 */
export const transferOwnership = (id, newOwnerId) =>
  BackendAPI.post(`/script/${id}/transfer`, { newOwnerId });



// api.js
const AI_API_URL = import.meta.env.VITE_AI_ANALYSIS_URL || "http://localhost:8000";

export const analyzeSceneAI = async (id, text) => {
  try {
    const res = await fetch(`${AI_API_URL}/analyze_scene`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, text }),
    });
    return await res.json();
  } catch (e) {
    console.error("AI Scene Analysis failed", e);
    return null;
  }
};

export const analyzeNetworkAI = async (interactions) => {
  try {
    const res = await fetch(`${AI_API_URL}/analyze_network`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interactions }),
    });
    return await res.json();
  } catch (e) {
    console.error("AI Network Analysis failed", e);
    return null;
  }
};

export const analyzeEmotionAI = async (text) => {
  try {
    const res = await fetch(`${AI_API_URL}/analyze_emotion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    return await res.json();
  } catch (e) {
    console.error("AI Emotion Analysis failed", e);
    return null;
  }
};
