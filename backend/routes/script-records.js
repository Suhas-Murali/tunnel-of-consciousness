import express from "express";
import Script from "../database/script.js";
import User from "../database/user.js";
import { requireAuth } from "../require-middleware.js";
import parseScript from "./parse-script.js";
import { generateEmotionData, generateEmotionDataOld } from "./emotion-data.js";

const router = express.Router();

const getScriptAsOwner = async (scriptId, userId, res) => {
  const script = await Script.findOne({ _id: scriptId, owner: userId });
  if (!script) {
    const exists = await Script.exists({ _id: scriptId });
    if (exists) {
      res.status(403).json({ error: "Access denied. You are not the owner." });
    } else {
      res.status(404).json({ error: "Script not found." });
    }
    return null;
  }
  return script;
};

// ==========================================
// 2. PARSING & GENERATION (Preserved)
// ==========================================

router.post("/parse", async (req, res) => {
  const text = req.body.script;
  res.json({ parsed: parseScript(text) });
});

router.post("/:version/generate", requireAuth, async (req, res) => {
  try {
    const { script: scriptObject } = req.body;
    const userId = req.user.id;
    const version = req.params.version;

    if (!scriptObject || !scriptObject.name) {
      return res
        .status(400)
        .json({ error: "Script object with a 'name' field is required." });
    }

    const parsedData =
      version == "v1"
        ? await generateEmotionDataOld(scriptObject)
        : await generateEmotionData(scriptObject);

    // Note: This upsert logic might need adjustment if you switch fully to IDs,
    // but we are keeping it as requested for now.
    const documentToStore = {
      name: scriptObject.name,
      owner: userId,
      script: scriptObject.script,
      ...parsedData,
    };

    const finalScript = await Script.findOneAndUpdate(
      { name: scriptObject.name, owner: userId },
      documentToStore,
      { new: true, upsert: true }
    );

    res.status(200).json({ script: finalScript });
  } catch (error) {
    console.error("Error generating script:", error);
    res
      .status(500)
      .json({ error: "An error occurred while processing the script." });
  }
});

// ==========================================
// 3. CRUD & MANAGEMENT ROUTES
// ==========================================

/**
 * CREATE a new script
 * POST /api/scripts
 */
router.post("/", requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name)
      return res.status(400).json({ error: "Script name is required." });

    const existing = await Script.findOne({ owner: req.user.id, name });
    if (existing) {
      return res
        .status(409)
        .json({ error: "You already have a script with this name." });
    }

    const newScript = new Script({
      name,
      owner: req.user.id,
      collaborators: [],
      data: null, // Allow Yjs to initialize this
    });

    await newScript.save();
    res.status(201).json({ script: newScript });
  } catch (error) {
    console.error("Create error:", error);
    res.status(500).json({ error: "Failed to create script." });
  }
});

/**
 * LIST all scripts (Owned + Shared)
 * GET /api/scripts/all
 */
router.get("/all", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Find scripts where I am owner OR I am in collaborators list
    const scripts = await Script.find({
      $or: [{ owner: userId }, { "collaborators.user": userId }],
    })
      .populate("owner", "username email") // Fetch owner details
      .select("name createdAt updatedAt owner collaborators")
      .sort({ updatedAt: -1 });

    const formattedScripts = scripts.map((script) => {
      const isOwner = script.owner._id.toString() === userId;

      // Determine my role
      let role = "owner";
      if (!isOwner) {
        const collab = script.collaborators.find(
          (c) => c.user.toString() === userId
        );
        role = collab ? collab.role : "viewer";
      }

      return {
        id: script._id,
        title: script.name,
        createdAt: script.createdAt,
        updatedAt: script.updatedAt,
        ownerName: script.owner.username,
        permission: role, // 'owner', 'editor', or 'viewer'
      };
    });

    res.json({ scripts: formattedScripts });
  } catch (error) {
    console.error("Fetch all error:", error);
    res.status(500).json({ error: "Failed to fetch scripts." });
  }
});

/**
 * GET Single Script Details
 * GET /api/scripts/:id
 */
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const script = await Script.findById(id)
      .populate("owner", "username email")
      .populate("collaborators.user", "username email");

    if (!script) return res.status(404).json({ error: "Script not found." });

    // Check Access
    const isOwner = script.owner._id.toString() === userId;
    const collaborator = script.collaborators.find(
      (c) => c.user._id.toString() === userId
    );

    if (!isOwner && !collaborator) {
      return res
        .status(403)
        .json({ error: "You do not have permission to view this script." });
    }

    // Return script with current user's role context
    res.json({
      script,
      role: isOwner ? "owner" : collaborator.role,
    });
  } catch (error) {
    console.error("Fetch single error:", error);
    res.status(500).json({ error: "Failed to fetch script." });
  }
});

/**
 * RENAME Script
 * PATCH /api/scripts/:id
 */
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "New name is required." });

    // Check ownership (Usually only owners can rename, or maybe editors)
    // Here we strictly enforce Owner Only for metadata changes
    const script = await getScriptAsOwner(req.params.id, req.user.id, res);
    if (!script) return; // Error handled in helper

    // Check uniqueness if name changed
    if (script.name !== name) {
      const duplicate = await Script.findOne({ owner: req.user.id, name });
      if (duplicate)
        return res.status(409).json({ error: "Name already taken." });
    }

    script.name = name;
    await script.save();

    res.json({ script });
  } catch (error) {
    console.error("Rename error:", error);
    res.status(500).json({ error: "Failed to rename script." });
  }
});

