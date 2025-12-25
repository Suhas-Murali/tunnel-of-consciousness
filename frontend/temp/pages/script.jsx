import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import {
  Button,
  Dropdown,
  Modal,
  Space,
  Typography,
  message,
  Tooltip,
  theme,
  Input,
  Empty,
} from "antd";
import {
  AppstoreAddOutlined,
  SettingOutlined,
  BorderRightOutlined,
  BorderBottomOutlined,
  PlusSquareOutlined,
  CloseOutlined,
  EditOutlined,
  FundProjectionScreenOutlined,
  FieldTimeOutlined,
  TeamOutlined,
  VideoCameraOutlined,
  ProjectOutlined,
  CodeSandboxOutlined,
} from "@ant-design/icons";

// YJS Imports
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";

import DockLayout from "rc-dock";
import "rc-dock/dist/rc-dock.css";

import { GetDashboardButton, HeaderPropsCommon } from "../components/bars";
import { ScriptSettings } from "../components/settings";
import {
  EditorWindow,
  SceneOverview,
  CharacterOverview,
  Visualizer,
  Timeline,
  StoryOverview,
} from "../components/editor";
import { CenteredLoader } from "../components/loader";
import { deleteScript, getScriptById } from "../../api";

const { Text } = Typography;

// ==========================================
// 1. PANEL REGISTRY
// ==========================================
const PANEL_REGISTRY = {
  editor: {
    id: "editor",
    label: "Script Editor",
    icon: <EditOutlined />,
    component: EditorWindow,
    defaultGroup: "editor-group",
  },
  visualizer: {
    id: "visualizer",
    label: "3D Visualizer",
    icon: <FundProjectionScreenOutlined />,
    component: Visualizer,
    defaultGroup: "visualizer-group",
  },
  timeline: {
    id: "timeline",
    label: "Timeline",
    icon: <FieldTimeOutlined />,
    component: Timeline,
    defaultGroup: "timeline-group",
  },
  char_overview: {
    id: "char_overview",
    label: "Character Overview",
    icon: <TeamOutlined />,
    component: CharacterOverview,
    defaultGroup: "editor-group",
  },
  scene_overview: {
    id: "scene_overview",
    label: "Scene Overview",
    icon: <VideoCameraOutlined />,
    component: SceneOverview,
    defaultGroup: "visualizer-group",
  },
  story_overview: {
    id: "story_overview",
    label: "Story Overview",
    icon: <ProjectOutlined />,
    component: StoryOverview,
    defaultGroup: "dashboard-group",
  },
};

