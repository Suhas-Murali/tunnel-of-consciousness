import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
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

import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import DockLayout from "rc-dock";
import "rc-dock/dist/rc-dock.css";

import { HeaderPropsCommon, GetDashboardButton } from "../components/bars";
import { ScriptSettings } from "../components/settings";
// IMPORTS
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
import { ScriptStateContext } from "../components/contexts";

const { Text } = Typography;

const PANEL_REGISTRY = {
  editor: {
    id: "editor",
    label: "Script Editor",
    icon: <EditOutlined />,
    component: EditorWindow,
  },
  visualizer: {
    id: "visualizer",
    label: "3D Visualizer",
    icon: <FundProjectionScreenOutlined />,
    component: Visualizer,
  },
  timeline: {
    id: "timeline",
    label: "Timeline",
    icon: <FieldTimeOutlined />,
    component: Timeline,
  },
  char_overview: {
    id: "char_overview",
    label: "Character Overview",
    icon: <TeamOutlined />,
    component: CharacterOverview,
  },
  scene_overview: {
    id: "scene_overview",
    label: "Scene Overview",
    icon: <VideoCameraOutlined />,
    component: SceneOverview,
  },
  story_overview: {
    id: "story_overview",
    label: "Story Overview",
    icon: <ProjectOutlined />,
    component: StoryOverview,
  },
};

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

// Wrapper to handle Active Panel clicking without re-rendering everything
const PanelWrapper = ({ id, children }) => {
  const { activePanelId, setActivePanelId } =
    React.useContext(ScriptStateContext);
  const { token } = theme.useToken();
  return (
    <div
      onClickCapture={() => setActivePanelId(id)}
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        boxShadow:
          activePanelId === id
            ? `inset 0 0 0 2px ${token.colorPrimary}`
            : "none",
        transition: "box-shadow 0.2s ease",
      }}
    >
      {children}
    </div>
  );
};

