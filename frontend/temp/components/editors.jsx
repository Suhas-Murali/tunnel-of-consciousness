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
import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { CenteredLoader } from "./loader";

const { Text, Title, Paragraph } = Typography;

// --- CSS Styles (Unchanged) ---
const getEditorStyles = (token) => `
  .ProseMirror {
    outline: none;
    min-height: 100%;
    padding: 24px 40px;
    font-family: 'Courier Prime', 'Courier New', monospace; 
    font-size: 16px;
    line-height: 1.6;
    color: ${token.colorTextLG}; 
    background-color: ${token.colorBgContainer};
    box-sizing: border-box;
  }
  .ProseMirror p.is-editor-empty:first-child::before {
    color: ${token.colorTextQuaternary};
    content: attr(data-placeholder);
    float: left;
    height: 0;
    pointer-events: none;
  }
  .ProseMirror p { position: relative; margin-bottom: 1rem; }
  .collaboration-cursor__caret {
    border-left: 1px solid ${token.colorText};
    border-right: 1px solid ${token.colorText};
    margin-left: -1px;
    margin-right: -1px;
    pointer-events: none;
    position: relative;
    word-break: normal;
  }
  .collaboration-cursor__label {
    border-radius: 3px 3px 3px 0;
    color: ${token.colorWhite};
    font-size: 12px;
    font-weight: 600;
    left: -1px;
    padding: 0.1rem 0.3rem;
    position: absolute;
    top: -1.4em;
    user-select: none;
    white-space: nowrap;
    z-index: 1;
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
        <Tooltip title="Bold">
          <Button
            type={editor.isActive("bold") ? "primary" : "text"}
            icon={<BoldOutlined />}
            onClick={() => editor.chain().focus().toggleBold().run()}
          />
        </Tooltip>
        <Tooltip title="Italic">
          <Button
            type={editor.isActive("italic") ? "primary" : "text"}
            icon={<ItalicOutlined />}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          />
        </Tooltip>
        <Tooltip title="Strike">
          <Button
            type={editor.isActive("strike") ? "primary" : "text"}
            icon={<StrikethroughOutlined />}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          />
        </Tooltip>
        <Divider orientation="vertical" />
        <Tooltip title="Undo">
          <Button
            type="text"
            icon={<UndoOutlined />}
            onClick={() => editor.chain().focus().undo().run()}
          />
        </Tooltip>
        <Tooltip title="Redo">
          <Button
            type="text"
            icon={<RedoOutlined />}
            onClick={() => editor.chain().focus().redo().run()}
          />
        </Tooltip>
        <Divider orientation="vertical" />
        <Tooltip title="Identify Character">
          <Button disabled type="text" icon={<HighlightOutlined />} />
        </Tooltip>
      </Space>
    </div>
  );
};

// Now accepts `provider` as a prop
const ScriptEditor = ({ provider }) => {
  const { user } = useOutletContext() || {
    user: { username: "Guest", color: "#555" },
  };
  const { token } = theme.useToken();

  const editor = useEditor(
    {
      content: null,
      extensions: [
        StarterKit.configure({ undoRedo: false }),
        // Connect to the shared document passed from parent
        Collaboration.configure({ document: provider.document }),
        // Connect cursors to the shared provider passed from parent
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
          overflow: "hidden",
          backgroundColor: token.colorBgContainer,
        }}
        styles={{
          body: {
            padding: 0,
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            backgroundColor: token.colorBgContainer,
          },
        }}
      >
        <EditorToolbar editor={editor} token={token} />

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            cursor: "text",
            backgroundColor: token.colorBgContainer,
          }}
          onClick={() => editor?.commands.focus()}
        >
          <EditorContent
            editor={editor}
            style={{ minHeight: "100%", height: "100%" }}
          />
        </div>

        {editor && (
          <BubbleMenu editor={editor}>
            <Card size="small" style={{ boxShadow: token.boxShadowSecondary }}>
              <Space size={0}>
                <Button
                  size="small"
                  type="text"
                  icon={<BoldOutlined />}
                  onClick={() => editor.chain().focus().toggleBold().run()}
                />
                <Button
                  size="small"
                  type="text"
                  icon={<ItalicOutlined />}
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                />
              </Space>
            </Card>
          </BubbleMenu>
        )}
      </Card>
    </>
  );
};

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
