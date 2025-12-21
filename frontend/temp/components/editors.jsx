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

const CharacterOverview = ({
  characterList = [], // List for the dropdown (id, name, color)
  characterDetails = {}, // Detailed map keyed by ID
}) => {
  const { token } = theme.useToken();
  const [selectedId, setSelectedId] = useState(null);

  // Get the full details for the selected character
  const activeChar = useMemo(
    () => (selectedId ? characterDetails[selectedId] : null),
    [selectedId, characterDetails]
  );

  // Get basic info (color, name) from the list for the header
  const activeBasicInfo = useMemo(
    () => characterList.find((c) => c.id === selectedId),
    [selectedId, characterList]
  );

  const handleSelect = (value) => {
    setSelectedId(value);
  };

  // Prepare items for the Collapse component (Scenes)
  const sceneItems = useMemo(() => {
    if (!activeChar || !activeChar.scenes) return [];

    return activeChar.scenes.map((scene, index) => ({
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
              <div>
                <Title level={4} style={{ margin: 0 }}>
                  {activeBasicInfo?.name}
                </Title>
                <Text type="secondary">{activeChar.role}</Text>
                <div style={{ marginTop: 8 }}>
                  {activeChar.traits.map((trait) => (
                    <Tag key={trait} color="blue" bordered={false}>
                      {trait}
                    </Tag>
                  ))}
                </div>
              </div>
            </div>

            <Divider orientation="left" style={{ fontSize: 13 }}>
              <TagsOutlined /> Observed Characteristics
            </Divider>

            <Paragraph
              type="secondary"
              style={{ fontSize: 13, marginBottom: 24 }}
            >
              {activeChar.description}
            </Paragraph>

            <Divider orientation="left" style={{ fontSize: 13 }}>
              <MessageOutlined /> Dialogue & Scene Presence
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
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "start",
                marginBottom: 20,
              }}
            >
              <div>
                <Title level={4} style={{ margin: 0 }}>
                  {activeBasicInfo?.name}
                </Title>
                <Space style={{ marginTop: 8 }}>
                  <Tag icon={<ClockCircleOutlined />}>
                    {activeScene.duration}
                  </Tag>
                  <Tag color={activeScene.type === "Action" ? "red" : "blue"}>
                    {activeScene.type}
                  </Tag>
                </Space>
              </div>
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

            <Divider orientation="left" style={{ fontSize: 13 }}>
              <ThunderboltOutlined /> Pacing & Tone
            </Divider>

            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Card
                  size="small"
                  bordered={false}
                  style={{ background: token.colorFillQuaternary }}
                >
                  <Statistic
                    title="Intensity / Pacing"
                    value={activeScene.pacing}
                    suffix="/ 100"
                    valueStyle={{
                      color:
                        activeScene.pacing > 70
                          ? token.colorError
                          : token.colorPrimary,
                    }}
                  />
                  <Progress
                    percent={activeScene.pacing}
                    showInfo={false}
                    strokeColor={
                      activeScene.pacing > 70
                        ? token.colorError
                        : token.colorPrimary
                    }
                    size="small"
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card
                  size="small"
                  bordered={false}
                  style={{ background: token.colorFillQuaternary }}
                >
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Composition
                  </Text>
                  <div style={{ marginTop: 8 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12,
                        marginBottom: 4,
                      }}
                    >
                      <span>
                        <ThunderboltOutlined /> Action
                      </span>
                      <span>
                        <CommentOutlined /> Dialogue
                      </span>
                    </div>
                    <Progress
                      percent={activeScene.composition.action}
                      success={{ percent: 0 }}
                      strokeColor={token.colorWarning}
                      trailColor={token.colorInfoBg} // Using blueish bg for dialogue
                      showInfo={false}
                    />
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 10,
                        color: token.colorTextTertiary,
                        marginTop: 2,
                      }}
                    >
                      <span>{activeScene.composition.action}%</span>
                      <span>{100 - activeScene.composition.action}%</span>
                    </div>
                  </div>
                </Card>
              </Col>
            </Row>

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
