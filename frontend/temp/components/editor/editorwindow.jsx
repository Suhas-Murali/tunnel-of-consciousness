import { useState } from "react";
import { Layout, Tabs, theme } from "antd";
import { UserOutlined, AppstoreOutlined } from "@ant-design/icons";

import { ScriptEditor } from "./scripteditor";
import { CharacterOverview } from "./characteroverview";
import { SceneOverview } from "./sceneoverview";
import { CenteredLoader } from "../loader";

const { Sider, Content } = Layout;

export const EditorWindow = ({ provider }) => {
  const { token } = theme.useToken();
  const [collapsed, setCollapsed] = useState(false);

  if (!provider) return <CenteredLoader height="100%" />;

  const toggleSider = () => setCollapsed(!collapsed);

  return (
    <Layout style={{ height: "100%" }}>
      <Content
        style={{
          height: "100%",
          borderRight: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <ScriptEditor
          key={provider.document.guid}
          provider={provider}
          onSiderCollapse={toggleSider}
        />
      </Content>

      <Sider
        width={350}
        theme="light"
        collapsible
        collapsed={collapsed}
        collapsedWidth={0}
        trigger={null}
        style={{ borderLeft: `1px solid ${token.colorBorder}` }}
      >
        <Tabs
          defaultActiveKey="1"
          centered
          items={[
            {
              key: "1",
              label: (
                <span>
                  <UserOutlined />
                  {!collapsed && "Cast"}
                </span>
              ),
              children: <CharacterOverview provider={provider} />,
            },
            {
              key: "2",
              label: (
                <span>
                  <AppstoreOutlined />
                  {!collapsed && "Scenes"}
                </span>
              ),
              children: <SceneOverview provider={provider} />,
            },
          ]}
          style={{ height: "100%" }}
          tabBarStyle={{ margin: 0, background: token.colorFillQuaternary }}
        />
      </Sider>
    </Layout>
  );
};
