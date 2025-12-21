import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import {
  Result,
  Button,
  Dropdown,
  Modal,
  Space,
  Typography,
  message,
  Tooltip,
  theme,
} from "antd";
import {
  AppstoreAddOutlined,
  SettingOutlined,
  BorderRightOutlined,
  BorderBottomOutlined,
  PlusSquareOutlined,
  CloseOutlined,
} from "@ant-design/icons";

// YJS Imports
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";

import DockLayout from "rc-dock";
import "rc-dock/dist/rc-dock.css";

import { GetDashboardButton, HeaderPropsCommon } from "../components/bars";
import { ScriptSettings } from "../components/settings";
import { EditorWindow as Editor } from "../components/editors";
import { Visualizer } from "../components/visualizations";
import { CenteredLoader } from "../components/loader"; // Ensure this exists
import { deleteScript } from "../../api";

const { Text } = Typography;

// ... [getDockThemeStyles remains exactly the same] ...
const getDockThemeStyles = (token) => `
  .dock-layout { background: ${token.colorBgLayout} !important; }
  .dock-panel { background: ${token.colorBgContainer}; border: 1px solid ${token.colorBorderSecondary}; }
  .dock-layout .dock-bar { background: ${token.colorBgLayout} !important; border-bottom: 1px solid ${token.colorBorderSecondary}; padding-left: 2px; height: 36px; }
  .dock-btn, .dock-tab-hit-area .dock-btn, .dock-nav-operations .dock-btn { display: none !important; width: 0 !important; margin: 0 !important; padding: 0 !important; opacity: 0 !important; pointer-events: none !important; }
  .dock-tab { background: transparent; color: ${token.colorTextSecondary}; border: 1px solid transparent; border-bottom: none; margin-right: 2px; border-radius: ${token.borderRadius}px ${token.borderRadius}px 0 0; padding: 0 12px; transition: all 0.2s; min-width: auto; height: 35px; display: flex; align-items: center; }
  .dock-tab > div { display: flex; align-items: center; }
  .dock-tab:hover { color: ${token.colorText}; background: ${token.colorFillTertiary}; }
  .dock-tab-active { background: ${token.colorBgContainer} !important; color: ${token.colorPrimary} !important; border: 1px solid ${token.colorBorderSecondary}; border-bottom: 1px solid ${token.colorBgContainer}; z-index: 1; font-weight: 500; }
  .dock-tab-active:after { display: none !important; }
  .dock-tab-pane { background: ${token.colorBgContainer}; color: ${token.colorText}; }
  .dock-divider { background: ${token.colorBorderSecondary} !important; width: 4px; }
  .dock-dropdown-menu { background: ${token.colorBgElevated}; border: 1px solid ${token.colorBorderSecondary}; }
`;

