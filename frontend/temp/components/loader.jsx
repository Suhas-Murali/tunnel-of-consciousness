import { Spin, theme } from "antd";

const CenteredLoader = ({ height = "100vh" }) => {
  const {
    token: { colorBgLayout },
  } = theme.useToken();
  return (
    <div
      style={{
        height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: colorBgLayout,
        zIndex: 9999,
      }}
    >
      <Spin size="large" />
    </div>
  );
};

export { CenteredLoader };
