import React, { useState, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Progress,
  Row,
  Col,
  Statistic,
  Select,
  Empty,
  Typography,
  Tag,
  Avatar,
  Collapse,
  List,
  Card,
  Button,
  Tooltip,
  Divider,
  Space,
  theme,
  Dropdown,
} from "antd";
import {
  ThunderboltOutlined,
  CommentOutlined,
  ClockCircleOutlined,
  AimOutlined,
  UserOutlined,
  MessageOutlined,
  TagsOutlined,
  EnvironmentOutlined,
  BoldOutlined,
  ItalicOutlined,
  StrikethroughOutlined,
  UndoOutlined,
  RedoOutlined,
  HighlightOutlined,
  FlagOutlined,
  ShareAltOutlined,
  RiseOutlined,
  SmileOutlined,
  FrownOutlined,
  BarChartOutlined,
  FontSizeOutlined,
} from "@ant-design/icons";

import { StarterKit } from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { useEditor, EditorContent, ReactNodeViewRenderer } from "@tiptap/react";
import { BubbleMenu, FloatingMenu } from "@tiptap/react/menus";
import { CenteredLoader } from "./loader";

import { Extension } from "@tiptap/core";
import TiptapParagraph from "@tiptap/extension-paragraph";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";

const { Text, Title, Paragraph } = Typography;

// --- 1. IMPROVED REGEX PATTERNS ---
const PATTERNS = {
  // stricter scene heading detection
  SCENE: /^(INT|EXT|EST|I\/E|INT\/EXT)[\.\s]/i,
  TRANSITION: /^(FADE|CUT|DISSOLVE|SMASH|WIPE|TO:)$/i,
};