// ==========================================
// MAIN SCRIPT PAGE
// ==========================================
const ScriptPage = () => {
  const navigate = useNavigate();
  const { name: scriptId } = useParams();
  const { user } = useOutletContext();
  const dockRef = useRef(null);
  const { token } = theme.useToken();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // YJS State
  const [provider, setProvider] = useState(null);
  const [isSynced, setIsSynced] = useState(false);

  // Helper for LocalStorage Key
  const getStorageKey = (id) => `tunnel_layout_${id}`;

  // 1. Initialize YJS Provider on Mount
  useEffect(() => {
    // Clean up previous provider if scriptId changes quickly
    setProvider(null);
    setIsSynced(false);

    const ydoc = new Y.Doc();
    const newProvider = new HocuspocusProvider({
      url: "ws://localhost:5050", // Your websocket URL
      name: scriptId || "default-script",
      document: ydoc,
    });

    newProvider.on("synced", () => {
      console.log("YJS Synced successfully");
      setIsSynced(true);
    });

    setProvider(newProvider);

    return () => {
      newProvider.destroy();
      ydoc.destroy();
    };
  }, [scriptId]);

  const handleScriptDeleted = async () => {
    try {
      await deleteScript(scriptId);
      localStorage.removeItem(getStorageKey(scriptId));
      message.success("Script deleted.");
      navigate("/dashboard");
    } catch (err) {
      message.error("Failed to delete script.");
    }
  };

  // --- TAB & PANEL CREATION HELPERS ---

  const createTabTitle = useCallback(
    (title, id) => (
      <div style={{ display: "flex", alignItems: "center" }}>
        <Text strong={true}>{title}</Text>
        <CloseOutlined
          className="dock-custom-close-btn"
          style={{
            fontSize: 12,
            color: token.colorTextTertiary,
            cursor: "pointer",
            marginLeft: 8,
            padding: "4px",
            borderRadius: "4px",
          }}
          onMouseEnter={(e) => (e.target.style.color = token.colorError)}
          onMouseLeave={(e) => (e.target.style.color = token.colorTextTertiary)}
          onClick={(e) => {
            e.stopPropagation();
            if (dockRef.current)
              dockRef.current.dockMove(
                dockRef.current.find(id),
                null,
                "remove"
              );
          }}
          onMouseDown={(e) => e.stopPropagation()}
        />
      </div>
    ),
    [token]
  );

  /**
   * Creates a panel object.
   * NOW ACCEPTS THE PROVIDER to pass down to children
   */
  const createPanel = useCallback(
    (type, existingId = null) => {
      const id = existingId || `${type}-${Date.now()}`;
      const titleText = type === "editor" ? "Script Editor" : "Visualizer";

      return {
        id: id,
        title: createTabTitle(titleText, id),
        content:
          type === "editor" ? (
            // PASS PROVIDER HERE
            <Editor documentName={scriptId} provider={provider} />
          ) : (
            // PASS PROVIDER HERE (for future use in Visualizer)
            <Visualizer token={token} provider={provider} />
          ),
        closable: false,
        group: "locked",
      };
    },
    [scriptId, token, createTabTitle, provider]
  );

  // --- LAYOUT STORAGE & HYDRATION ---

  const getInitialLayout = () => {
    return {
      dockbox: {
        mode: "horizontal",
        children: [
          {
            id: "visualizer-group",
            group: "locked",
            tabs: [createPanel("visualizer")],
            size: 650,
          },
          {
            id: "editor-group",
            group: "locked",
            tabs: [createPanel("editor")],
            size: 800,
          },
        ],
      },
    };
  };

  const hydrateLayout = useCallback(
    (layout) => {
      const walk = (box) => {
        if (box.children) box.children.forEach(walk);
        if (box.tabs) {
          box.tabs.forEach((tab) => {
            const isEditor = tab.id.startsWith("editor");
            const type = isEditor ? "editor" : "visualizer";

            // Re-create the panel properties with the CURRENT provider
            const hydratedPanel = createPanel(type, tab.id);

            tab.title = hydratedPanel.title;
            tab.content = hydratedPanel.content;
            tab.closable = false;
            tab.group = "locked";
          });
        }
      };
      if (layout.dockbox) walk(layout.dockbox);
      return layout;
    },
    [createPanel]
  );

  const loadLayout = useCallback(() => {
    const key = getStorageKey(scriptId);
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return hydrateLayout(parsed);
      } catch (e) {
        console.error("Failed to parse saved layout:", e);
      }
    }
    return getInitialLayout();
  }, [scriptId, hydrateLayout]);

  const [layoutConfig, setLayoutConfig] = useState(null);
  const [dockKey, setDockKey] = useState(0);

  // Initialize Layout ONLY when provider is ready
  useEffect(() => {
    if (isSynced && provider) {
      const layout = loadLayout();
      setLayoutConfig(layout);
      // Force dock remount when we finally have the provider ready
      setDockKey((prev) => prev + 1);
    }
  }, [scriptId, loadLayout, isSynced, provider]);

  const handleLayoutChange = (newLayout) => {
    const key = getStorageKey(scriptId);
    const cleanJSON = JSON.stringify(newLayout, (k, v) => {
      if (k === "content" || k === "title" || k === "parent") return undefined;
      return v;
    });
    localStorage.setItem(key, cleanJSON);
  };

  const addWindow = (type, direction = "middle") => {
    const dock = dockRef.current;
    if (!dock) return;

    const newPanel = createPanel(type);
    const layout = dock.saveLayout ? dock.saveLayout() : dock.layout;

    const hasAnyTabs = (node) => {
      if (!node) return false;
      if (node.tabs && node.tabs.length > 0) return true;
      if (node.children && node.children.length > 0) {
        return node.children.some((child) => hasAnyTabs(child));
      }
      return false;
    };

    const isDockEmpty =
      !layout || !layout.dockbox || !hasAnyTabs(layout.dockbox);

    if (isDockEmpty) {
      const freshLayout = {
        dockbox: {
          mode: "horizontal",
          children: [
            { id: `group-${Date.now()}`, group: "locked", tabs: [newPanel] },
          ],
        },
      };
      setLayoutConfig(freshLayout);
      setDockKey((prev) => prev + 1);
      handleLayoutChange(freshLayout);
      return;
    }

    const findFirstGroup = (node) => {
      if (!node) return null;
      if (node.tabs) return node;
      if (node.children) {
        for (const child of node.children) {
          const found = findFirstGroup(child);
          if (found) return found;
        }
      }
      return null;
    };

    const targetGroup = findFirstGroup(layout.dockbox);
    if (targetGroup) {
      dock.dockMove(newPanel, targetGroup.id, direction);
    } else {
      dock.dockMove(newPanel, null, "float");
    }
  };

  const menuItems = [
    {
      key: "grp-editor",
      type: "group",
      label: "Script Editor",
      children: [
        {
          key: "editor-tab",
          label: "Add as Tab",
          icon: <PlusSquareOutlined />,
          onClick: () => addWindow("editor", "middle"),
        },
        {
          key: "editor-split-right",
          label: "Split Right",
          icon: <BorderRightOutlined />,
          onClick: () => addWindow("editor", "right"),
        },
        {
          key: "editor-split-down",
          label: "Split Down",
          icon: <BorderBottomOutlined />,
          onClick: () => addWindow("editor", "bottom"),
        },
      ],
    },
    { type: "divider" },
    {
      key: "grp-vis",
      type: "group",
      label: "Visualizer",
      children: [
        {
          key: "vis-tab",
          label: "Add as Tab",
          icon: <PlusSquareOutlined />,
          onClick: () => addWindow("visualizer", "middle"),
        },
        {
          key: "vis-split-right",
          label: "Split Right",
          icon: <BorderRightOutlined />,
          onClick: () => addWindow("visualizer", "right"),
        },
      ],
    },
  ];

  // RENDER: Show Loader if not synced yet
  if (!isSynced || !provider) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          background: token.colorBgLayout,
        }}
      >
        <CenteredLoader height="100vh" message="Connecting to Tunnel..." />
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: token.colorBgLayout,
      }}
    >
      <style>{getDockThemeStyles(token)}</style>

      {/* TOOLBAR */}
      <div
        style={{
          padding: "8px 16px",
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Space>
          <Dropdown
            menu={{ items: menuItems }}
            trigger={["click"]}
            placement="bottomLeft"
          >
            <Button icon={<AppstoreAddOutlined />}>Add Window</Button>
          </Dropdown>
        </Space>
        <Space>
          <Tooltip title="Script Settings">
            <Button
              type="text"
              icon={
                <SettingOutlined
                  style={{ fontSize: 18, color: token.colorTextSecondary }}
                />
              }
              onClick={() => setIsSettingsOpen(true)}
            />
          </Tooltip>
        </Space>
      </div>

      {/* DOCKING AREA */}
      <div style={{ flex: 1, position: "relative" }}>
        {layoutConfig && (
          <DockLayout
            key={`${scriptId}-${dockKey}`}
            ref={dockRef}
            defaultLayout={layoutConfig}
            onLayoutChange={handleLayoutChange}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              right: 0,
              bottom: 0,
            }}
            groups={{
              locked: { floatable: false, maximizable: false, closable: false },
            }}
          />
        )}
      </div>

      <Modal
        title="Script Settings"
        open={isSettingsOpen}
        onCancel={() => setIsSettingsOpen(false)}
        footer={null}
        width={800}
        destroyOnHidden
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ padding: 24 }}>
          <ScriptSettings
            scriptId={scriptId}
            currentUser={user}
            onDelete={handleScriptDeleted}
          />
        </div>
      </Modal>
    </div>
  );
};

const GetHeaderProps = (context) => {
  return {
    ...HeaderPropsCommon,
    rightItems: [GetDashboardButton(context)],
    breadcrumbs: true,
    autoHide: true,
  };
};

export const Script = {
  Page: ScriptPage,
  GetHeaderProps,
};
