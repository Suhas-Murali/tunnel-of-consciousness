import { useState, useEffect } from "react";
import {
  Form,
  Input,
  Button,
  Card,
  Typography,
  Alert,
  theme,
  Row,
  Col,
  Space,
  List,
} from "antd";
import {
  UserOutlined,
  LockOutlined,
  CheckCircleFilled,
  ThunderboltFilled,
} from "@ant-design/icons";
import { useNavigate, Link, useOutletContext } from "react-router-dom";
import { login } from "../../../api";
import { GetSignupButton, HeaderPropsCommon } from "../../components/bars";

const { Title, Text, Paragraph } = Typography;

const LoginPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState(null);

  const [form] = Form.useForm();

  const { isLoggedIn, setIsLoggedIn } = useOutletContext();

  const {
    token: {
      colorBgContainer,
      borderRadiusLG,
      colorPrimary,
      paddingXL,
      colorBgLayout,
    },
  } = theme.useToken();

  useEffect(() => {
    if (isLoggedIn) {
      navigate("/script");
    }
  }, [isLoggedIn, navigate]);

  const onFinish = async (values) => {
    setLoading(true);
    setFormError(null);
    const { email, password } = values;

    try {
      await login(email, password);
      setIsLoggedIn(true);
      navigate("/script");
    } catch (err) {
      const message =
        err.response?.data?.error ||
        "Login failed. Please check your credentials.";
      setFormError(message);
    } finally {
      setLoading(false);
    }
  };

  const iconStyle = { color: "#bfbfbf" };

  return (
    <Row
      style={{
        minHeight: "100vh",
        background: colorBgLayout,
        transition: "background 0.3s",
      }}
    >
      {/* LEFT SIDE: Branding (Same as Signup for consistency) */}
      <Col
        xs={0}
        md={10}
        lg={12}
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: paddingXL,
        }}
      >
        <div style={{ maxWidth: 600, margin: "0 auto", color: "white" }}>
          <Space align="center" style={{ marginBottom: 24 }}>
            <ThunderboltFilled style={{ fontSize: 48, color: colorPrimary }} />
            <Title style={{ color: "white", margin: 0 }}>
              Tunnel of Consciousness
            </Title>
          </Space>

          <Title level={2} style={{ color: "white", marginTop: 0 }}>
            Welcome back.
          </Title>
          <Paragraph
            style={{
              color: "rgba(255,255,255,0.65)",
              fontSize: 18,
              marginBottom: 40,
            }}
          >
            Continue your analysis where you left off. Your latest script
            insights are waiting for you.
          </Paragraph>

          <List
            dataSource={[
              "Review your latest script drafts",
              "Check new character sentiment trends",
              "Export updated screenplay formats",
              "Collaborate with your team",
            ]}
            renderItem={(item) => (
              <List.Item
                style={{ border: "none", padding: "12px 0", color: "white" }}
              >
                <Space>
                  <CheckCircleFilled
                    style={{ color: colorPrimary, fontSize: 18 }}
                  />
                  <Text style={{ color: "white", fontSize: 16 }}>{item}</Text>
                </Space>
              </List.Item>
            )}
          />
        </div>
      </Col>

      {/* RIGHT SIDE: Login Form */}
      <Col
        xs={24}
        md={12}
        lg={10}
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
        }}
      >
        <Card
          style={{
            width: "100%",
            maxWidth: 480,
            borderRadius: borderRadiusLG,
            background: colorBgContainer,
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          }}
          variant="outlined"
        >
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <Title level={3}>Log in to your account</Title>
            <Text type="secondary">
              Enter your details to access your workspace
            </Text>
          </div>

          {formError && (
            <Alert
              title={formError}
              type="error"
              showIcon
              style={{ marginBottom: 24 }}
            />
          )}

          <Form
            form={form}
            name="login"
            onFinish={onFinish}
            requiredMark={false}
            scrollToFirstError
            size="large"
            layout="vertical"
            initialValues={{ remember: true }}
          >
            {/* EMAIL */}
            <Form.Item
              name="email"
              label="Email"
              rules={[
                { required: true, message: "Please input your email!" },
                { type: "email", message: "Invalid email address" },
              ]}
            >
              <Input
                prefix={<UserOutlined style={iconStyle} />}
                placeholder="user@example.com"
              />
            </Form.Item>

            {/* PASSWORD */}
            <Form.Item
              name="password"
              label="Password"
              rules={[
                { required: true, message: "Please input your password!" },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined style={iconStyle} />}
                placeholder="Password"
              />
            </Form.Item>

            <Form.Item style={{ marginTop: 48 }}>
              <Button type="primary" htmlType="submit" loading={loading} block>
                Log In
              </Button>
            </Form.Item>

            <div style={{ textAlign: "center" }}>
              <Text type="secondary">Don't have an account? </Text>
              <Link to="/auth/signup" style={{ fontWeight: 500 }}>
                Sign up here
              </Link>
            </div>
          </Form>
        </Card>
      </Col>
    </Row>
  );
};

const GetLoginHeaderProps = (context) => {
  return {
    ...HeaderPropsCommon,
    rightItems: [GetSignupButton(context)],
  };
};

export const Login = {
  Page: LoginPage,
  GetHeaderProps: GetLoginHeaderProps,
};
