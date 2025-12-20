import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || "http://localhost:5050",
  withCredentials: true,
});

// ==============================
// AUTHENTICATION
// ==============================
export const getProfile = () => API.get("/user/profile");
export const register = (username, password, email) =>
  API.post("/user/register", { username, password, email });
export const updateUser = (details) => API.post("/user/update", details);
export const login = (email, password) =>
  API.post("/user/login", { email, password });
export const logout = () => API.get("/user/logout");

// ==============================
// SCRIPT PARSING & GENERATION
// ==============================
export const parseScript = (script) => API.post("/script/parse", { script });
export const generateEmotionData = (name, script) =>
  API.post("/script/v2/generate", { script: { name, ...script } });

// ==============================
// SCRIPT MANAGEMENT (NEW)
// ==============================

/**
 * Creates a new empty script
 * @param {string} name - The name of the script
 */
export const createScript = (name) => API.post("/script", { name });

/**
 * Gets a list of all scripts (Owned + Shared)
 * Returns { scripts: [ { id, title, permission, ownerName ... } ] }
 */
export const allScripts = () => API.get("/script/all");

/**
 * Gets a single script by ID (Includes role/permission info)
 * Use this for loading the editor
 */
export const getScriptById = (id) => API.get(`/script/${id}`);

/**
 * Renames a script
 */
export const renameScript = (id, newName) =>
  API.patch(`/script/${id}`, { name: newName });

/**
 * Deletes a script permanently
 */
export const deleteScript = (id) => API.delete(`/script/${id}`);

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
  API.post(`/script/${id}/access`, { email, role });

/**
 * Update an existing collaborator's permission
 * @param {string} id - Script ID
 * @param {string} userId - The _id of the user to update
 * @param {string} role - 'viewer' or 'editor'
 */
export const updateScriptPermission = (id, userId, role) =>
  API.patch(`/script/${id}/access/${userId}`, { role });

/**
 * Remove a collaborator (or leave script if self)
 * @param {string} id - Script ID
 * @param {string} userId - The _id of the user to remove
 */
export const removeCollaborator = (id, userId) =>
  API.delete(`/script/${id}/access/${userId}`);

/**
 * Transfer ownership of the script to another user
 * @param {string} id - Script ID
 * @param {string} newOwnerId - The _id of the new owner
 */
export const transferOwnership = (id, newOwnerId) =>
  API.post(`/script/${id}/transfer`, { newOwnerId });