const ScriptPage = () => {
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const { name: scriptId } = useParams();
  const { user } = useOutletContext();

  const dockRef = useRef(null);
  const [script, setScript] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Global State
  const [currentTime, setCurrentTime] = useState(0);
  const [focusRequest, setFocusRequest] = useState(null);
  const [activePanelId, setActivePanelId] = useState(null);

  // Yjs
  const [provider, setProvider] = useState(null);
  const [isSynced, setIsSynced] = useState(false);

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

  const getStorageKey = (id) => `tunnel_layout_${id}`;

  useEffect(() => {
    setProvider(null);
    setIsSynced(false);
    const ydoc = new Y.Doc();
    const newProvider = new HocuspocusProvider({
      url: import.meta.env.VITE_HOCUSPOCUS_URL || "ws://localhost:5050",
      name: scriptId || "default-script",
      document: ydoc,
    });
    newProvider.on("synced", () => setIsSynced(true));
    setProvider(newProvider);
    return () => {
      newProvider.destroy();
      ydoc.destroy();
    };
  }, [scriptId]);

  const handleScriptDeleted = async () => {
    await deleteScript(scriptId);
    localStorage.removeItem(getStorageKey(scriptId));
    navigate("/dashboard");
  };

  const createTabTitle = useCallback(
    (title, id) => (
      <div style={{ display: "flex", alignItems: "center" }}>
        <Text strong={true}>{title}</Text>
        <CloseOutlined
          className="dock-custom-close-btn"
          style={{ fontSize: 12, marginLeft: 8, cursor: "pointer" }}
          onClick={(e) => {
            e.stopPropagation();
            if (dockRef.current)
              dockRef.current.dockMove(
                dockRef.current.find(id),
                null,
                "remove"
              );
          }}
        />
      </div>
    ),
    []
  );

  const createPanel = useCallback(
    (type, existingId = null) => {
      const registryItem = PANEL_REGISTRY[type];
      if (!registryItem)
        return { id: Date.now(), title: "Unknown", content: <Empty /> };

      const id = existingId || `${type}-${Date.now()}`;
      const Component = registryItem.component;

      return {
        id: id,
        title: createTabTitle(registryItem.label, id),
        content: (
          // PanelWrapper is key: It (and Component inside) consumes Context.
          // We do NOT pass dynamic props here.
          <PanelWrapper id={id}>
            <Component
              user={user}
              script={script}
              provider={provider}
              token={token}
            />
          </PanelWrapper>
        ),
        closable: false,
        group: "locked",
      };
    },
    [scriptId, token, provider, user]
  );

  const getInitialLayout = () => ({
    dockbox: {
      mode: "vertical",
      children: [
        {
          mode: "horizontal",
          size: 800,
          children: [
            {
              id: "visualizer-group",
              group: "locked",
              tabs: [createPanel("visualizer")],
              size: 600,
            },
            {
              id: "editor-group",
              group: "locked",
              tabs: [createPanel("editor"), createPanel("char_overview")],
              size: 800,
            },
          ],
        },
        {
          id: "timeline-group",
          group: "locked",
          tabs: [createPanel("timeline")],
          size: 150,
        },
      ],
    },
  });

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
        return hydrateLayout(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
    return getInitialLayout();
  }, [scriptId, hydrateLayout]);

  const [layoutConfig, setLayoutConfig] = useState(null);

  useEffect(() => {
    if (isSynced && provider) {
      const layout = loadLayout();
      setLayoutConfig(layout);
      loadScriptData();
    }
  }, [scriptId, loadLayout, isSynced, provider]);

  const handleLayoutChange = (newLayout) => {
    const cleanJSON = JSON.stringify(newLayout, (k, v) => {
      if (k === "content" || k === "title" || k === "parent") return undefined;
      return v;
    });
    localStorage.setItem(getStorageKey(scriptId), cleanJSON);
  };

  const addWindow = (type) => {
    if (!dockRef.current) return;
    const newPanel = createPanel(type);
    dockRef.current.dockMove(newPanel, activePanelId || null, "middle");
  };

  const menuItems = useMemo(
    () =>
      Object.entries(PANEL_REGISTRY).map(([key, config]) => ({
        key: `${key}-tab`,
        label: config.label,
        icon: <PlusSquareOutlined />,
        onClick: () => addWindow(key),
      })),
    [addWindow]
  );

  if (!isSynced || !provider) return <CenteredLoader height="100vh" />;
  if (loading && !script) return <CenteredLoader />;

  return (
    <ScriptStateContext.Provider
      value={{
        currentTime,
        setCurrentTime,
        focusRequest,
        setFocusRequest,
        activePanelId,
        setActivePanelId,
      }}
    >
      <div
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          background: token.colorBgLayout,
        }}
      >
        <style>{getDockThemeStyles(token)}</style>

        <div
          style={{
            padding: "8px 16px",
            background: token.colorBgContainer,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <Button
              type="text"
              icon={<CodeSandboxOutlined style={{ fontSize: 20 }} />}
              onClick={() => navigate(`/script`)}
            />
            <Text style={{ marginLeft: "12px" }}>{script?.name}</Text>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Space>
              <Dropdown menu={{ items: menuItems }} trigger={["click"]}>
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

        <div style={{ flex: 1, position: "relative" }}>
          {layoutConfig && (
            <DockLayout
              ref={dockRef}
              defaultLayout={layoutConfig}
              onLayoutChange={handleLayoutChange}
              style={{ position: "absolute", inset: 0 }}
              groups={{
                locked: {
                  floatable: false,
                  maximizable: false,
                  closable: false,
                },
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
    </ScriptStateContext.Provider>
  );
};

export const Script = {
  Page: ScriptPage,
  GetHeaderProps: (c) => ({
    ...HeaderPropsCommon,
    rightItems: [GetDashboardButton(c)],
    breadcrumbs: true,
    hidden: true,
  }),
};
