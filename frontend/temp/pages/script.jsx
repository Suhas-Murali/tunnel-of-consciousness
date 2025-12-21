import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import * as THREE from "three";
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
} from "../components/editors";
import {
  Visualizer,
  Timeline,
  StoryOverview,
} from "../components/visualizations";
import { CenteredLoader } from "../components/loader";
import { deleteScript, getScriptById } from "../../api";

const { Text } = Typography;

// ==========================================
// 1. DATA & CONFIG
// ==========================================

const VISUALIZER_CONFIG = {
  length: 100,
  radius: 6,
  baseThickness: 0.05,
};

const MOCK_VISUALIZER_DATA = [
  {
    id: "char-1",
    name: "Commander Shepard",
    emotion: "Determination",
    color: new THREE.Color("#ff0040"),
    significance: 2.0,
    points: [
      [-2, 1, 0],
      [-2.5, 2, 25],
      [-1.5, 0.5, 50],
      [-2, 1, 75],
      [-2, 3, 100],
    ],
  },
  {
    id: "char-2",
    name: "Liara T'Soni",
    emotion: "Grief",
    color: new THREE.Color("#0040ff"),
    significance: 0.8,
    points: [
      [2, -1, 0],
      [2.2, -1.5, 25],
      [1.8, -0.5, 50],
      [2, -2, 75],
      [2.5, -1, 100],
    ],
  },
  {
    id: "char-3",
    name: "Garrus Vakarian",
    emotion: "Supportive",
    color: new THREE.Color("#00ff80"),
    significance: 1.2,
    points: [
      [0.5, 3, 0],
      [0.8, 2.8, 25],
      [0.2, 3.2, 50],
      [0.5, 3, 100],
    ],
  },
  {
    id: "char-4",
    name: "Tali'Zorah",
    emotion: "Curiosity",
    color: new THREE.Color("#ffff00"),
    significance: 1.2,
    points: [
      [0.8, 3.2, 0],
      [1.1, 3.0, 25],
      [0.5, 3.4, 50],
      [0.8, 3.2, 100],
    ],
  },
];

const MOCK_SCENE_DATA = [
  {
    id: "s1",
    name: "Scene 1: The Arrival",
    start: 0,
    end: 20,
    color: "#faad14",
  },
  {
    id: "s2",
    name: "Scene 2: Discussion",
    start: 25,
    end: 55,
    color: "#52c41a",
  },
  {
    id: "s3",
    name: "Scene 3: The Conflict",
    start: 60,
    end: 90,
    color: "#ff4d4f",
  },
];

// --- ENRICHED CHARACTER DATA WITH "VISUAL BLUEPRINT" METRICS ---
const MOCK_CHARACTER_DETAILS = {
  "char-1": {
    role: "Systems Alliance Commander",
    archetype: "The Protagonist",
    traits: ["Paragon", "Determined", "Leader"],
    description:
      "Shepard displays high levels of stress but maintains composure. Voice analysis indicates suppressed urgency.",
    metrics: {
      degreeCentrality: 0.95, // Social hub, connected to everyone
      betweenness: 0.2, // Low betweenness, they are the destination, not the bridge
      avgSentiment: 0.1, // Slightly positive (Determination)
      volatility: 0.8, // High emotional swing
    },
    scenes: [
      {
        sceneId: "s1",
        sceneName: "The Arrival",
        dialogueCount: 3,
        dialogues: [
          "We have to land now, Joker.",
          "I don't care about the regulations.",
          "Get us on the ground.",
        ],
      },
      {
        sceneId: "s3",
        sceneName: "The Conflict",
        dialogueCount: 2,
        dialogues: ["This ends here!", "Make your choice."],
      },
    ],
  },
  "char-2": {
    role: "Prothean Researcher",
    archetype: "The Mentor / Confidant",
    traits: ["Intellectual", "Empathetic", "Biotic"],
    description:
      "Liara is exhibiting signs of deep grief. Her biometrics show elevated heart rate during the discussion of Thessia.",
    metrics: {
      degreeCentrality: 0.6,
      betweenness: 0.8, // High betweenness (Gatekeeper of Prothean info)
      avgSentiment: -0.6, // Negative (Grief)
      volatility: 0.3, // Consistent low mood
    },
    scenes: [
      {
        sceneId: "s2",
        sceneName: "Discussion",
        dialogueCount: 4,
        dialogues: [
          "The patterns... they match the Prothean archives.",
          "I can't believe it's gone.",
          "We must focus on the Crucible.",
          "It is our only hope.",
        ],
      },
    ],
  },
  "char-3": {
    role: "Turian Advisor",
    archetype: "The Lancer",
    traits: ["Loyal", "Tactical", "Calibrating"],
    description:
      "Garrus is acting as a stabilizing force. He is constantly scanning the perimeter.",
    metrics: {
      degreeCentrality: 0.7,
      betweenness: 0.4,
      avgSentiment: 0.5, // Positive/Supportive
      volatility: 0.1, // Very stable
    },
    scenes: [
      {
        sceneId: "s1",
        sceneName: "The Arrival",
        dialogueCount: 2,
        dialogues: ["Scoop looks clear, Commander.", "Just like old times."],
      },
    ],
  },
  "char-4": {
    role: "Quarian Machinist",
    archetype: "The Specialist",
    traits: ["Tech Expert", "Curious", "Loyal"],
    description:
      "Tali is focused on the tech readings. She is notably avoiding eye contact with the Legion unit.",
    metrics: {
      degreeCentrality: 0.5,
      betweenness: 0.3,
      avgSentiment: 0.2,
      volatility: 0.4,
    },
    scenes: [
      {
        sceneId: "s2",
        sceneName: "Discussion",
        dialogueCount: 2,
        dialogues: ["These readings are off the charts.", "Keelah se'lai."],
      },
    ],
  },
};

