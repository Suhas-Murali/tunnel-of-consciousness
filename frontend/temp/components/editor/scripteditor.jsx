import React, {
	useState,
	useRef,
	useCallback,
	useEffect,
	useContext,
} from "react";
import { useOutletContext } from "react-router-dom";
import {
	Button,
	Tag,
	Divider,
	Space,
	theme,
	Switch,
	Tooltip,
	Card,
	Dropdown,
	Select,
	Modal,
	Input,
	Tabs,
	message,
} from "antd";
import {
	BoldOutlined,
	ItalicOutlined,
	UndoOutlined,
	RedoOutlined,
	MenuFoldOutlined,
	SyncOutlined,
	ThunderboltOutlined,
	RobotOutlined,
	HighlightOutlined,
	GlobalOutlined,
	CodeOutlined,
	CopyOutlined,
	DownloadOutlined,
} from "@ant-design/icons";

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

// Import Context
import { ScriptStateContext } from "../contexts";
import {
	analyzeSceneAI,
	analyzeNetworkAI,
	analyzeEmotionAI,
	translateTextAI,
} from "../../../api";

// ==========================================
// 1. API HELPERS & UTILS
// ==========================================
const LANGUAGE_OPTIONS = [
	{ label: "English", value: "en" },
	{ label: "Hindi", value: "hi" },
	{ label: "Kannada", value: "kn" },
];

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

const generateContentHash = (scenes, characters) => {
	const scenesFingerprint = scenes
		.map((s) => s.id + s.rawText.length)
		.join("|");
	const charsFingerprint = characters
		.map((c) => c.name + c.dialogueCount)
		.join("|");
	const contentString = scenesFingerprint + "||" + charsFingerprint;

	let hash = 0;
	for (let i = 0; i < contentString.length; i++) {
		const char = contentString.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash;
	}
	return hash;
};

const SCRIPT_BLOCK_TYPES = new Set([
	"scene",
	"action",
	"character",
	"dialogue",
	"parenthetical",
	"transition",
]);

const IMPORT_SCRIPT_TYPE_ALIASES = {
	parenthesis: "parenthetical",
};

const EXPORT_SCRIPT_TYPE_ALIASES = {
	parenthetical: "parenthesis",
};

const getNodeText = (node) => {
	if (!node?.content) return "";
	return node.content.map((child) => child?.text || "").join("");
};

const exportParsedScriptFromDoc = (doc) => {
	const blocks = (doc?.content || [])
		.filter((node) => node?.type === "paragraph")
		.map((node) => {
			const rawType = String(node?.attrs?.scriptType || "action").toLowerCase();
			const normalizedType =
				IMPORT_SCRIPT_TYPE_ALIASES[rawType] ||
				(SCRIPT_BLOCK_TYPES.has(rawType) ? rawType : "action");
			const exportType =
				EXPORT_SCRIPT_TYPE_ALIASES[normalizedType] || normalizedType;

			return {
				scriptType: exportType,
				text: getNodeText(node),
			};
		});

	return {
		version: 1,
		format: "toc-script-v1",
		blocks,
	};
};

const normalizeImportPayload = (payload) => {
	const sourceBlocks = Array.isArray(payload) ? payload : payload?.blocks;
	if (!Array.isArray(sourceBlocks)) {
		throw new Error(
			"JSON must be an array of blocks or an object with a blocks array.",
		);
	}

	return sourceBlocks.map((block, index) => {
		if (!block || typeof block !== "object") {
			throw new Error(`Block ${index + 1} must be an object.`);
		}

		const rawType = String(block.scriptType || block.type || "")
			.trim()
			.toLowerCase();
		const normalizedType = IMPORT_SCRIPT_TYPE_ALIASES[rawType] || rawType;

		if (!SCRIPT_BLOCK_TYPES.has(normalizedType)) {
			throw new Error(
				`Block ${index + 1} has invalid scriptType "${
					block.scriptType || block.type
				}".`,
			);
		}

		return {
			scriptType: normalizedType,
			text:
				typeof block.text === "string"
					? block.text
					: block.text == null
						? ""
						: String(block.text),
		};
	});
};