// ==========================================
// 2. CSS STYLES
// ==========================================
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
  const [script, setScript] = useState(null);
  const [loading, setLoading] = useState(true);

  // State to track the currently selected panel
  const [activePanelId, setActivePanelId] = useState(null);

  const loadScriptData = async () => {
    try {
      setLoading(true);
      const res = await getScriptById(scriptId);
      setScript(res.data.script);
    } catch (err) {
      message.error("Failed to load settings.");
    } finally {
      setLoading(false);
    }
  };

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // YJS State
  const [provider, setProvider] = useState(null);
  const [isSynced, setIsSynced] = useState(false);

  const getStorageKey = (id) => `tunnel_layout_${id}`;

  // 1. Initialize YJS Provider on Mount
  useEffect(() => {
    setProvider(null);
    setIsSynced(false);

    const ydoc = new Y.Doc();
    const newProvider = new HocuspocusProvider({
      url: "ws://localhost:5050",
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

  const createPanel = useCallback(
    (type, existingId = null) => {
      const registryItem = PANEL_REGISTRY[type];

      if (!registryItem) {
        console.warn(`Unknown panel type: ${type}`);
        return {
          id: existingId || `unknown-${Date.now()}`,
          title: "Unknown Panel",
          content: <Empty description="Panel type not found" />,
          closable: true,
          group: "locked",
        };
      }

      const id = existingId || `${type}-${Date.now()}`;
      const Component = registryItem.component;

      return {
        id: id,
        title: createTabTitle(registryItem.label, id),
        // Wrap the component in a div that handles activation and visual feedback
        content: (
          <div
            onClickCapture={() => setActivePanelId(id)}
            style={{
              height: "100%",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              // Visual indicator for active panel
              boxShadow:
                activePanelId === id
                  ? `inset 0 0 0 2px ${token.colorPrimary}`
                  : "none",
              transition: "box-shadow 0.2s ease",
            }}
          >
            <Component
              provider={provider}
              scriptId={scriptId}
              token={token}
              user={user}
              documentName={scriptId}
            />
          </div>
        ),
        closable: false,
        group: "locked",
      };
    },
    [scriptId, token, createTabTitle, provider, user, activePanelId]
  );

  // --- LAYOUT STORAGE & HYDRATION ---

  const getInitialLayout = () => {
    return {
      dockbox: {
        mode: "vertical",
        children: [
          // Top Row
          {
            mode: "horizontal",
            size: 800,
            children: [
              {
                id: "visualizer-group",
                group: "locked",
                tabs: [
                  createPanel("visualizer"),
                  createPanel("scene_overview"),
                ],
                size: 650,
              },
              {
                id: "editor-group",
                group: "locked",
                tabs: [createPanel("editor"), createPanel("char_overview")],
                size: 800,
              },
            ],
          },
          // Bottom Row
          {
            id: "timeline-group",
            group: "locked",
            tabs: [createPanel("timeline")],
            size: 150,
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
            const type = tab.id.split("-")[0];
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

  useEffect(() => {
    if (isSynced && provider) {
      const layout = loadLayout();
      setLayoutConfig(layout);
      setDockKey((prev) => prev + 1);
      loadScriptData();
    }
  }, [scriptId, loadLayout, isSynced, provider]);

  // Force layout update when activePanelId changes to ensure visual feedback renders
  useEffect(() => {
    if (dockRef.current && layoutConfig) {
      // Re-hydrate the current layout state to update the `content` prop with the new active style
      const currentLayout = dockRef.current.saveLayout();
      const hydrated = hydrateLayout(currentLayout);
      dockRef.current.loadLayout(hydrated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePanelId]);

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

    // Logic: Try to add to the active panel if it exists
    if (activePanelId) {
      // We need to verify the panel still exists in the dock
      const targetPanel = dock.find(activePanelId);
      if (targetPanel) {
        dock.dockMove(newPanel, activePanelId, direction);
        return;
      }
    }

    // Fallback: Default logic if no active panel or active panel lost
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

  const menuItems = useMemo(() => {
    return Object.entries(PANEL_REGISTRY).map(([key, config]) => ({
      key: `grp-${key}`,
      type: "group",
      label: config.label,
      children: [
        {
          key: `${key}-tab`,
          label: "Add as Tab",
          icon: <PlusSquareOutlined />,
          onClick: () => addWindow(key, "middle"),
        },
        {
          key: `${key}-split-right`,
          label: "Split Right",
          icon: <BorderRightOutlined />,
          onClick: () => addWindow(key, "right"),
        },
        {
          key: `${key}-split-down`,
          label: "Split Down",
          icon: <BorderBottomOutlined />,
          onClick: () => addWindow(key, "bottom"),
        },
      ],
    }));
  }, [addWindow]);

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

  if (loading && !script) return <CenteredLoader />;

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
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
        }}
      >
        {/* LEFT: Nav Button */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-start",
            alignItems: "center",
          }}
        >
          <Button
            type="text"
            icon={<CodeSandboxOutlined style={{ fontSize: 20 }} />}
            onClick={() => navigate(`/script`)}
          />
          <Text style={{ marginLeft: "12px" }}>{script?.name}</Text>
        </div>

        {/* CENTER: Search Bar */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Input.Search
            placeholder="Search script content, characters, or scenes..."
            allowClear
            style={{ width: 450 }}
          />
        </div>

        {/* RIGHT: Tools & Settings */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Space>
            <Dropdown
              menu={{ items: menuItems }}
              trigger={["click"]}
              placement="bottomRight"
              styles={{ root: { maxHeight: "400px", overflowY: "auto" } }}
            >
              <Button icon={<AppstoreAddOutlined />}>Add Window</Button>
            </Dropdown>
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
            script={script}
            currentUser={user}
            onDelete={handleScriptDeleted}
            loadScriptData={loadScriptData}
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
    hidden: true,
  };
};

export const Script = {
  Page: ScriptPage,
  GetHeaderProps,
};
