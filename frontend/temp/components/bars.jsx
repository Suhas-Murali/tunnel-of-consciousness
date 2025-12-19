import React from "react";
import { Layout, Button, Space, Typography, theme } from "antd";
import { ArrowLeftOutlined, CodeSandboxOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { logout } from "../../api";

const { Header: AntHeader } = Layout;
const { Title } = Typography;

/**
 * @param {boolean | React.ReactNode} backButton - Show default back button (true) or custom component.
 * @param {function | null} backButtonAction - Function to run on back click. Defaults to navigate(-1).
 * @param {React.ReactNode} headerIcon - Main icon. Pass a component (e.g., <UserOutlined />).
 * @param {function | null} headerIconAction - Function to run on icon click. Defaults to navigate('/').
 * @param {string} headerTitle - Title text displayed next to the icon.
 * @param {Array<React.ReactNode>} leftItems - Components to render immediately after the title.
 * @param {Array<React.ReactNode>} centerItems - Components to render in the center of the header.
 * @param {Array<React.ReactNode>} rightItems - Components to render on the far right.
 * @param {React.ReactNode} secondRow - A component to render in a second row (increases height).
 * @param {boolean} hidden - If true, returns null.
 * @param {boolean} sticky - If true, fixes header to top with z-index.
 * @param {object} style - Custom CSS overrides.
 */
const Header = ({
  backButton = false,
  backButtonAction,
  headerIcon,
  headerIconAction,
  headerTitle,
  leftItems = [],
  centerItems = [],
  rightItems = [],
  secondRow,
  hidden = false,
  sticky = false,
  style = {},
}) => {
  const navigate = useNavigate();
  const {
    token: { colorBgContainer, paddingMD, paddingXS, colorBorderSecondary },
  } = theme.useToken();

  if (hidden) return null;

  const handleBack = backButtonAction || (() => navigate(-1));
  const handleIconClick = headerIconAction || (() => navigate("/"));

  const baseHeight = secondRow ? "auto" : 64;
  const stickyStyle = sticky
    ? { position: "sticky", top: 0, zIndex: 1000, width: "100%" }
    : {};

  return (
    <AntHeader
      style={{
        padding: `0 ${paddingMD}px`,
        background: colorBgContainer,
        height: baseHeight,
        lineHeight: "normal",
        borderBottom: `1px solid ${colorBorderSecondary}`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        ...stickyStyle,
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 64,
          width: "100%",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: paddingXS }}>
          {/* 1. Back Button */}
          {backButton === true ? (
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={handleBack}
            />
          ) : (
            backButton
          )}

          {headerIcon && (
            <Button
              type="text"
              icon={headerIcon}
              onClick={handleIconClick}
              size="large"
            />
          )}

          {headerTitle && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                cursor: "pointer",
              }}
              onClick={handleIconClick}
            >
              <Typography.Title
                level={4}
                style={{ margin: 0, lineHeight: "unset" }}
              >
                {headerTitle}
              </Typography.Title>
            </div>
          )}

          {leftItems.length > 0 && (
            <Space style={{ marginLeft: paddingXS }}>
              {leftItems.map((item, index) => (
                <React.Fragment key={index}>{item}</React.Fragment>
              ))}
            </Space>
          )}
        </div>

        {centerItems.length > 0 && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
            }}
          >
            <Space>
              {centerItems.map((item, index) => (
                <React.Fragment key={index}>{item}</React.Fragment>
              ))}
            </Space>
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
          }}
        >
          {rightItems.length > 0 && (
            <Space>
              {rightItems.map((item, index) => (
                <React.Fragment key={index}>{item}</React.Fragment>
              ))}
            </Space>
          )}
        </div>
      </div>

      {secondRow && (
        <div style={{ paddingBottom: paddingXS, paddingTop: 0 }}>
          {secondRow}
        </div>
      )}
    </AntHeader>
  );
};

const HeaderPropsCommon = {
  backButton: false,
  headerIcon: <CodeSandboxOutlined />,
  headerTitle: "Tunnel of Consciousness",
};

const GetLoginButton = (context) => (
  <Button type="primary" onClick={() => context.navigate("/auth/login")}>
    Login
  </Button>
);

const GetSignupButton = (context) => (
  <Button onClick={() => context.navigate("/auth/signup")}>Signup</Button>
);

const GetLogoutButton = (context) => (
  <Button
    onClick={async () => {
      try {
        await logout();
        context.setIsLoggedIn(false);
        context.navigate("/");
      } catch (err) {
        console.error(err);
      }
    }}
  >
    Logout
  </Button>
);

const GetDashboardButton = (context) => (
  <Button type="primary" onClick={() => context.navigate("/dashboard")}>
    Dashboard
  </Button>
);

export {
  Header,
  HeaderPropsCommon,
  GetSignupButton,
  GetLoginButton,
  GetLogoutButton,
  GetDashboardButton,
};
