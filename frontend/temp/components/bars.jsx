import React, { useState, useEffect, useRef } from "react";
import { Layout, Button, Space, Typography, theme, Breadcrumb } from "antd";
import { ArrowLeftOutlined, CodeSandboxOutlined } from "@ant-design/icons";
import { useNavigate, useLocation, Link } from "react-router-dom";

const { Header: AntHeader } = Layout;
const { Title } = Typography;

// Map URL paths to readable names
const breadcrumbNameMap = {
  "/dashboard": "Dashboard",
  "/auth": "Authentication",
  "/auth/login": "Login",
  "/auth/signup": "Sign Up",
  "/script": "Scripts",
};

const DynamicBreadcrumbs = () => {
  const location = useLocation();

  const pathSnippets = location.pathname.split("/").filter((i) => i);

  const breadcrumbItems = [
    {
      title: <Link to="/">Home</Link>,
      key: "home",
    },
    ...pathSnippets.map((_, index) => {
      const url = `/${pathSnippets.slice(0, index + 1).join("/")}`;
      const isId = pathSnippets[index].length > 20;
      const name =
        breadcrumbNameMap[url] ||
        (isId
          ? "Details"
          : pathSnippets[index].charAt(0).toUpperCase() +
            pathSnippets[index].slice(1));

      return {
        key: url,
        title: <Link to={url}>{name}</Link>,
      };
    }),
  ];

  return <Breadcrumb items={breadcrumbItems} style={{ margin: "16px 0" }} />;
};

/**
 * @param {boolean | React.ReactNode} backButton - Show default back button (true) or custom component.
 * @param {function | null} backButtonAction - Function to run on back click. Defaults to navigate(-1).
 * @param {React.ReactNode} headerIcon - Main icon. Pass a component (e.g., <UserOutlined />).
 * @param {function | null} headerIconAction - Function to run on icon click. Defaults to navigate('/').
 * @param {function | null} headerTitleAction - Function to run on title click. Defaults to navigate('/').
 * @param {string} headerTitle - Title text displayed next to the icon.
 * @param {Array<React.ReactNode>} leftItems - Components to render immediately after the title.
 * @param {Array<React.ReactNode>} centerItems - Components to render in the center of the header.
 * @param {Array<React.ReactNode>} rightItems - Components to render on the far right.
 * @param {boolean | React.ReactNode} breadcrumbs - Show breadcrumbs
 * @param {boolean} hidden - If true, returns null.
 * @param {boolean} sticky - If true, fixes header to top with z-index (Always visible).
 * @param {boolean} autoHide - If true, fixes header to top but hides it until mouse is at top (Overrides sticky).
 * @param {object} style - Custom CSS overrides.
 */
const Header = ({
  backButton = false,
  backButtonAction,
  headerIcon,
  headerIconAction,
  headerTitleAction,
  headerTitle,
  leftItems = [],
  centerItems = [],
  rightItems = [],
  breadcrumbs,
  hidden = false,
  sticky = false,
  autoHide = false,
  style = {},
}) => {
  const navigate = useNavigate();
  const {
    token: { colorBgContainer, paddingMD, paddingXS, colorBorderSecondary },
  } = theme.useToken();

  const [isVisible, setIsVisible] = useState(!autoHide);
  const hoverTimerRef = useRef(null);

  // Logic for Auto-Hide with Delay
  useEffect(() => {
    if (!autoHide) {
      setIsVisible(true);
      return;
    }

    const handleMouseMove = (e) => {
      // 1. Enter Trigger Zone (Top 50px)
      if (e.clientY < 50) {
        // Only start timer if not already visible and no timer is running
        if (!isVisible && !hoverTimerRef.current) {
          hoverTimerRef.current = setTimeout(() => {
            setIsVisible(true);
            hoverTimerRef.current = null; // Cleanup ref after firing
          }, 2000); // 2-second delay
        }
      }
      // 2. Leave Safe Zone (Top 100px)
      else if (e.clientY > 100) {
        // If cursor moves away, cancel any pending show timer
        if (hoverTimerRef.current) {
          clearTimeout(hoverTimerRef.current);
          hoverTimerRef.current = null;
        }
        // Hide immediately if visible
        if (isVisible) {
          setIsVisible(false);
        }
      }
    };

    window.addEventListener("mousemove", handleMouseMove);

    // Cleanup on unmount or prop change
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
    };
  }, [autoHide, isVisible]);

  if (hidden) return null;

  const handleBack = backButtonAction || (() => navigate(-1));
  const handleIconClick = headerIconAction || (() => navigate("/"));
  const handleTitleClick = headerTitleAction || (() => navigate("/"));

  const baseHeight = breadcrumbs ? "auto" : 64;

  // Determine Positioning Style
  let positionStyle = {};

  if (autoHide) {
    positionStyle = {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
      transform: isVisible ? "translateY(0)" : "translateY(-100%)",
      transition: "transform 0.3s ease-in-out",
    };
  } else if (sticky) {
    positionStyle = {
      position: "sticky",
      top: 0,
      zIndex: 1000,
      width: "100%",
    };
  }

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
        boxShadow:
          autoHide && isVisible ? "0 2px 8px rgba(0,0,0,0.15)" : "none",
        ...positionStyle,
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
              onClick={handleTitleClick}
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

      {breadcrumbs && <DynamicBreadcrumbs />}
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
        await context.performLogout();
        context.navigate("/auth/login");
        window.location.reload();
      } catch (err) {
        console.error(err);
      }
    }}
  >
    Logout
  </Button>
);

const GetDashboardButton = (context) => (
  <Button type="primary" onClick={() => context.navigate("/script")}>
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