/**
 * DELETE Script
 * DELETE /api/scripts/:id
 */
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const script = await getScriptAsOwner(req.params.id, req.user.id, res);
    if (!script) return;

    await Script.deleteOne({ _id: script._id });
    res.json({ message: "Script deleted successfully." });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ error: "Failed to delete script." });
  }
});

// ==========================================
// 4. ACCESS CONTROL ROUTES
// ==========================================

/**
 * GIVE ACCESS (Share)
 * POST /api/scripts/:id/access
 * Body: { email: "user@example.com", role: "viewer" | "editor" }
 */
router.post("/:id/access", requireAuth, async (req, res) => {
  try {
    const { email, role } = req.body;
    if (!email || !["viewer", "editor"].includes(role)) {
      return res
        .status(400)
        .json({ error: "Valid email and role (viewer/editor) required." });
    }

    const script = await getScriptAsOwner(req.params.id, req.user.id, res);
    if (!script) return;

    // 1. Find User
    const targetUser = await User.findOne({ email });
    if (!targetUser)
      return res.status(404).json({ error: "User with this email not found." });

    // 2. Prevent sharing with self
    if (targetUser._id.toString() === req.user.id) {
      return res
        .status(400)
        .json({ error: "You cannot share a script with yourself." });
    }

    // 3. Check if already added
    const existingCollab = script.collaborators.find(
      (c) => c.user.toString() === targetUser._id.toString()
    );

    if (existingCollab) {
      return res
        .status(409)
        .json({ error: "User already has access. Update their role instead." });
    }

    // 4. Add User
    script.collaborators.push({ user: targetUser._id, role });
    await script.save();

    // Return the enriched user object for the frontend to display immediately
    res.json({
      message: "Access granted.",
      collaborator: {
        user: {
          _id: targetUser._id,
          username: targetUser.username,
          email: targetUser.email,
        },
        role,
      },
    });
  } catch (error) {
    console.error("Share error:", error);
    res.status(500).json({ error: "Failed to grant access." });
  }
});

/**
 * UPDATE ACCESS (Upgrade/Downgrade)
 * PATCH /api/scripts/:id/access/:userId
 * Body: { role: "viewer" | "editor" }
 */
router.patch("/:id/access/:userId", requireAuth, async (req, res) => {
  try {
    const { role } = req.body;
    const { userId } = req.params;

    if (!["viewer", "editor"].includes(role)) {
      return res
        .status(400)
        .json({ error: "Role must be 'viewer' or 'editor'." });
    }

    const script = await getScriptAsOwner(req.params.id, req.user.id, res);
    if (!script) return;

    const collabIndex = script.collaborators.findIndex(
      (c) => c.user.toString() === userId
    );
    if (collabIndex === -1) {
      return res.status(404).json({ error: "Collaborator not found." });
    }

    script.collaborators[collabIndex].role = role;
    await script.save();

    res.json({ message: "Permissions updated." });
  } catch (error) {
    console.error("Update permissions error:", error);
    res.status(500).json({ error: "Failed to update permissions." });
  }
});

/**
 * REVOKE ACCESS (Remove User)
 * DELETE /api/scripts/:id/access/:userId
 */
router.delete("/:id/access/:userId", requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    const script = await Script.findById(req.params.id);
    if (!script) return res.status(404).json({ error: "Script not found." });

    const isOwner = script.owner.toString() === currentUserId;
    const isRemovingSelf = userId === currentUserId;

    // Only Owner can remove others. Collaborators can only remove themselves (leave).
    if (!isOwner && !isRemovingSelf) {
      return res
        .status(403)
        .json({ error: "Only the owner can remove other collaborators." });
    }

    // Filter out the specific user
    const initialLength = script.collaborators.length;
    script.collaborators = script.collaborators.filter(
      (c) => c.user.toString() !== userId
    );

    if (script.collaborators.length === initialLength) {
      return res.status(404).json({ error: "User was not a collaborator." });
    }

    await script.save();
    res.json({
      message: isRemovingSelf ? "You have left the script." : "Access revoked.",
    });
  } catch (error) {
    console.error("Revoke access error:", error);
    res.status(500).json({ error: "Failed to revoke access." });
  }
});

/**
 * TRANSFER OWNERSHIP
 * POST /api/scripts/:id/transfer
 * Body: { newOwnerId: "..." }
 */
router.post("/:id/transfer", requireAuth, async (req, res) => {
  try {
    const { newOwnerId } = req.body;
    const currentUserId = req.user.id;

    if (!newOwnerId)
      return res.status(400).json({ error: "New owner ID required." });

    const script = await getScriptAsOwner(req.params.id, currentUserId, res);
    if (!script) return;

    // Validate new owner exists
    const newOwner = await User.findById(newOwnerId);
    if (!newOwner)
      return res.status(404).json({ error: "New owner user not found." });

    // Logic:
    // 1. Set New Owner
    // 2. Add Old Owner to collaborators list (optional, but polite) as Editor
    // 3. Remove New Owner from collaborators list if they were there

    // Remove new owner from collaborators if present
    script.collaborators = script.collaborators.filter(
      (c) => c.user.toString() !== newOwnerId
    );

    // Add old owner as editor
    script.collaborators.push({ user: currentUserId, role: "editor" });

    // Swap owner
    script.owner = newOwnerId;

    await script.save();

    res.json({
      message: `Ownership transferred to ${newOwner.username}. You are now an editor.`,
    });
  } catch (error) {
    console.error("Transfer ownership error:", error);
    res.status(500).json({ error: "Failed to transfer ownership." });
  }
});

export default router;
