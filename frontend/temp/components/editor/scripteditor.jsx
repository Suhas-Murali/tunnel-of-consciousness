import React, { useState, useEffect, useRef, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Button,
  Tag,
  Typography,
  Divider,
  Space,
  theme,
  Dropdown,
  Card,
} from "antd";
import {
  BoldOutlined,
  ItalicOutlined,
  UndoOutlined,
  RedoOutlined,
  HighlightOutlined,
  MenuFoldOutlined,
  SyncOutlined,
} from "@ant-design/icons";

// Tiptap Imports
import { StarterKit } from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import {
  useEditor,
  EditorContent,
  ReactNodeViewRenderer,
  NodeViewWrapper,
  NodeViewContent,
} from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import TiptapParagraph from "@tiptap/extension-paragraph";

// ==========================================
// 1. API HELPERS & UTILS
// ==========================================
const API_URL = "http://localhost:8000";

const analyzeSceneAI = async (id, text) => {
  try {
    return await (
      await fetch(`${API_URL}/analyze_scene`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, text }),
      })
    ).json();
  } catch (e) {
    return null;
  }
};

const analyzeNetworkAI = async (interactions) => {
  try {
    return await (
      await fetch(`${API_URL}/analyze_network`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interactions }),
      })
    ).json();
  } catch (e) {
    return null;
  }
};

