import { useState, useEffect } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { Tabs, Typography, message } from "antd";

import { GetDashboardButton, HeaderPropsCommon } from "../components/bars";
import { ScriptSettings } from "../components/settings";
import Editor from "../components/editor";
import { deleteScript } from "../../api";

const { Title, Text } = Typography;

// ==========================================
// 1. VISUALIZER TAB (Placeholder)
// ==========================================
const ScriptVisualizer = () => {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100%",
        background: "#f5f5f5",
        borderRadius: 8,
        border: "1px dashed #d9d9d9",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <Title level={4}>Visualization Engine</Title>
        <Text type="secondary">
          Timeline and emotion analysis visualization will appear here.
        </Text>
      </div>
    </div>
  );
};

// ==========================================
// MAIN SCRIPT PAGE
// ==========================================
const ScriptPage = () => {
  const navigate = useNavigate();
  const { name: scriptId } = useParams();
  const { user } = useOutletContext();

  const [activeTab, setActiveTab] = useState("editor");

  const handleScriptDeleted = async () => {
    try {
      await deleteScript(scriptId);
      message.success("Script deleted.");
      navigate("/dashboard");
    } catch (err) {
      message.error("Failed to delete script.");
    }
  };

  const items = [
    {
      key: "editor",
      label: "Editor",
      children: (
        <div style={{ height: "100%", width: "100%" }}>
          <Editor documentName={scriptId} />
        </div>
      ),
    },
    {
      key: "visualizer",
      label: "Visualizer",
      children: <ScriptVisualizer />,
    },
    {
      key: "settings",
      label: "Settings",
      children: (
        <ScriptSettings
          scriptId={scriptId}
          currentUser={user}
          onDelete={handleScriptDeleted}
        />
      ),
    },
  ];

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        padding: "0 24px 24px 24px",
      }}
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={items}
        style={{ height: "100%" }}
        tabBarStyle={{ marginBottom: 16, paddingLeft: 12 }}
        className="script-page-tabs"
      />

      {/* Inject CSS to force the Tabs Content to take 100% height.
         Ant Design Tabs default to auto height, which breaks our 
         100% height Editor requirement.
      */}
      <style>{`
        .script-page-tabs {
          display: flex;
          flex-direction: column;
        }
        .script-page-tabs .ant-tabs-content {
          flex: 1;
          height: 100%;
        }
        .script-page-tabs .ant-tabs-tabpane {
          height: 100%;
        }
      `}</style>
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
