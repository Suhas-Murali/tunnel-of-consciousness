import { useState, useRef, useEffect } from "react";
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

import DockLayout from "rc-dock";
import "rc-dock/dist/rc-dock.css";

import { GetDashboardButton, HeaderPropsCommon } from "../components/bars";
import { ScriptSettings } from "../components/settings";
import Editor from "../components/editor";
import { deleteScript } from "../../api";

const { Text } = Typography;

// ==========================================
// DYNAMIC THEME GENERATOR
// ==========================================
const getDockThemeStyles = (token) => `
  .dock-layout {
    background: ${token.colorBgLayout} !important;
  }
  
  .dock-panel {
    background: ${token.colorBgContainer};
    border: 1px solid ${token.colorBorderSecondary};
  }
  
  .dock-layout .dock-bar {
    background: ${token.colorBgLayout} !important;
    border-bottom: 1px solid ${token.colorBorderSecondary};
    padding-left: 2px;
    height: 36px;
  }
  
  .dock-btn, 
  .dock-tab-hit-area .dock-btn, 
  .dock-nav-operations .dock-btn {
    display: none !important; 
    width: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    opacity: 0 !important;
    pointer-events: none !important;
  }

  .dock-tab {
    background: transparent;
    color: ${token.colorTextSecondary};
    border: 1px solid transparent;
    border-bottom: none;
    margin-right: 2px;
    border-radius: ${token.borderRadius}px ${token.borderRadius}px 0 0;
    padding: 0 12px;
    transition: all 0.2s;
    min-width: auto; 
    height: 35px;
    display: flex;
    align-items: center;
  }
  
  .dock-tab > div {
    display: flex;
    align-items: center;
  }

  .dock-tab:hover {
    color: ${token.colorText};
    background: ${token.colorFillTertiary}; 
  }
  
  .dock-tab-active {
    background: ${token.colorBgContainer} !important;
    color: ${token.colorPrimary} !important;
    border: 1px solid ${token.colorBorderSecondary};
    border-bottom: 1px solid ${token.colorBgContainer}; 
    z-index: 1; 
    font-weight: 500;
  }
  
  .dock-tab-active:after {
    display: none !important;
  }
  
  .dock-tab-pane {
    background: ${token.colorBgContainer};
    color: ${token.colorText};
  }

  .dock-divider {
    background: ${token.colorBorderSecondary} !important; 
    width: 4px;
  }

  .dock-dropdown-menu {
    background: ${token.colorBgElevated};
    border: 1px solid ${token.colorBorderSecondary};
  }
`;

const VisualizerPlaceholder = ({ token }) => (
  <div
    style={{
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: token.colorBgContainer,
    }}
  >
    <Result
      status="info"
      title="Visualizer"
      subTitle="Timeline visualization engine"
    />
  </div>
);

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

  const handleScriptDeleted = async () => {
    try {
      await deleteScript(scriptId);
      message.success("Script deleted.");
      navigate("/dashboard");
    } catch (err) {
      message.error("Failed to delete script.");
    }
  };

  const createTabTitle = (title, id) => (
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
            dockRef.current.dockMove(dockRef.current.find(id), null, "remove");
        }}
        onMouseDown={(e) => e.stopPropagation()}
      />
    </div>
  );

  const createPanel = (type) => {
    const id = `${type}-${Date.now()}`;
    const titleText = type === "editor" ? "Script Editor" : "Visualizer";

    return {
      id: id,
      title: createTabTitle(titleText, id),
      content:
        type === "editor" ? (
          <Editor documentName={scriptId} />
        ) : (
          <VisualizerPlaceholder token={token} />
        ),
      closable: false,
      group: "locked",
    };
  };

  // --- LAYOUT STATE MANAGEMENT ---

  // Initial Layout: Visualizer (Left) | Editor (Right)
  const getInitialLayout = () => {
    return {
      dockbox: {
        mode: "horizontal",
        children: [
          {
            id: "visualizer-group",
            group: "locked", // Enforce config
            tabs: [createPanel("visualizer")],
            size: 650,
          },
          {
            id: "editor-group",
            group: "locked", // Enforce config
            tabs: [createPanel("editor")],
            size: 800,
          },
        ],
      },
    };
  };

  const [layoutConfig, setLayoutConfig] = useState(getInitialLayout());
  const [dockKey, setDockKey] = useState(0);

  useEffect(() => {
    setLayoutConfig(getInitialLayout());
    setDockKey((prev) => prev + 1);
  }, [scriptId]);

  /**
   * Adds a window to the dock.
   */
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
            {
              id: `group-${Date.now()}`,
              group: "locked",
              tabs: [newPanel],
            },
          ],
        },
      };

      setLayoutConfig(freshLayout);
      setDockKey((prev) => prev + 1);
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
        <DockLayout
          key={`${scriptId}-${dockKey}`}
          ref={dockRef}
          defaultLayout={layoutConfig}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
          }}
          groups={{
            locked: {
              floatable: false,
              maximizable: false,
              closable: false,
            },
          }}
        />
      </div>

      {/* SETTINGS MODAL */}
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
  };
};

export const Script = {
  Page: ScriptPage,
  GetHeaderProps,
};
