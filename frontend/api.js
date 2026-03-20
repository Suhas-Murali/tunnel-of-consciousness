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
export const parseScript = (script) =>
	BackendAPI.post("/script/parse", { script });
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
const AI_API_URL =
	import.meta.env.VITE_AI_ANALYSIS_URL || "http://localhost:8000";

const createRequestId = (routeName) =>
	`toc-${routeName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const callAIService = async (routeName, routePath, payload) => {
	const requestId = createRequestId(routeName);
	const start = performance.now();

	console.info(`[AI API][${requestId}] -> ${routePath}`, {
		routeName,
		payloadSize: JSON.stringify(payload).length,
		aiBaseUrl: AI_API_URL,
	});

	try {
		const res = await fetch(`${AI_API_URL}${routePath}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-request-id": requestId,
			},
			body: JSON.stringify(payload),
		});

		const responseBody = await res.json();
		const elapsedMs = Math.round(performance.now() - start);
		const serviceRequestId = res.headers.get("x-request-id") || requestId;

		if (!res.ok) {
			console.error(`[AI API][${serviceRequestId}] <- ${routePath} failed`, {
				status: res.status,
				elapsedMs,
				responseBody,
			});
			return null;
		}

		console.info(`[AI API][${serviceRequestId}] <- ${routePath} success`, {
			status: res.status,
			elapsedMs,
		});

		return responseBody;
	} catch (e) {
		const elapsedMs = Math.round(performance.now() - start);
		console.error(`[AI API][${requestId}] <- ${routePath} exception`, {
			elapsedMs,
			error: e,
		});
		return null;
	}
};

export const analyzeSceneAI = async (id, text, sourceLanguage = "en") =>
	callAIService("analyze-scene", "/analyze_scene", {
		id,
		text,
		sourceLanguage,
	});

export const analyzeNetworkAI = async (interactions) =>
	callAIService("analyze-network", "/analyze_network", { interactions });

export const analyzeEmotionAI = async (text, sourceLanguage = "en") =>
	callAIService("analyze-emotion", "/analyze_emotion", {
		text,
		sourceLanguage,
	});

export const translateTextAI = async (
	text,
	sourceLanguage,
	targetLanguage = "en",
) =>
	callAIService("translate", "/translate", {
		text,
		sourceLanguage,
		targetLanguage,
	});
