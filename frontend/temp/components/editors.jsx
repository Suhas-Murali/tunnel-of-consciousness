import React from "react";
import { useOutletContext } from "react-router-dom";
import { Card, Button, Tooltip, Divider, Space, theme } from "antd";
import {
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
import { CenteredLoader } from "./loader"; // Ensure you have this path correct

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

export { EditorWindow };