const buildEditorDocFromBlocks = (blocks) => {
	const safeBlocks =
		blocks.length > 0 ? blocks : [{ scriptType: "action", text: "" }];

	return {
		type: "doc",
		content: safeBlocks.map((block) => ({
			type: "paragraph",
			attrs: {
				scriptType: block.scriptType,
				locked: true,
			},
			content: block.text ? [{ type: "text", text: block.text }] : [],
		})),
	};
};

// ==========================================
// 2. LOCAL SCRIPT PARSER
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
		color: "#888",
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
			const sceneName = text || "UNTITLED SCENE";

			currentScene = {
				id: `scene-${scenes.length + 1}`,
				name: sceneName,
				type: isExt ? "Action" : "Dialogue",
				color: stringToColor(sceneName),
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
					Math.round((s.rawText.length / Math.max(1, s.durationSecs)) * 2),
				),
				actionRatio: Math.round(
					(s.actionLines / Math.max(1, totalLines)) * 100,
				),
				sentiment: 0,
				structuralBeat: structuralBeat,
			},
		};
	});

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
// 3. EDITOR STYLES & COMPONENTS
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
								(n) => n === n.toLowerCase() && n !== n.toUpperCase(),
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

const EditorToolbar = ({
	editor,
	token,
	onSiderCollapse,
	isAnalysing,
	isTranslating,
	autoAnalyze,
	selectedLanguage,
	showTranslated,
	onToggleAuto,
	onLanguageChange,
	onToggleTranslated,
	onTriggerAnalysis,
	onOpenJsonModal,
}) => {
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

				<Divider orientation="vertical" />

				<Tooltip title="Auto-analyze script on edit">
					<Space>
						<Switch
							size="small"
							checkedChildren={<RobotOutlined />}
							unCheckedChildren={<RobotOutlined />}
							checked={autoAnalyze}
							onChange={onToggleAuto}
						/>
						<span style={{ fontSize: 12, color: token.colorTextSecondary }}>
							Auto-AI
						</span>
					</Space>
				</Tooltip>

				<Divider orientation="vertical" />

				<Tooltip title="Source language for analysis pipeline">
					<Space>
						<GlobalOutlined style={{ color: token.colorTextSecondary }} />
						<Select
							size="small"
							value={selectedLanguage}
							options={LANGUAGE_OPTIONS}
							onChange={onLanguageChange}
							style={{ width: 115 }}
						/>
					</Space>
				</Tooltip>

				<Tooltip title="View translated (read-only) text">
					<Space>
						<Switch
							size="small"
							checked={showTranslated}
							onChange={onToggleTranslated}
							disabled={selectedLanguage === "en"}
						/>
						<span style={{ fontSize: 12, color: token.colorTextSecondary }}>
							Translated
						</span>
					</Space>
				</Tooltip>

				<Tooltip title="Run full analysis now">
					<Button
						size="small"
						icon={<ThunderboltOutlined />}
						onClick={onTriggerAnalysis}
						disabled={isAnalysing}
					>
						Run
					</Button>
				</Tooltip>

				<Tooltip title="Import or export parsed script JSON">
					<Button
						size="small"
						icon={<CodeOutlined />}
						onClick={onOpenJsonModal}
					>
						JSON
					</Button>
				</Tooltip>

				{isAnalysing && (
					<Tag color="blue" icon={<SyncOutlined spin />}>
						Processing...
					</Tag>
				)}
				{isTranslating && (
					<Tag color="gold" icon={<SyncOutlined spin />}>
						Translating...
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
// 4. MAIN EDITOR LOGIC
// ==========================================

export const ScriptEditor = ({ onSiderCollapse, provider }) => {
	const {
		focusRequest,
		currentTime,
		selectedLanguage,
		setSelectedLanguage,
		showTranslated,
		setShowTranslated,
	} = useContext(ScriptStateContext);

	const { user } = useOutletContext() || { user: { username: "Guest" } };
	const { token } = theme.useToken();

	const [isAnalysing, setIsAnalysing] = useState(false);
	const [isTranslating, setIsTranslating] = useState(false);
	const [autoAnalyze, setAutoAnalyze] = useState(true);
	const [translatedScriptText, setTranslatedScriptText] = useState("");
	const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
	const [jsonModalMode, setJsonModalMode] = useState("export");
	const [exportJsonText, setExportJsonText] = useState("");
	const [importJsonText, setImportJsonText] = useState("");
	const [isJsonImporting, setIsJsonImporting] = useState(false);
	const debounceRef = useRef(null);
	const lastAutoScrollTime = useRef(-1);

	const buildTranslatedScriptText = useCallback((scenes, translatedScenes) => {
		return scenes
			.map((scene) => {
				const translated = translatedScenes[scene.id] || scene.rawText;
				return `${scene.name}\n${translated}`.trim();
			})
			.join("\n\n");
	}, []);

	const getLastHashForLanguage = useCallback((settingsMap, language) => {
		const hashMap = settingsMap.get("lastContentHashByLanguage") || {};
		return hashMap[language];
	}, []);

	// 1. Core Update Handler
	const handleContentUpdate = useCallback(
		({ editor, transaction }) => {
			if (!transaction.docChanged) return;

			const json = editor.getJSON();
			const { scenes, characters, interactions } = analyzeScriptLocal({
				content: json.content,
			});

			const analysisMap = provider.document.getMap("script_analysis");

			provider.document.transact(() => {
				const existingScenes = analysisMap.get("scenes") || [];
				const existingChars = analysisMap.get("characters") || [];

				const mergedScenes = scenes.map((newScene) => {
					const oldScene = existingScenes.find((ex) => ex.id === newScene.id);
					if (oldScene && oldScene.metrics) {
						return {
							...newScene,
							synopsis: oldScene.synopsis || newScene.synopsis,
							metrics: {
								...newScene.metrics,
								sentiment: oldScene.metrics.sentiment,
							},
						};
					}
					return newScene;
				});
				analysisMap.set("scenes", mergedScenes);

				const mergedChars = characters.map((newChar) => {
					const oldChar = existingChars.find((ex) => ex.id === newChar.id);
					if (oldChar && oldChar.metrics) {
						return {
							...newChar,
							emotion: oldChar.emotion || "neutral",
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

			const settingsMap = provider.document.getMap("script_settings");
			const isAuto = settingsMap.get("autoAnalyze") ?? true;

			if (isAuto) {
				if (debounceRef.current) clearTimeout(debounceRef.current);

				debounceRef.current = setTimeout(() => {
					const currentHash = generateContentHash(scenes, characters);
					const lastHash = getLastHashForLanguage(
						settingsMap,
						selectedLanguage,
					);
					console.info("[ScriptEditor] Debounced analysis check", {
						selectedLanguage,
						currentHash,
						lastHash,
					});

					if (currentHash !== lastHash) {
						runAIAnalysis(
							scenes,
							characters,
							interactions,
							currentHash,
							selectedLanguage,
						);
					}
				}, 2500);
			}
		},
		[provider, getLastHashForLanguage, selectedLanguage],
	);

	// 2. Initialize Editor - MUST BE BEFORE SCROLL LOGIC
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
			onUpdate: handleContentUpdate,
		},
		[provider],
	);

	const refreshExportJson = useCallback(() => {
		if (!editor) {
			setExportJsonText("");
			return;
		}

		const payload = exportParsedScriptFromDoc(editor.getJSON());
		setExportJsonText(JSON.stringify(payload, null, 2));
	}, [editor]);

	// 3. Scroll Logic (Now has access to initialized 'editor')
	const scrollToTime = useCallback(
		(targetTime) => {
			if (!editor) return;

			// Jitter threshold
			if (Math.abs(targetTime - lastAutoScrollTime.current) < 0.1) return;

			let accumulatedTime = 0;
			let foundPos = null;

			editor.state.doc.forEach((node, offset) => {
				if (foundPos !== null) return;

				const type = node.attrs.scriptType || "action";
				let duration = 0;
				if (type === "scene") duration = 0;
				else if (type === "dialogue") duration = 3;
				else if (type === "action") duration = 2;

				if (node.textContent.trim().length > 0 || type === "scene") {
					if (accumulatedTime + duration >= targetTime) {
						foundPos = offset;
						return;
					}
					accumulatedTime += duration;
				}
			});

			if (foundPos !== null) {
				//
				// Native DOM scroll is more reliable than Tiptap's selection based scroll here
				const domNode = editor.view.nodeDOM(foundPos);
				if (domNode && domNode.scrollIntoView) {
					domNode.scrollIntoView({ block: "center", behavior: "auto" });

					// Optional: Update selection to highlight line without forcing focus
					try {
						editor.commands.setTextSelection(foundPos + 1);
					} catch (e) {
						/* ignore selection errors if out of focus */
					}
				}
				lastAutoScrollTime.current = targetTime;
			}
		},
		[editor],
	);

	// 4. Define Analysis Runner
	const runAIAnalysis = async (
		scenes,
		characters,
		interactions,
		currentHash,
		language = selectedLanguage,
	) => {
		const runId = `analysis-${Date.now()}-${Math.random()
			.toString(36)
			.slice(2, 8)}`;

		setIsAnalysing(true);
		try {
			console.info(`[ScriptEditor][${runId}] analysis started`, {
				language,
				scenes: scenes.length,
				characters: characters.length,
				hash: currentHash,
			});

			const sceneTextById = {};
			scenes.forEach((scene) => {
				sceneTextById[scene.id] = scene.rawText;
			});

			const emotionTextByCharacterId = {};
			characters.forEach((character) => {
				emotionTextByCharacterId[character.id] = character.allDialogueText;
			});

			if (language !== "en") {
				setIsTranslating(true);
				console.info(`[ScriptEditor][${runId}] translation phase started`, {
					language,
					sceneCount: scenes.length,
					characterCount: characters.length,
				});

				const translatedScenesRaw = await Promise.all(
					scenes.map((scene) => translateTextAI(scene.rawText, language)),
				);

				const translatedScenes = {};
				translatedScenesRaw.forEach((translatedResult, idx) => {
					const scene = scenes[idx];
					if (!translatedResult?.translatedText) {
						console.warn(
							`[ScriptEditor][${runId}] scene translation fallback`,
							{
								sceneId: scene.id,
								language,
							},
						);
					}
					translatedScenes[scene.id] =
						translatedResult?.translatedText || scene.rawText;
					sceneTextById[scene.id] = translatedScenes[scene.id];
				});

				const translatedCharactersRaw = await Promise.all(
					characters.map((character) => {
						if (character.dialogueCount <= 2) {
							return Promise.resolve(null);
						}
						return translateTextAI(character.allDialogueText, language);
					}),
				);

				translatedCharactersRaw.forEach((translatedResult, idx) => {
					const character = characters[idx];
					if (
						character.dialogueCount > 2 &&
						!translatedResult?.translatedText
					) {
						console.warn(
							`[ScriptEditor][${runId}] character translation fallback`,
							{
								characterId: character.id,
								language,
							},
						);
					}
					emotionTextByCharacterId[character.id] =
						translatedResult?.translatedText || character.allDialogueText;
				});

				const translatedScript = buildTranslatedScriptText(
					scenes,
					translatedScenes,
				);
				setTranslatedScriptText(translatedScript);

				provider.document.transact(() => {
					const translationsMap = provider.document.getMap(
						"script_translations",
					);
					const snapshot = {
						language,
						hash: currentHash,
						generatedAt: new Date().toISOString(),
						scriptText: translatedScript,
						sceneTexts: translatedScenes,
					};
					translationsMap.set(`latest:${language}`, snapshot);
					translationsMap.set(`byHash:${language}:${currentHash}`, snapshot);
				});

				console.info(`[ScriptEditor][${runId}] translation phase completed`, {
					language,
					translatedScenes: Object.keys(translatedScenes).length,
				});
			}

			const netMetrics = await analyzeNetworkAI(interactions);
			const scenePromises = scenes.map((s) =>
				analyzeSceneAI(s.id, sceneTextById[s.id] || s.rawText, language),
			);
			const enrichedScenesRaw = await Promise.all(scenePromises);

			const charPromises = characters.map((c) => {
				if (c.dialogueCount > 2) {
					return analyzeEmotionAI(
						emotionTextByCharacterId[c.id] || c.allDialogueText,
						language,
					);
				}
				return Promise.resolve(null);
			});
			const enrichedEmotionsRaw = await Promise.all(charPromises);
			const emotionByCharacterId = {};
			characters.forEach((character, idx) => {
				emotionByCharacterId[character.id] = enrichedEmotionsRaw[idx];
			});

			provider.document.transact(() => {
				const settingsMap = provider.document.getMap("script_settings");
				const existingHashes =
					settingsMap.get("lastContentHashByLanguage") || {};
				settingsMap.set("lastContentHashByLanguage", {
					...existingHashes,
					[language]: currentHash,
				});
				settingsMap.set("lastContentHash", currentHash);

				const analysisMap = provider.document.getMap("script_analysis");
				const currentScenes = analysisMap.get("scenes") || [];
				const currentChars = analysisMap.get("characters") || [];

				const finalScenes = currentScenes.map((s, idx) => {
					const aiData = enrichedScenesRaw[idx];
					if (!aiData) return s;
					return {
						...s,
						synopsis: aiData.synopsis || s.synopsis,
						metrics: {
							...s.metrics,
							pacing: aiData.metrics?.linguisticDensity || s.metrics.pacing,
							sentiment: aiData.metrics?.sentiment || s.metrics.sentiment,
						},
					};
				});
				analysisMap.set("scenes", finalScenes);

				const finalChars = currentChars.map((c) => {
					const aiEmo = emotionByCharacterId[c.id];
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

			console.info(`[ScriptEditor][${runId}] analysis completed`, {
				language,
				scenesAnalyzed: scenes.length,
				charactersAnalyzed: characters.length,
			});
		} catch (err) {
			console.error(`[ScriptEditor][${runId}] AI Pipeline Failed`, err);
		} finally {
			setIsTranslating(false);
			setIsAnalysing(false);
		}
	};

	// 5. Manual Trigger
	const handleManualAnalysis = () => {
		if (!editor) return;
		const json = editor.getJSON();
		const { scenes, characters, interactions } = analyzeScriptLocal({
			content: json.content,
		});
		const currentHash = generateContentHash(scenes, characters);
		runAIAnalysis(
			scenes,
			characters,
			interactions,
			currentHash,
			selectedLanguage,
		);
	};

	const handleToggleAuto = (checked) => {
		console.info("[ScriptEditor] Auto-analyze toggled", { checked });
		setAutoAnalyze(checked);
		if (provider) {
			provider.document.getMap("script_settings").set("autoAnalyze", checked);
		}
	};

	const handleLanguageChange = (value) => {
		console.info("[ScriptEditor] Language changed", { value });
		setSelectedLanguage(value);
		if (!provider) return;

		const settingsMap = provider.document.getMap("script_settings");
		settingsMap.set("selectedLanguage", value);

		if (value === "en") {
			setShowTranslated(false);
			settingsMap.set("showTranslated", false);
		}
	};

	const handleToggleTranslated = (checked) => {
		console.info("[ScriptEditor] Translated view toggled", {
			checked,
			selectedLanguage,
		});
		if (selectedLanguage === "en") {
			setShowTranslated(false);
			if (provider) {
				provider.document
					.getMap("script_settings")
					.set("showTranslated", false);
			}
			return;
		}

		setShowTranslated(checked);
		if (provider) {
			provider.document
				.getMap("script_settings")
				.set("showTranslated", checked);
		}
	};

	const handleOpenJsonModal = () => {
		try {
			refreshExportJson();
			setJsonModalMode("export");
			setIsJsonModalOpen(true);
		} catch (err) {
			console.error("[ScriptEditor] Failed to prepare export JSON", err);
			message.error("Could not prepare export JSON.");
		}
	};

	const handleCopyExportJson = async () => {
		if (!exportJsonText) {
			message.warning("No JSON is available to copy.");
			return;
		}

		try {
			await navigator.clipboard.writeText(exportJsonText);
			message.success("Script JSON copied to clipboard.");
		} catch (err) {
			console.error("[ScriptEditor] Failed to copy export JSON", err);
			message.error("Could not copy JSON. You can still copy it manually.");
		}
	};

	const handleDownloadExportJson = () => {
		if (!exportJsonText) {
			message.warning("No JSON is available to download.");
			return;
		}

		try {
			const blob = new Blob([exportJsonText], {
				type: "application/json;charset=utf-8",
			});
			const url = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			link.download = `script-export-${Date.now()}.json`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(url);
			message.success("Script JSON downloaded.");
		} catch (err) {
			console.error("[ScriptEditor] Failed to download export JSON", err);
			message.error("Could not download JSON.");
		}
	};

	const handleImportJson = async () => {
		if (!editor || !provider) {
			message.error("Editor is not ready yet.");
			return;
		}

		setIsJsonImporting(true);
		try {
			const parsed = JSON.parse(importJsonText);
			const blocks = normalizeImportPayload(parsed);
			const importedDoc = buildEditorDocFromBlocks(blocks);

			provider.document.transact(() => {
				editor.commands.setContent(importedDoc, true);
			});

			setShowTranslated(false);
			provider.document.getMap("script_settings").set("showTranslated", false);

			const { scenes, characters, interactions } = analyzeScriptLocal({
				content: importedDoc.content,
			});
			const currentHash = generateContentHash(scenes, characters);

			setIsJsonModalOpen(false);
			setImportJsonText("");
			refreshExportJson();
			message.success("Script imported. Analysis started.");

			runAIAnalysis(
				scenes,
				characters,
				interactions,
				currentHash,
				selectedLanguage,
			);
		} catch (err) {
			console.error("[ScriptEditor] Failed to import script JSON", err);
			message.error(
				err?.message
					? `Import failed: ${err.message}`
					: "Import failed. Check JSON format and block types.",
			);
		} finally {
			setIsJsonImporting(false);
		}
	};

	// 6. Effects
	useEffect(() => {
		if (currentTime !== undefined) {
			scrollToTime(currentTime);
		}
	}, [currentTime, scrollToTime]);

	useEffect(() => {
		if (focusRequest) {
			scrollToTime(focusRequest.timestamp || 0);
			if (editor) editor.commands.focus();
		}
	}, [focusRequest, scrollToTime]);

	useEffect(() => {
		if (!provider) return;
		const settingsMap = provider.document.getMap("script_settings");

		if (settingsMap.has("autoAnalyze")) {
			setAutoAnalyze(settingsMap.get("autoAnalyze"));
		}
		if (settingsMap.has("selectedLanguage")) {
			setSelectedLanguage(settingsMap.get("selectedLanguage"));
		}
		if (settingsMap.has("showTranslated")) {
			setShowTranslated(settingsMap.get("showTranslated"));
		}

		const handleSettingsChange = () => {
			if (settingsMap.has("autoAnalyze")) {
				setAutoAnalyze(settingsMap.get("autoAnalyze"));
			}
			if (settingsMap.has("selectedLanguage")) {
				setSelectedLanguage(settingsMap.get("selectedLanguage"));
			}
			if (settingsMap.has("showTranslated")) {
				setShowTranslated(settingsMap.get("showTranslated"));
			}
		};

		settingsMap.observe(handleSettingsChange);
		return () => settingsMap.unobserve(handleSettingsChange);
	}, [provider, setSelectedLanguage, setShowTranslated]);

	useEffect(() => {
		if (!provider) return;

		const translationsMap = provider.document.getMap("script_translations");
		const syncTranslatedSnapshot = () => {
			const latestTranslation = translationsMap.get(
				`latest:${selectedLanguage}`,
			);
			setTranslatedScriptText(latestTranslation?.scriptText || "");
		};

		syncTranslatedSnapshot();
		translationsMap.observe(syncTranslatedSnapshot);
		return () => translationsMap.unobserve(syncTranslatedSnapshot);
	}, [provider, selectedLanguage]);

	useEffect(() => {
		if (isJsonModalOpen && jsonModalMode === "export") {
			refreshExportJson();
		}
	}, [isJsonModalOpen, jsonModalMode, refreshExportJson]);

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
					isTranslating={isTranslating}
					autoAnalyze={autoAnalyze}
					selectedLanguage={selectedLanguage}
					showTranslated={showTranslated}
					onToggleAuto={handleToggleAuto}
					onLanguageChange={handleLanguageChange}
					onToggleTranslated={handleToggleTranslated}
					onTriggerAnalysis={handleManualAnalysis}
					onOpenJsonModal={handleOpenJsonModal}
				/>
				<div
					style={{ flex: 1, overflowY: "auto", cursor: "text" }}
					onClick={() => {
						if (!showTranslated) {
							editor?.commands.focus();
						}
					}}
				>
					{showTranslated && selectedLanguage !== "en" ? (
						<pre
							style={{
								margin: 0,
								padding: "32px 80px",
								minHeight: "100%",
								whiteSpace: "pre-wrap",
								wordBreak: "break-word",
								fontFamily: "'Courier Prime', 'Courier New', monospace",
								color: token.colorText,
								backgroundColor: token.colorBgContainer,
							}}
						>
							{translatedScriptText ||
								"No translated text is available yet. Run analysis for the selected language."}
						</pre>
					) : (
						<EditorContent editor={editor} style={{ minHeight: "100%" }} />
					)}
				</div>
			</Card>
			<Modal
				title="Script JSON Import/Export"
				open={isJsonModalOpen}
				onCancel={() => setIsJsonModalOpen(false)}
				width={860}
				footer={
					jsonModalMode === "import"
						? [
								<Button key="cancel" onClick={() => setIsJsonModalOpen(false)}>
									Cancel
								</Button>,
								<Button
									key="import"
									type="primary"
									onClick={handleImportJson}
									loading={isJsonImporting}
									disabled={!importJsonText.trim()}
								>
									Import JSON
								</Button>,
							]
						: [
								<Button key="close" onClick={() => setIsJsonModalOpen(false)}>
									Close
								</Button>,
								<Button
									key="copy"
									onClick={handleCopyExportJson}
									icon={<CopyOutlined />}
								>
									Copy
								</Button>,
								<Button
									key="download"
									type="primary"
									onClick={handleDownloadExportJson}
									icon={<DownloadOutlined />}
								>
									Download
								</Button>,
							]
				}
			>
				<Tabs
					activeKey={jsonModalMode}
					onChange={(key) => setJsonModalMode(key)}
					items={[
						{
							key: "export",
							label: "Export",
							children: (
								<Input.TextArea
									value={exportJsonText}
									readOnly
									autoSize={{ minRows: 14, maxRows: 22 }}
								/>
							),
						},
						{
							key: "import",
							label: "Import",
							children: (
								<Input.TextArea
									value={importJsonText}
									onChange={(e) => setImportJsonText(e.target.value)}
									autoSize={{ minRows: 14, maxRows: 22 }}
									placeholder='Paste JSON from export format: { "version": 1, "format": "toc-script-v1", "blocks": [{ "scriptType": "scene", "text": "INT. ..." }] }'
								/>
							),
						},
					]}
				/>
			</Modal>
		</>
	);
};
