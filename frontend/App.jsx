import {
  BrowserRouter,
  Routes,
  Route,
  Outlet,
  useLocation,
  matchPath,
} from "react-router-dom";
import { ConfigProvider, Layout, theme, Button, Typography } from "antd";
import {
  HomeOutlined,
  UserOutlined,
  BarChartOutlined,
  CodeSandboxSquareFilled,
  CodeSandboxOutlined,
} from "@ant-design/icons";

import { TOCHeader } from "./temp/components/bars";
const { Content, Footer } = Layout;

// Temporary placeholders for demonstration purposes
const Home = () => <h1>Home Page</h1>;
const Login = () => <h1>Login Page</h1>;
const Signup = () => <h1>Signup Page</h1>;
const Dashboard = () => <h1>Dashboard</h1>;
const ScriptView = () => <h1>Script View</h1>;
const ScriptEditor = () => <h1>Script Editor</h1>;
const ScriptAnalysis = () => <h1>Script Analysis</h1>;

const headerConfig = {
  "/": {
    backButton: false,
    headerIcon: <CodeSandboxOutlined />,
    headerTitle: "Tunnel of Consciousness",
    rightItems: [
      <Button type="primary">Login</Button>,
      <Button>Signup</Button>,
    ],
  },
  "/auth/login": {
    title: "Login",
    subTitle: "Access your account",
    hideNav: true, // Example prop to hide navigation elements
  },
  "/auth/signup": {
    title: "Sign Up",
    subTitle: "Create a new account",
    hideNav: true,
  },
  "/dashboard": {
    title: "Dashboard",
    subTitle: "Your projects overview",
    extra: <Button icon={<UserOutlined />}>Profile</Button>,
  },
  // Dynamic Routes
  "/script/:name": {
    title: "Script View",
    subTitle: "Read mode",
    icon: <HomeOutlined />,
  },
  "/script/:name/editor": {
    headerTitle: "Editor",
    backButton: true, // Shows default arrow
    sticky: true,
    // Add items for specific zones
    rightItems: [
      <Button type="primary">Save</Button>,
      <Button>Publish</Button>,
    ],
    // The second row is perfect for toolbars in an editor
    secondRow: (
      <div
        style={{ background: "#f5f5f5", padding: "4px", borderRadius: "4px" }}
      >
        Toolbar: [Bold] [Italic] [Underline]
      </div>
    ),
  },
  "/script/:name/analysis": {
    title: "Script Analysis",
    subTitle: "Metrics & Insights",
    icon: <BarChartOutlined />,
  },
};

const getHeaderProps = (pathname) => {
  for (const path in headerConfig) {
    const match = matchPath(path, pathname);
    if (match) {
      return {
        ...headerConfig[path],
        params: match.params,
      };
    }
  }
  return headerConfig["/"];
};

const MainLayout = () => {
  const {
    token: { colorBgContainer, colorBgLayout },
  } = theme.useToken();

  const location = useLocation();
  const headerProps = getHeaderProps(location.pathname);

  return (
    <Layout style={{ minHeight: "200vh", background: colorBgLayout }}>
      <TOCHeader {...headerProps}></TOCHeader>

      <Content>
        <Outlet />
      </Content>

      <Footer style={{ textAlign: "center" }}>Tunnel of Consciousness.</Footer>
    </Layout>
  );
};

const App = () => {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#1677ff",
        },
      }}
    >
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Home />} />

            <Route path="auth">
              <Route path="login" element={<Login />} />
              <Route path="signup" element={<Signup />} />
            </Route>

            <Route path="dashboard" element={<Dashboard />} />

            <Route path="script/:name">
              <Route index element={<ScriptView />} />
              <Route path="editor" element={<ScriptEditor />} />
              <Route path="analysis" element={<ScriptAnalysis />} />
            </Route>

            <Route path="*" element={<div>404 Not Found</div>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
};

export default App;
