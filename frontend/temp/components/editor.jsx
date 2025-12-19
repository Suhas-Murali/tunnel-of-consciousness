import { useState, useEffect } from "react";
import { StarterKit } from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { useEditor, EditorContent } from "@tiptap/react";
import { FloatingMenu, BubbleMenu } from "@tiptap/react/menus";

const Editor = ({ provider }) => {
  const editor = useEditor(
    {
      content: "<p>Hello World!</p>",
      extensions: [
        StarterKit.configure({ undoRedo: false }), // Disable history
        Collaboration.configure({
          document: provider.document, // Safe: provider is guaranteed here
        }),
        CollaborationCaret.configure({
          provider,
          user: { name: "John Doe", color: "#ffcc00" },
        }),
      ],
    },
    [provider]
  );

  if (!editor) {
    return null;
  }

  return (
    <>
      <EditorContent editor={editor} />
      {editor && (
        <>
          <FloatingMenu editor={editor}>Floating Menu</FloatingMenu>
          <BubbleMenu editor={editor}>Bubble Menu</BubbleMenu>
        </>
      )}
    </>
  );
};

const Tiptap = ({ documentName }) => {
  const [provider, setProvider] = useState(null);

  useEffect(() => {
    const ydoc = new Y.Doc();
    const newProvider = new HocuspocusProvider({
      url: "ws://localhost:5050",
      name: documentName,
      document: ydoc,
    });

    setProvider(newProvider);

    return () => {
      newProvider.destroy();
      ydoc.destroy();
      setProvider(null);
    };
  }, []);

  if (!provider) {
    return <div>Loading Editor...</div>;
  }

  return <Editor key={provider.document.guid} provider={provider} />;
};

export default Tiptap;
