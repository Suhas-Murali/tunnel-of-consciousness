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
		</Layout>
	);
};