// --- 2. UPDATED EXTENSION WITH 'LOCKED' LOGIC ---
const ScreenplayExtension = TiptapParagraph.extend({
  priority: 1000,

  addAttributes() {
    return {
      scriptType: { default: "action" },
      // New attribute: prevents auto-parser from overwriting manual selection
      locked: { default: false },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ScreenplayBlock);
  },

  addKeyboardShortcuts() {
    const setType = (type) => () => {
      return this.editor.commands.updateAttributes("paragraph", {
        scriptType: type,
        locked: true, // Force lock so auto-parser doesn't revert it
      });
    };

    return {
      "Mod-1": setType("scene"),
      "Mod-2": setType("action"),
      "Mod-3": setType("character"),
      "Mod-4": setType("dialogue"),
      "Mod-5": setType("parenthetical"),
      "Mod-6": setType("transition"),

      // Optional: Shortcut to "Unlock" and let auto-parser take over
      "Mod-Alt-0": () => {
        return this.editor.commands.updateAttributes("paragraph", {
          locked: false,
        });
      },
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
            if (node.type.name !== "paragraph") return;

            // If user manually set this type, skip auto-classification
            if (node.attrs.locked) return;

            const text = node.textContent;
            const currentType = node.attrs.scriptType;
            let newType = "action";

            // --- IMPROVED LOGIC ---
            if (PATTERNS.SCENE.test(text)) {
              newType = "scene";
            } else if (PATTERNS.TRANSITION.test(text)) {
              newType = "transition";
            } else if (
              text.length > 0 &&
              text === text.toUpperCase() &&
              !text.includes(
                (n) => n === n.toLowerCase() && n !== n.toUpperCase()
              ) && // Ensure it has letters
              text.length < 50 && // slightly longer allowance
              !text.endsWith(":")
            ) {
              newType = "character";
            } else if (text.startsWith("(") && text.endsWith(")")) {
              newType = "parenthetical";
            } else {
              // --- STICKY DIALOGUE LOGIC ---
              const $pos = newState.doc.resolve(pos);
              // Look back 1 node
              const prevNodeIndex = $pos.index($pos.depth) - 1;

              if (prevNodeIndex >= 0) {
                const prevNode = $pos.parent.child(prevNodeIndex);
                const prevType = prevNode.attrs.scriptType;

                // If previous was Character or Parenthetical -> Dialogue
                if (prevType === "character" || prevType === "parenthetical") {
                  newType = "dialogue";
                }
                // If previous was Dialogue AND this isn't empty -> Continued Dialogue
                else if (prevType === "dialogue" && text.trim().length > 0) {
                  newType = "dialogue";
                }
              }
            }

            if (currentType !== newType) {
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

// --- 3. VISUAL OVERHAUL CSS ---
const getEditorStyles = (token) => `
  /* RESET & BASIC */
  .ProseMirror {
    outline: none;
    min-height: 100%;
    padding: 40px 60px; /* More paper-like padding */
    font-family: 'Courier Prime', 'Courier New', monospace; 
    color: ${token.colorText}; 
    background-color: ${token.colorBgContainer};
    counter-reset: line-counter; /* Init Line Counter */
    font-size: 16px;
    line-height: 1.2;
  }

  /* WRAPPER */
  .script-block-wrapper {
    display: flex;
    align-items: baseline;
    position: relative;
    border-radius: 2px;
    counter-increment: line-counter; /* Increment Line Counter */
  }

  /* LINE NUMBERS */
  .script-block-wrapper::before {
    content: counter(line-counter);
    position: absolute;
    left: -40px;
    width: 30px;
    text-align: right;
    color: ${token.colorTextQuaternary};
    font-size: 10px;
    font-family: sans-serif;
    user-select: none;
    top: 2px;
  }
  
  /* GUTTER CHIP */
  .script-block-wrapper .type-chip {
    opacity: 0.0; /* Hidden by default for clean look */
    transition: opacity 0.2s;
    cursor: pointer;
    margin-right: 15px;
    width: 20px; /* Much smaller gutter */
    display: flex;
    justify-content: center;
    user-select: none;
    flex-shrink: 0;
  }
  
  /* Show chip on hover or focus */
  .script-block-wrapper:hover .type-chip,
  .script-block-wrapper:focus-within .type-chip {
    opacity: 1;
  }

  .script-content {
    flex: 1;
    outline: none;
  }

  /* --- SCREENPLAY FORMATTING --- */

  /* SCENE: Bold, Uppercase, Underlined */
  .script-block-wrapper.type-scene {
    margin-top: 2rem;
    margin-bottom: 1rem;
    border-bottom: 2px solid ${token.colorBorder};
    padding-bottom: 5px;
  }
  .script-block-wrapper.type-scene .script-content {
    font-weight: 900;
    text-transform: uppercase;
  }

  /* CHARACTER: Centered (~40% left indent) */
  .script-block-wrapper.type-character {
    margin-top: 1rem;
  }
  .script-block-wrapper.type-character .script-content {
    margin-left: 35%; /* Standard screenplay indent */
    width: 40%;
    font-weight: bold;
    text-transform: uppercase;
  }

  /* DIALOGUE: Centered block (~25% margins), Visual Border */
  .script-block-wrapper.type-dialogue .script-content {
    margin-left: 10%;
    margin-right: 10%;
    width: 80%;
    /* The visual flair you asked for */
    border-left: 3px solid ${token.colorBorderSecondary}; 
    padding-left: 15px;
  }

  /* PARENTHETICAL: Indented inside dialogue */
  .script-block-wrapper.type-parenthetical .script-content {
    margin-left: 30%;
    width: 40%;
    font-style: italic;
    color: ${token.colorTextSecondary};
  }
  
  /* ACTION: Default, full width */
  .script-block-wrapper.type-action .script-content {
    margin-bottom: 0.8rem;
    margin-top: 0.8rem;
  }
  
  /* TRANSITION: Right aligned */
  .script-block-wrapper.type-transition .script-content {
    text-align: right;
    margin-top: 1rem;
    margin-bottom: 1rem;
    font-weight: bold;
    text-transform: uppercase;
  }

  /* PLACEHOLDER */
  .script-content p.is-editor-empty:first-child::before {
    color: ${token.colorTextQuaternary};
    content: attr(data-placeholder);
    float: left;
    height: 0;
    pointer-events: none;
  }
`;

const EditorToolbar = ({ editor, token }) => {
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
        flexShrink: 0,
      }}
    >
      <Space>
        {/* Simple Formatting */}
        <Button
          type={editor.isActive("bold") ? "primary" : "text"}
          icon={<BoldOutlined />}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <Button
          type={editor.isActive("italic") ? "primary" : "text"}
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
        <Text type="secondary" style={{ fontSize: 12 }}>
          Mass Effect: Redemption (Draft 1)
        </Text>
      </Space>
    </div>
  );
};

// --- 4. UPDATED COMPONENT WITH LOCKED HANDLER ---
const ScreenplayBlock = ({ node, updateAttributes }) => {
  const { scriptType, locked } = node.attrs;

  // Configuration for each type
  const typeConfig = {
    scene: { color: "blue", label: "S", fullLabel: "Scene Heading" },
    action: { color: "default", label: "A", fullLabel: "Action" },
    character: { color: "gold", label: "C", fullLabel: "Character" },
    dialogue: { color: "cyan", label: "D", fullLabel: "Dialogue" },
    parenthetical: { color: "purple", label: "P", fullLabel: "Parenthetical" },
    transition: { color: "orange", label: "T", fullLabel: "Transition" },
  };

  const currentConfig = typeConfig[scriptType] || typeConfig["action"];

  // Helper to force type and LOCK it
  const handleTypeChange = (type) => {
    updateAttributes({
      scriptType: type,
      locked: true, // <--- IMPORTANT: Prevents auto-parser overwrite
    });
  };

  const items = Object.keys(typeConfig).map((key) => ({
    key: key,
    label: typeConfig[key].fullLabel,
    onClick: () => handleTypeChange(key),
  }));

  // Unlock option if manually locked
  if (locked) {
    items.push({ type: "divider" });
    items.push({
      key: "unlock",
      label: "Unlock (Auto-detect)",
      icon: <UndoOutlined />,
      onClick: () => updateAttributes({ locked: false }), // Let parser take over again
    });
  }

  return (
    <NodeViewWrapper className={`script-block-wrapper type-${scriptType}`}>
      {/* The Gutter Chip */}
      <div className="type-chip" contentEditable={false}>
        <Dropdown menu={{ items }} trigger={["click"]}>
          <Tag
            variant="solid"
            color={locked ? "red" : currentConfig.color} // Red indicates manual override
            style={{
              margin: 0,
              cursor: "pointer",
              width: "24px",
              height: "24px",
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "10px",
              borderRadius: "4px",
            }}
          >
            {locked ? <HighlightOutlined /> : currentConfig.label}
          </Tag>
        </Dropdown>
      </div>

      {/* The Actual Text Content */}
      <NodeViewContent className="script-content" />
    </NodeViewWrapper>
  );
};

const ScriptEditor = ({ provider }) => {
  const { user } = useOutletContext() || { user: { username: "Guest" } };
  const { token } = theme.useToken();

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
    },
    [provider]
  );

  const styles = getEditorStyles(token);

  return (
    <>
      <style>{styles}</style>
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
        <EditorToolbar editor={editor} token={token} />
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

export { ScriptEditor };
// Note: Export the EditorWindow/CharacterOverview/SceneOverview as before
// or import them here if they are in the same file.
// The Window Wrapper
const EditorWindow = ({ provider }) => {
  if (!provider) {
    return <CenteredLoader height="100%" />;
  }

  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <ScriptEditor key={provider.document.guid} provider={provider} />
    </div>
  );
};

const CharacterOverview = ({ characterList = [], characterDetails = {} }) => {
  const { token } = theme.useToken();
  const [selectedId, setSelectedId] = useState(null);

  const activeChar = useMemo(
    () => (selectedId ? characterDetails[selectedId] : null),
    [selectedId, characterDetails]
  );

  const activeBasicInfo = useMemo(
    () => characterList.find((c) => c.id === selectedId),
    [selectedId, characterList]
  );

  const handleSelect = (value) => {
    setSelectedId(value);
  };

  const sceneItems = useMemo(() => {
    if (!activeChar || !activeChar.scenes) return [];
    return activeChar.scenes.map((scene) => ({
      key: scene.sceneId,
      label: (
        <Space>
          <EnvironmentOutlined style={{ color: token.colorTextSecondary }} />
          <Text strong>{scene.sceneName}</Text>
          <Tag size="small">{scene.dialogueCount} lines</Tag>
        </Space>
      ),
      children: (
        <List
          size="small"
          dataSource={scene.dialogues}
          renderItem={(item) => (
            <List.Item style={{ paddingLeft: 0, paddingRight: 0 }}>
              <Space align="start">
                <MessageOutlined
                  style={{
                    marginTop: 4,
                    color: activeBasicInfo?.color
                      ? "#" + activeBasicInfo.color.getHexString()
                      : token.colorTextTertiary,
                  }}
                />
                <Text style={{ fontSize: 13, color: token.colorText }}>
                  {item}
                </Text>
              </Space>
            </List.Item>
          )}
        />
      ),
    }));
  }, [activeChar, activeBasicInfo, token]);

  // Helper for Sentiment Color
  const getSentimentColor = (val) => {
    if (val > 0.2) return token.colorSuccess;
    if (val < -0.2) return token.colorError;
    return token.colorWarning; // Neutral
  };

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: token.colorBgContainer,
      }}
    >
      {/* 1. SELECTION HEADER */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorFillQuaternary,
        }}
      >
        <Select
          style={{ width: "100%" }}
          placeholder="Select a Character to Inspect"
          onChange={handleSelect}
          options={characterList.map((c) => ({
            value: c.id,
            label: (
              <Space>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    backgroundColor: "#" + c.color.getHexString(),
                  }}
                />
                {c.name}
              </Space>
            ),
          }))}
        />
      </div>

      {/* 2. CONTENT AREA */}
      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        {!selectedId || !activeChar ? (
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No Character Selected"
            />
          </div>
        ) : (
          <div>
            {/* Header / Bio */}
            <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
              <Avatar
                size={64}
                style={{
                  backgroundColor:
                    "#" + activeBasicInfo?.color?.getHexString() ||
                    token.colorPrimary,
                  verticalAlign: "middle",
                }}
                icon={<UserOutlined />}
              />
              <div style={{ flex: 1 }}>
                <Title level={4} style={{ margin: 0 }}>
                  {activeBasicInfo?.name}
                </Title>
                <Space size={4}>
                  <Text type="secondary">{activeChar.role}</Text>
                  {activeChar.archetype && (
                    <Tag color="purple" bordered={false}>
                      {activeChar.archetype}
                    </Tag>
                  )}
                </Space>
                <div style={{ marginTop: 8 }}>
                  {activeChar.traits.map((trait) => (
                    <Tag key={trait} color="blue" bordered={false}>
                      {trait}
                    </Tag>
                  ))}
                </div>
              </div>
            </div>

            {/* --- NEW SECTION: SOCIAL DYNAMICS & EMOTION --- */}
            {activeChar.metrics && (
              <div style={{ marginBottom: 24 }}>
                <Row gutter={[16, 16]}>
                  {/* Social Column */}
                  <Col span={12}>
                    <Card
                      size="small"
                      title={
                        <Space>
                          <ShareAltOutlined /> Social Dynamics
                        </Space>
                      }
                      bordered={false}
                      style={{
                        background: token.colorFillQuaternary,
                        height: "100%",
                      }}
                    >
                      <div style={{ marginBottom: 16 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 12,
                          }}
                        >
                          <Tooltip title="Degree Centrality: How many people they connect with">
                            <span>Influence</span>
                          </Tooltip>
                          <span>
                            {Math.round(
                              activeChar.metrics.degreeCentrality * 100
                            )}
                            %
                          </span>
                        </div>
                        <Progress
                          percent={activeChar.metrics.degreeCentrality * 100}
                          showInfo={false}
                          size="small"
                          strokeColor={token.colorPrimary}
                        />
                      </div>
                      <div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 12,
                          }}
                        >
                          <Tooltip title="Betweenness Centrality: How often they bridge different groups">
                            <span>Network Bridge</span>
                          </Tooltip>
                          <span>
                            {Math.round(activeChar.metrics.betweenness * 100)}%
                          </span>
                        </div>
                        <Progress
                          percent={activeChar.metrics.betweenness * 100}
                          showInfo={false}
                          size="small"
                          strokeColor={token.colorWarning}
                        />
                      </div>
                    </Card>
                  </Col>

                  {/* Emotion Column */}
                  <Col span={12}>
                    <Card
                      size="small"
                      title={
                        <Space>
                          <SmileOutlined /> Emotional Analysis
                        </Space>
                      }
                      bordered={false}
                      style={{
                        background: token.colorFillQuaternary,
                        height: "100%",
                      }}
                    >
                      <Row gutter={8}>
                        <Col span={12}>
                          <Statistic
                            title="Avg Sentiment"
                            value={
                              activeChar.metrics.avgSentiment > 0
                                ? "Pos"
                                : "Neg"
                            }
                            prefix={
                              activeChar.metrics.avgSentiment > 0 ? (
                                <SmileOutlined />
                              ) : (
                                <FrownOutlined />
                              )
                            }
                            valueStyle={{
                              color: getSentimentColor(
                                activeChar.metrics.avgSentiment
                              ),
                              fontSize: 18,
                            }}
                          />
                        </Col>
                        <Col span={12}>
                          <Statistic
                            title="Volatility"
                            value={Math.round(
                              activeChar.metrics.volatility * 100
                            )}
                            suffix="%"
                            prefix={<RiseOutlined />}
                            valueStyle={{ fontSize: 18 }}
                          />
                        </Col>
                      </Row>
                      <div style={{ marginTop: 8 }}>
                        <Progress
                          percent={
                            (activeChar.metrics.avgSentiment + 1) * 50
                          } /* Normalizing -1..1 to 0..100 */
                          showInfo={false}
                          size="small"
                          steps={10}
                          strokeColor={[token.colorError, token.colorSuccess]}
                        />
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 10,
                            color: token.colorTextTertiary,
                          }}
                        >
                          <span>Neg</span>
                          <span>Pos</span>
                        </div>
                      </div>
                    </Card>
                  </Col>
                </Row>
              </div>
            )}

            <Divider orientation="left" style={{ fontSize: 13 }}>
              <TagsOutlined /> Characteristics
            </Divider>

            <Paragraph
              type="secondary"
              style={{ fontSize: 13, marginBottom: 24 }}
            >
              {activeChar.description}
            </Paragraph>

            <Divider orientation="left" style={{ fontSize: 13 }}>
              <MessageOutlined /> Dialogue & Scenes
            </Divider>

            {/* Scene Breakdown */}
            <Collapse
              ghost
              accordion
              items={sceneItems}
              expandIconPosition="end"
              size="small"
            />
          </div>
        )}
      </div>
    </div>
  );
};

