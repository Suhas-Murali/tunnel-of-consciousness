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
  MailOutlined,
  CheckCircleFilled,
  ThunderboltFilled,
} from "@ant-design/icons";
import { useNavigate, Link, useOutletContext } from "react-router-dom";
import { register } from "../../../api";
import { GetLoginButton, HeaderPropsCommon } from "../../components/bars";

const { Title, Text, Paragraph } = Typography;

const SignupPage = () => {
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
      navigate("/dashboard");
    }
  }, [isLoggedIn, navigate]);

  const onFinish = async (values) => {
    setLoading(true);
    setFormError(null);
    const { username, password, email } = values;

    try {
      await register(username, password, email);
      setIsLoggedIn(true);
      navigate("/dashboard");
    } catch (err) {
      const message =
        err.response?.data?.error || "Registration failed. Please try again.";
      setFormError(message);
      if (message.toLowerCase().includes("username")) {
        form.setFields([{ name: "username", errors: [message] }]);
      }
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
      {/* LEFT SIDE: Branding */}
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
            Analyze your stories with depth.
          </Title>
          <Paragraph
            style={{
              color: "rgba(255,255,255,0.65)",
              fontSize: 18,
              marginBottom: 40,
            }}
          >
            Join a community of writers using data-driven insights to perfect
            their scripts, novels, and game narratives.
          </Paragraph>

          <List
            dataSource={[
              "Real-time sentiment analysis visualization",
              "Character dialogue distribution metrics",
              "Standard industry formatting export",
              "Cloud sync across all your devices",
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

      {/* RIGHT SIDE: Signup Form */}
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
            <Title level={3}>Create your account</Title>
            <Text type="secondary">Start your writing journey today</Text>
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
            name="signup"
            onFinish={onFinish}
            requiredMark={false}
            scrollToFirstError
            size="large"
            layout="vertical" // Back to vertical layout
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
                prefix={<MailOutlined style={iconStyle} />}
                placeholder="user@example.com"
              />
            </Form.Item>

            {/* USERNAME */}
            <Form.Item
              name="username"
              label="Username"
              rules={[
                { required: true, message: "Please input your username!" },
              ]}
            >
              <Input
                prefix={<UserOutlined style={iconStyle} />}
                placeholder="Username"
              />
            </Form.Item>

            {/* PASSWORD */}
            <Form.Item
              name="password"
              label="Password"
              rules={[
                { required: true, message: "Please input your password!" },
                { min: 6, message: "Must be at least 6 characters" },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined style={iconStyle} />}
                placeholder="Password"
              />
            </Form.Item>

            {/* CONFIRM PASSWORD */}
            <Form.Item
              name="confirm"
              label="Confirm Password"
              dependencies={["password"]}
              rules={[
                { required: true, message: "Please confirm your password!" },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue("password") === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error("Passwords do not match!"));
                  },
                }),
              ]}
            >
              <Input.Password
                prefix={<LockOutlined style={iconStyle} />}
                placeholder="Confirm Password"
              />
            </Form.Item>

            <Form.Item style={{ marginTop: 48 }}>
              <Button type="primary" htmlType="submit" loading={loading} block>
                Sign Up
              </Button>
            </Form.Item>

            <div style={{ textAlign: "center" }}>
              <Text type="secondary">Already have an account? </Text>
              <Link to="/auth/login" style={{ fontWeight: 500 }}>
                Login here
              </Link>
            </div>
          </Form>
        </Card>
      </Col>
    </Row>
  );
};

const GetSignupHeaderProps = (context) => {
  return {
    ...HeaderPropsCommon,
    rightItems: [GetLoginButton(context)],
  };
};

export const Signup = {
  Page: SignupPage,
  GetHeaderProps: GetSignupHeaderProps,
};
