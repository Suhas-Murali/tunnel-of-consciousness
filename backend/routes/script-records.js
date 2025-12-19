import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import Script from "../database/script.js";
import { requireAuth } from "../require-middleware.js";
import parseScript from "./parse-script.js";
import { generateEmotionData, generateEmotionDataOld } from "./emotion-data.js";

const router = express.Router();

router.post("/parse", async (req, res) => {
  const text = req.body.script;
  res.json({
    parsed: parseScript(text),
  });
});

router.get("/all", requireAuth, async (req, res) => {
  try {
    const scripts = await Script.find({ owner: req.user.id })
      .select("name createdAt updatedAt")
      .sort({ updatedAt: -1 });

    const formattedScripts = scripts.map((script) => ({
      id: script._id,
      title: script.name,
      createdAt: script.createdAt,
      updatedAt: script.updatedAt,
    }));

    res.json({
      scripts: formattedScripts,
    });
  } catch (error) {
    console.error("Failed to fetch scripts:", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching scripts." });
  }
});

router.get("/data/:name", requireAuth, async (req, res) => {
  try {
    const name = req.params.name;
    const userId = req.user.id;

    const script = await Script.findOne({ name: name, owner: userId }).select(
      "-owner"
    );

    if (!script) {
      return res.status(404).json({ error: "Script not found." });
    }

    res.json({
      script,
    });
  } catch (error) {
    console.error("Failed to fetch script:", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching the script." });
  }
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

    const documentToStore = {
      name: scriptObject.name,
      owner: userId,
      script: scriptObject.script,
      ...parsedData,
    };

    const finalScript = await Script.findOneAndUpdate(
      { name: scriptObject.name, owner: userId },
      documentToStore,
      {
        new: true,
        upsert: true,
      }
    );

    res.status(200).json({
      script: finalScript,
    });
  } catch (error) {
    console.error("Error generating or saving script:", error);
    res
      .status(500)
      .json({ error: "An error occurred while processing the script." });
  }
});

export default router;