const SceneOverview = ({
  sceneList = [], // List from Timeline data (id, name, color)
  sceneDetails = {}, // Detailed breakdown keyed by ID
  characterList = [], // Global character list to map IDs to Names/Colors
}) => {
  const { token } = theme.useToken();
  const [selectedId, setSelectedId] = useState(null);

  const activeScene = useMemo(
    () => (selectedId ? sceneDetails[selectedId] : null),
    [selectedId, sceneDetails]
  );

  const activeBasicInfo = useMemo(
    () => sceneList.find((s) => s.id === selectedId),
    [selectedId, sceneList]
  );

  // Helper to get character info by ID
  const getCharInfo = (id) => characterList.find((c) => c.id === id);

  // Helper for Sentiment Color
  const getSentimentColor = (val) => {
    if (val > 0.2) return token.colorSuccess;
    if (val < -0.2) return token.colorError;
    return token.colorWarning;
  };

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: token.colorBgContainer,
      }}
    >
      {/* 1. SELECTION HEADER */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorFillQuaternary,
        }}
      >
        <Select
          style={{ width: "100%" }}
          placeholder="Select a Scene to Analyze"
          onChange={setSelectedId}
          options={sceneList.map((s) => ({
            value: s.id,
            label: (
              <Space>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    backgroundColor: s.color,
                  }}
                />
                {s.name}
              </Space>
            ),
          }))}
        />
      </div>

      {/* 2. CONTENT AREA */}
      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        {!selectedId || !activeScene ? (
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No Scene Selected"
            />
          </div>
        ) : (
          <div>
            {/* Header */}
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <Title level={4} style={{ margin: 0 }}>
                  {activeBasicInfo?.name}
                </Title>
                {activeScene.structuralBeat && (
                  <Tag color="geekblue" icon={<FlagOutlined />}>
                    {activeScene.structuralBeat}
                  </Tag>
                )}
              </div>

              <Space style={{ marginTop: 8 }}>
                <Tag icon={<ClockCircleOutlined />}>{activeScene.duration}</Tag>
                <Tag color={activeScene.type === "Action" ? "red" : "blue"}>
                  {activeScene.type}
                </Tag>
              </Space>
            </div>

            <Paragraph
              type="secondary"
              style={{
                fontStyle: "italic",
                borderLeft: `3px solid ${token.colorBorder}`,
                paddingLeft: 12,
              }}
            >
              {activeScene.synopsis}
            </Paragraph>

            {/* --- METRICS DASHBOARD --- */}
            {activeScene.metrics && (
              <>
                <Divider orientation="left" style={{ fontSize: 13 }}>
                  <BarChartOutlined /> Analysis
                </Divider>
                <Row gutter={[12, 12]}>
                  {/* 1. PACING & DENSITY */}
                  <Col span={12}>
                    <Card
                      size="small"
                      bordered={false}
                      style={{
                        background: token.colorFillQuaternary,
                        height: "100%",
                      }}
                    >
                      <Space
                        direction="vertical"
                        style={{ width: "100%" }}
                        size={0}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 12,
                            marginBottom: 4,
                          }}
                        >
                          <Tooltip title="Subjective narrative speed">
                            <span>
                              <ThunderboltOutlined /> Pacing
                            </span>
                          </Tooltip>
                          <span style={{ fontWeight: "bold" }}>
                            {activeScene.metrics.pacing}/100
                          </span>
                        </div>
                        <Progress
                          percent={activeScene.metrics.pacing}
                          showInfo={false}
                          strokeColor={token.colorPrimary}
                          size="small"
                          style={{ marginBottom: 12 }}
                        />

                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 12,
                            marginBottom: 4,
                          }}
                        >
                          <Tooltip title="Textual Density: Short sentences = High Density">
                            <span>
                              <FontSizeOutlined /> Read Speed
                            </span>
                          </Tooltip>
                          <span style={{ fontWeight: "bold" }}>
                            {activeScene.metrics.linguisticDensity}/100
                          </span>
                        </div>
                        <Progress
                          percent={activeScene.metrics.linguisticDensity}
                          showInfo={false}
                          strokeColor={token.colorWarning}
                          size="small"
                        />
                      </Space>
                    </Card>
                  </Col>

                  {/* 2. COMPOSITION & TONE */}
                  <Col span={12}>
                    <Card
                      size="small"
                      bordered={false}
                      style={{
                        background: token.colorFillQuaternary,
                        height: "100%",
                      }}
                    >
                      {/* Sentiment Meter */}
                      <div style={{ marginBottom: 16 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 12,
                            marginBottom: 4,
                          }}
                        >
                          <span>Tone</span>
                          {activeScene.metrics.sentiment > 0 ? (
                            <SmileOutlined />
                          ) : (
                            <FrownOutlined />
                          )}
                        </div>
                        <div
                          style={{
                            height: 6,
                            borderRadius: 3,
                            background: `linear-gradient(90deg, ${token.colorError} 0%, ${token.colorBgContainer} 50%, ${token.colorSuccess} 100%)`,
                            position: "relative",
                          }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              left: `${
                                (activeScene.metrics.sentiment + 1) * 50
                              }%`,
                              top: -3,
                              width: 12,
                              height: 12,
                              borderRadius: "50%",
                              background: token.colorText,
                              border: `2px solid ${token.colorBgContainer}`,
                              transition: "all 0.3s",
                            }}
                          />
                        </div>
                      </div>

                      {/* Action vs Dialogue */}
                      <div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 12,
                            marginBottom: 4,
                          }}
                        >
                          <span>Action</span>
                          <span>Dialogue</span>
                        </div>
                        <Progress
                          percent={activeScene.metrics.actionRatio}
                          success={{ percent: 0 }}
                          strokeColor={token.colorError}
                          trailColor={token.colorInfoBg}
                          showInfo={false}
                          size="small"
                        />
                      </div>
                    </Card>
                  </Col>
                </Row>
              </>
            )}

            <Divider orientation="left" style={{ fontSize: 13 }}>
              <UserOutlined /> Cast & Focus
            </Divider>

            <div style={{ marginBottom: 16 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Scene Focus (POV)
              </Text>
              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <AimOutlined style={{ color: token.colorTextTertiary }} />
                <Tag color="gold">
                  {getCharInfo(activeScene.focusCharacter)?.name || "Ensemble"}
                </Tag>
              </div>
            </div>

            <List
              header={
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Present Characters
                </Text>
              }
              size="small"
              dataSource={activeScene.characters}
              renderItem={(charId) => {
                const char = getCharInfo(charId);
                return (
                  <List.Item>
                    <List.Item.Meta
                      avatar={
                        <Avatar
                          size="small"
                          style={{
                            backgroundColor: "#" + char?.color.getHexString(),
                          }}
                        />
                      }
                      title={<Text style={{ fontSize: 13 }}>{char?.name}</Text>}
                    />
                  </List.Item>
                );
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export { EditorWindow, CharacterOverview, SceneOverview };