// --- ENRICHED SCENE DATA ---
const MOCK_SCENE_DETAILS = {
  s1: {
    id: "s1",
    duration: "1m 45s",
    type: "Action",
    structuralBeat: "Inciting Incident", //
    synopsis:
      "The Normandy executes a high-gravity insertion. Shepard orders the shuttle drop despite Joker's warnings. The team lands under heavy fire.",
    focusCharacter: "char-1",
    characters: ["char-1", "char-3"],
    metrics: {
      pacing: 85, // Narrative speed
      linguisticDensity: 92, // "Staccato" / Fast read (Short sentences)
      sentiment: -0.6, // High tension/Negative
      actionRatio: 80, // 80% Action / 20% Dialogue
    },
  },
  s2: {
    id: "s2",
    duration: "3m 10s",
    type: "Exposition",
    structuralBeat: null,
    synopsis:
      "The team regroups in the ruins. Liara discovers ancient Prothean markings that suggest a warning about the Reapers' cycle. Tali analyzes the energy readings.",
    focusCharacter: "char-2",
    characters: ["char-1", "char-2", "char-4"],
    metrics: {
      pacing: 30, // Slow, contemplative
      linguisticDensity: 40, // "Fluid" / Complex sentences
      sentiment: -0.2, // Uneasy mystery
      actionRatio: 10, // 90% Dialogue
    },
  },
  s3: {
    id: "s3",
    duration: "2m 05s",
    type: "Emotional",
    structuralBeat: "Climax", //
    synopsis:
      "A standoff with the Reaper Destroyer. Shepard must choose between calling the fleet or sacrificing the localized relay. High emotional stakes.",
    focusCharacter: "char-1",
    characters: ["char-1", "char-2", "char-3", "char-4"],
    metrics: {
      pacing: 65,
      linguisticDensity: 60, // Balanced
      sentiment: 0.1, // Bitter-sweet/Resolved
      actionRatio: 40,
    },
  },
};

// ==========================================
// 2. PANEL REGISTRY
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
// 3. CSS STYLES
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
        content: (
          <Component
            provider={provider}
            scriptId={scriptId}
            token={token}
            user={user}
            documentName={scriptId}
            visualizerData={MOCK_VISUALIZER_DATA}
            visualizerConfig={VISUALIZER_CONFIG}
            sceneData={MOCK_SCENE_DATA}
            characterList={MOCK_VISUALIZER_DATA}
            characterDetails={MOCK_CHARACTER_DETAILS}
            sceneList={MOCK_SCENE_DATA}
            sceneDetails={MOCK_SCENE_DETAILS}
          />
        ),
        closable: false,
        group: "locked",
      };
    },
    [scriptId, token, createTabTitle, provider, user]
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
          // GRID LAYOUT FOR ROBUST CENTERING
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