const analyzeEmotionAI = async (text) => {
  try {
    return await (
      await fetch(`${API_URL}/analyze_emotion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })
    ).json();
  } catch (e) {
    return null;
  }
};

const stringToColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++)
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const c = (hash & 0x00ffffff).toString(16).toUpperCase();
  return "#" + "00000".substring(0, 6 - c.length) + c;
};

const pseudoRandom = (seed) => {
  let x = Math.sin(seed.length) * 10000;
  return x - Math.floor(x);
};

// ==========================================
// 2. LOCAL SCRIPT PARSER (SYNC LOGIC)
// ==========================================

const analyzeScriptLocal = (doc) => {
  if (!doc || !doc.content)
    return { scenes: [], characters: [], interactions: [] };

  const scenes = [];
  const characters = {};
  const interactions = [];

  let currentScene = {
    id: "start",
    name: "OPENING",
    type: "Action",
    lines: [],
    characters: new Set(),
    actionLines: 0,
    dialogueLines: 0,
    durationSecs: 0,
    rawText: "",
    synopsis: "",
    charLineCounts: {},
  };

  let currentCharacter = null;

  doc.content.forEach((node) => {
    const type = node.attrs?.scriptType || "action";
    const text = node.content ? node.content.map((c) => c.text).join("") : "";

    if (type !== "scene") currentScene.rawText += text + "\n";

    if (type === "scene") {
      if (scenes.length > 0 || currentScene.lines.length > 0) {
        currentScene.characters = Array.from(currentScene.characters);
        scenes.push(currentScene);
        interactions.push(currentScene.characters);
      }
      const isExt = text.toUpperCase().startsWith("EXT");
      currentScene = {
        id: `scene-${scenes.length + 1}`,
        name: text || "UNTITLED SCENE",
        type: isExt ? "Action" : "Dialogue",
        lines: [],
        characters: new Set(),
        actionLines: 0,
        dialogueLines: 0,
        durationSecs: 0,
        rawText: "",
        synopsis: "",
        charLineCounts: {},
      };
      currentCharacter = null;
    } else if (type === "character") {
      const cleanName = text
        .replace(/\(.*\)/, "")
        .trim()
        .toUpperCase();
      if (cleanName) {
        currentCharacter = cleanName;
        currentScene.characters.add(cleanName);
        if (!characters[cleanName]) {
          characters[cleanName] = {
            id: cleanName,
            name: cleanName,
            color: stringToColor(cleanName),
            dialogueCount: 0,
            rawLines: [],
            allDialogueText: "",
          };
        }
      }
    } else if (type === "dialogue" && currentCharacter) {
      if (text) {
        currentScene.dialogueLines++;
        currentScene.durationSecs += 3;

        currentScene.charLineCounts[currentCharacter] =
          (currentScene.charLineCounts[currentCharacter] || 0) + 1;

        const char = characters[currentCharacter];
        if (char) {
          char.dialogueCount++;
          char.allDialogueText += text + " ";
          char.rawLines.push({
            sceneId: currentScene.id,
            sceneName: currentScene.name,
            text: text,
          });
        }
        currentScene.lines.push({
          type: "dialogue",
          speaker: currentCharacter,
          text,
        });
      }
    } else if (type === "action") {
      if (text) {
        currentScene.actionLines++;
        currentScene.durationSecs += 2;
        if (!currentScene.synopsis) currentScene.synopsis = text;
        currentScene.lines.push({ type: "action", text });
      }
    }
  });

  currentScene.characters = Array.from(currentScene.characters);
  scenes.push(currentScene);
  interactions.push(currentScene.characters);

  // --- POST-PROCESS SCENES ---
  const finalScenes = scenes.map((s, index) => {
    const totalLines = s.actionLines + s.dialogueLines;
    const pacing =
      totalLines === 0 ? 0 : Math.round((s.dialogueLines / totalLines) * 100);

    const type = s.actionLines > s.dialogueLines ? "Action" : "Dialogue";

    let focusChar = null;
    let maxL = 0;
    for (const [char, count] of Object.entries(s.charLineCounts)) {
      if (count > maxL) {
        maxL = count;
        focusChar = char;
      }
    }

    let structuralBeat = null;
    const progress = index / Math.max(scenes.length, 1);
    if (index === 0) structuralBeat = "Inciting Incident";
    else if (progress > 0.9) structuralBeat = "Climax";
    else if (Math.abs(progress - 0.5) < 0.1) structuralBeat = "Midpoint";

    return {
      ...s,
      type,
      focusCharacter: focusChar,
      metrics: {
        pacing: pacing,
        linguisticDensity: Math.min(
          100,
          Math.round((s.rawText.length / Math.max(1, s.durationSecs)) * 2)
        ),
        actionRatio: Math.round(
          (s.actionLines / Math.max(1, totalLines)) * 100
        ),
        sentiment: 0,
        structuralBeat: structuralBeat,
      },
    };
  });

  // --- POST-PROCESS CHARACTERS ---
  const finalCharacters = Object.values(characters).map((c) => {
    const sceneMap = {};
    c.rawLines.forEach((line) => {
      if (!sceneMap[line.sceneId]) {
        sceneMap[line.sceneId] = {
          sceneId: line.sceneId,
          sceneName: line.sceneName,
          dialogueCount: 0,
          dialogues: [],
        };
      }
      sceneMap[line.sceneId].dialogueCount++;
      sceneMap[line.sceneId].dialogues.push(line.text);
    });

    const rand = pseudoRandom(c.name);
    const traits =
      rand > 0.5 ? ["Determined", "Leader"] : ["Loyal", "Calculating"];
    const archetype =
      c.dialogueCount > 50
        ? "The Protagonist"
        : c.dialogueCount > 20
        ? "The Lancer"
        : "Support";

    return {
      ...c,
      scenes: Object.values(sceneMap),
      role: c.dialogueCount > 50 ? "Major" : "Minor",
      archetype,
      traits,
      description: `Analysis indicates ${
        c.name
      } speaks with high agency. Appears in ${
        Object.keys(sceneMap).length
      } scenes.`,
      rawLines: undefined,
    };
  });

  return { scenes: finalScenes, characters: finalCharacters, interactions };
};

// ==========================================
// 3. STYLES & NODE VIEWS
// ==========================================

const getEditorStyles = (token) => `
  .ProseMirror { outline: none; min-height: 100%; padding: 60px 80px; font-family: 'Courier Prime', 'Courier New', monospace; color: ${token.colorText}; background-color: ${token.colorBgContainer}; counter-reset: line-counter; font-size: 16px; line-height: 1.2; }
  .script-block-wrapper { display: flex; align-items: baseline; position: relative; border-radius: 2px; counter-increment: line-counter; }
  .script-block-wrapper::before { content: counter(line-counter); position: absolute; left: -50px; width: 30px; text-align: right; color: ${token.colorTextQuaternary}; font-size: 10px; font-family: sans-serif; user-select: none; top: 2px; }
  .script-block-wrapper .type-chip { opacity: 0; transition: opacity 0.2s; cursor: pointer; margin-right: 15px; width: 20px; display: flex; justify-content: center; user-select: none; flex-shrink: 0; }
  .script-block-wrapper:hover .type-chip, .script-block-wrapper:focus-within .type-chip { opacity: 1; }
  .script-content { flex: 1; outline: none; }
  .script-block-wrapper.type-scene { margin-top: 2rem; margin-bottom: 1rem; border-bottom: 2px solid ${token.colorBorder}; padding-bottom: 5px; }
  .script-block-wrapper.type-scene .script-content { font-weight: 900; text-transform: uppercase; }
  .script-block-wrapper.type-character { margin-top: 1rem; }
  .script-block-wrapper.type-character .script-content { margin-left: 35%; width: 40%; font-weight: bold; text-transform: uppercase; }
  .script-block-wrapper.type-dialogue .script-content { margin-left: 10%; margin-right: 10%; width: 80%; border-left: 3px solid ${token.colorBorderSecondary}; padding-left: 15px; }
  .script-block-wrapper.type-parenthetical .script-content { margin-left: 30%; width: 40%; font-style: italic; color: ${token.colorTextSecondary}; }
  .script-block-wrapper.type-transition .script-content { text-align: right; margin-top: 1rem; margin-bottom: 1rem; font-weight: bold; text-transform: uppercase; }
  .script-content p.is-editor-empty:first-child::before { color: ${token.colorTextQuaternary}; content: attr(data-placeholder); float: left; height: 0; pointer-events: none; }
`;

const ScreenplayBlock = ({ node, updateAttributes }) => {
  const { scriptType, locked } = node.attrs;
  const config = {
    scene: { l: "S", c: "blue" },
    action: { l: "A", c: "default" },
    character: { l: "C", c: "gold" },
    dialogue: { l: "D", c: "cyan" },
    parenthetical: { l: "P", c: "purple" },
    transition: { l: "T", c: "orange" },
  }[scriptType] || { l: "A", c: "default" };

  const items = Object.keys({
    scene: 1,
    action: 1,
    character: 1,
    dialogue: 1,
    parenthetical: 1,
    transition: 1,
  }).map((k) => ({
    key: k,
    label: k.charAt(0).toUpperCase() + k.slice(1),
    onClick: () => updateAttributes({ scriptType: k, locked: true }),
  }));

  if (locked)
    items.push({
      key: "unlock",
      label: "Unlock",
      icon: <UndoOutlined />,
      onClick: () => updateAttributes({ locked: false }),
    });

  return (
    <NodeViewWrapper className={`script-block-wrapper type-${scriptType}`}>
      <div className="type-chip" contentEditable={false}>
        <Dropdown menu={{ items }} trigger={["click"]}>
          <span style={{ display: "inline-flex", cursor: "pointer" }}>
            <Tag
              color={locked ? "red" : config.c}
              style={{
                width: 24,
                height: 24,
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
              }}
            >
              {locked ? <HighlightOutlined /> : config.l}
            </Tag>
          </span>
        </Dropdown>
      </div>
      <NodeViewContent className="script-content" />
    </NodeViewWrapper>
  );
};

// ==========================================
// 4. EDITOR EXTENSION
// ==========================================

const PATTERNS = {
  SCENE: /^(INT|EXT|EST|I\/E|INT\/EXT)[\.\s]/i,
  TRANSITION: /^(FADE|CUT|DISSOLVE|SMASH|WIPE|TO:)$/i,
};

const ScreenplayExtension = TiptapParagraph.extend({
  priority: 1000,
  addAttributes() {
    return { scriptType: { default: "action" }, locked: { default: false } };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ScreenplayBlock);
  },
  addKeyboardShortcuts() {
    const setType = (type) => () =>
      this.editor.commands.updateAttributes("paragraph", {
        scriptType: type,
        locked: true,
      });
    return {
      "Mod-1": setType("scene"),
      "Mod-2": setType("action"),
      "Mod-3": setType("character"),
      "Mod-4": setType("dialogue"),
      "Mod-5": setType("parenthetical"),
      "Mod-6": setType("transition"),
      "Mod-Alt-0": () =>
        this.editor.commands.updateAttributes("paragraph", { locked: false }),
    };
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("screenplay-automator"),
        appendTransaction: (transactions, oldState, newState) => {
          if (!transactions.some((tr) => tr.docChanged)) return null;
          const tr = newState.tr;
          let modified = false;
          newState.doc.descendants((node, pos) => {
            if (node.type.name !== "paragraph" || node.attrs.locked) return;
            const text = node.textContent;
            let newType = "action";
            if (PATTERNS.SCENE.test(text)) newType = "scene";
            else if (PATTERNS.TRANSITION.test(text)) newType = "transition";
            else if (
              text === text.toUpperCase() &&
              text.length > 0 &&
              text.length < 50 &&
              !text.endsWith(":") &&
              !text.includes(
                (n) => n === n.toLowerCase() && n !== n.toUpperCase()
              )
            )
              newType = "character";
            else if (text.startsWith("(") && text.endsWith(")"))
              newType = "parenthetical";
            else {
              const prev =
                newState.doc
                  .resolve(pos)
                  .index(newState.doc.resolve(pos).depth) - 1;
              if (prev >= 0) {
                const prevType = newState.doc.resolve(pos).parent.child(prev)
                  .attrs.scriptType;
                if (
                  ["character", "parenthetical"].includes(prevType) ||
                  (prevType === "dialogue" && text.trim().length > 0)
                )
                  newType = "dialogue";
              }
            }
            if (node.attrs.scriptType !== newType) {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                scriptType: newType,
              });
              modified = true;
            }
          });
          return modified ? tr : null;
        },
      }),
    ];
  },
});

const EditorToolbar = ({ editor, token, onSiderCollapse, isAnalysing }) => {
  if (!editor) return null;
  return (
    <div
      style={{
        padding: "8px 16px",
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorFillQuaternary,
        zIndex: 10,
        display: "flex",
        alignItems: "center",
      }}
    >
      <Space>
        <Button
          type={"text"}
          icon={<BoldOutlined />}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <Button
          type={"text"}
          icon={<ItalicOutlined />}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <Divider orientation="vertical" />
        <Button
          type="text"
          icon={<UndoOutlined />}
          onClick={() => editor.chain().focus().undo().run()}
        />
        <Button
          type="text"
          icon={<RedoOutlined />}
          onClick={() => editor.chain().focus().redo().run()}
        />
        {isAnalysing && (
          <Tag color="blue" icon={<SyncOutlined spin />}>
            AI Processing...
          </Tag>
        )}
      </Space>
      <Button
        type="text"
        icon={<MenuFoldOutlined />}
        onClick={onSiderCollapse}
        style={{ marginLeft: "auto" }}
      />
    </div>
  );
};

// ==========================================
// 5. MAIN EDITOR COMPONENT
// ==========================================

export const ScriptEditor = ({ provider, onSiderCollapse }) => {
  const { user } = useOutletContext() || { user: { username: "Guest" } };
  const { token } = theme.useToken();
  const [isAnalysing, setIsAnalysing] = useState(false);
  const debounceRef = useRef(null);

  const handleContentUpdate = useCallback(
    (json) => {
      // 1. Instant Local Parse
      const { scenes, characters, interactions } = analyzeScriptLocal({
        content: json.content,
      });

      // 2. Local Merge & Write
      const analysisMap = provider.document.getMap("script_analysis");
      provider.document.transact(() => {
        const existingScenes = analysisMap.get("scenes") || [];
        const existingChars = analysisMap.get("characters") || [];

        // MERGE SCENES
        const mergedScenes = scenes.map((newScene) => {
          const oldScene = existingScenes.find((ex) => ex.id === newScene.id);
          if (oldScene && oldScene.metrics) {
            return {
              ...newScene,
              synopsis: oldScene.synopsis || newScene.synopsis,
              metrics: {
                ...newScene.metrics, // Local (actionRatio, etc)
                pacing: oldScene.metrics.pacing, // AI
                sentiment: oldScene.metrics.sentiment, // AI
                // linguisticDensity: kept from local logic or AI
              },
            };
          }
          return newScene;
        });
        analysisMap.set("scenes", mergedScenes);

        // MERGE CHARACTERS
        const mergedChars = characters.map((newChar) => {
          const oldChar = existingChars.find((ex) => ex.id === newChar.id);
          if (oldChar && oldChar.metrics) {
            return {
              ...newChar,
              emotion: oldChar.emotion || newChar.emotion,
              metrics: {
                ...newChar.metrics,
                degreeCentrality: oldChar.metrics.degreeCentrality,
                betweenness: oldChar.metrics.betweenness,
                avgSentiment: oldChar.metrics.avgSentiment,
              },
            };
          }
          return {
            ...newChar,
            emotion: "neutral",
            metrics: {
              degreeCentrality: 0,
              betweenness: 0,
              avgSentiment: 0,
              volatility: 0,
            },
          };
        });
        analysisMap.set("characters", mergedChars);
      });

      // 3. AI Enrichment
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setIsAnalysing(true);
        try {
          const netMetrics = await analyzeNetworkAI(interactions);
          const scenePromises = scenes.map((s) =>
            analyzeSceneAI(s.id, s.rawText)
          );
          const enrichedScenesRaw = await Promise.all(scenePromises);

          const charPromises = characters.map((c) => {
            if (c.dialogueCount > 2) return analyzeEmotionAI(c.allDialogueText);
            return Promise.resolve(null);
          });
          const enrichedEmotionsRaw = await Promise.all(charPromises);

          provider.document.transact(() => {
            const currentScenes = analysisMap.get("scenes") || [];
            const currentChars = analysisMap.get("characters") || [];

            const finalScenes = currentScenes.map((s, idx) => {
              const aiData = enrichedScenesRaw[idx];
              if (!aiData) return s;
              return {
                ...s,
                synopsis: aiData.synopsis,
                metrics: {
                  ...s.metrics,
                  pacing: aiData.metrics?.linguisticDensity || s.metrics.pacing,
                  sentiment: aiData.metrics?.sentiment || 0,
                },
              };
            });
            analysisMap.set("scenes", finalScenes);

            const finalChars = currentChars.map((c, idx) => {
              const aiEmo = enrichedEmotionsRaw.find(
                (_, i) => characters[i]?.id === c.id
              );
              const netMetric = netMetrics ? netMetrics[c.name] : null;
              return {
                ...c,
                emotion: aiEmo?.dominant || c.emotion || "neutral",
                metrics: {
                  ...c.metrics,
                  degreeCentrality: netMetric?.degreeCentrality || 0,
                  betweenness: netMetric?.betweenness || 0,
                },
              };
            });
            analysisMap.set("characters", finalChars);
          });
        } catch (err) {
          console.error("AI Pipeline Failed:", err);
        } finally {
          setIsAnalysing(false);
        }
      }, 2500);
    },
    [provider]
  );

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ undoRedo: false, paragraph: false }),
        ScreenplayExtension,
        Collaboration.configure({ document: provider.document }),
        CollaborationCaret.configure({
          provider,
          user: { name: user.username, color: token.colorPrimary },
        }),
      ],
      onUpdate: ({ editor }) => {
        handleContentUpdate(editor.getJSON());
      },
    },
    [provider]
  );

  return (
    <>
      <style>{getEditorStyles(token)}</style>
      <Card
        variant="borderless"
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: token.colorBgContainer,
        }}
        styles={{
          body: {
            padding: 0,
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          },
        }}
      >
        <EditorToolbar
          editor={editor}
          token={token}
          onSiderCollapse={onSiderCollapse}
          isAnalysing={isAnalysing}
        />
        <div
          style={{ flex: 1, overflowY: "auto", cursor: "text" }}
          onClick={() => editor?.commands.focus()}
        >
          <EditorContent editor={editor} style={{ minHeight: "100%" }} />
        </div>
      </Card>
    </>
  );
};
