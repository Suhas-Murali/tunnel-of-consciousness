import React, { useState, useEffect } from "react";
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
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { CenteredLoader } from "./loader";

// --- CSS styles stay the same as before ---
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
        <Divider type="vertical" />
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

  const cardBodyStyle = {
    padding: 0,
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    backgroundColor: token.colorBgContainer,
  };

  return (
    <>
      <style>{styles}</style>
      <Card
        bordered={false}
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          backgroundColor: token.colorBgContainer,
        }}
        bodyStyle={cardBodyStyle}
        styles={{ body: cardBodyStyle }}
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
          <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }}>
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

const EditorWindow = ({ documentName }) => {
  const [provider, setProvider] = useState(null);
  const [isSynced, setIsSynced] = useState(false);
  const { token } = theme.useToken();

  useEffect(() => {
    const ydoc = new Y.Doc();
    const newProvider = new HocuspocusProvider({
      url: "ws://localhost:5050",
      name: documentName || "default-script",
      document: ydoc,
    });
    newProvider.on("synced", () => setIsSynced(true));
    setProvider(newProvider);
    return () => {
      newProvider.destroy();
      ydoc.destroy();
      setIsSynced(false);
    };
  }, [documentName]);

  if (!provider || !isSynced) {
    return <CenteredLoader height="100%" />;
  }

  return (
    // This wrapper ensures the component takes up all available space
    // If this background color (red/green debug) shows up as a small strip,
    // your PARENT LAYOUT is the problem.
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

export default EditorWindow;
