import { useState, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Outlet,
  useLocation,
  matchPath,
  useNavigate,
} from "react-router-dom";
import { ConfigProvider, Layout, theme, Spin, Button, Result } from "antd";

const { Content, Footer } = Layout;
import { TOC } from "./temp/toc";
import { getProfile } from "./api";

const MainLayout = () => {
  const {
    token: { colorBgContainer, colorBgLayout },
  } = theme.useToken();

  const location = useLocation();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState({});

  const context = {
    isLoggedIn,
    setIsLoggedIn,
    user,
    navigate,
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        setIsLoading(true);
        const res = await getProfile();
        setUser(res.data);
        console.log(user);
        setIsLoggedIn(true);
      } catch (error) {
        setIsLoggedIn(false);
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  const headerConfig = {
    "/": TOC.Home.GetHeaderProps,
    "/auth/login": TOC.Login.GetHeaderProps,
    "/auth/signup": TOC.Signup.GetHeaderProps,
    "/script": TOC.Dashboard.GetHeaderProps,
    "/script/*": TOC.Script.GetHeaderProps,
    "/notfound": TOC.NotFound.GetHeaderProps,
  };

  const getHeaderProps = (pathname) => {
    for (const path in headerConfig) {
      const match = matchPath(path, pathname);
      if (match) {
        return {
          ...headerConfig[path](context),
          params: match.params,
        };
      }
    }
    return headerConfig["/notfound"](context);
  };

  const headerProps = getHeaderProps(location.pathname);

  return isLoading ? (
    <TOC.Loader.CenteredLoader />
  ) : (
    <Layout style={{ minHeight: "100vh", background: colorBgLayout }}>
      <TOC.Header {...headerProps}></TOC.Header>

      <Content>
        <Outlet context={{ isLoggedIn, setIsLoggedIn, user }} />
      </Content>

      <Footer style={{ textAlign: "center", background: colorBgContainer }}>
        TOC © {new Date().getFullYear()}
      </Footer>
    </Layout>
  );
};

const App = () => {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: "#1677ff",
        },
      }}
    >
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<TOC.Home.Page />} />

            <Route path="auth">
              <Route path="login" element={<TOC.Login.Page />} />
              <Route path="signup" element={<TOC.Signup.Page />} />
            </Route>

            <Route path="script">
              <Route index element={<TOC.Dashboard.Page />} />
              <Route path=":name" element={<TOC.Script.Page />} />
            </Route>
            {/* <Route path="profile" element={<TOC.Profile.Page />} /> */}

            <Route path="*" element={<TOC.NotFound.Page />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
};

export default App;
