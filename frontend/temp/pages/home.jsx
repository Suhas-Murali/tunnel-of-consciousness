import {
  Typography,
  Button,
  Row,
  Col,
  Card,
  Space,
  theme,
  Statistic,
  Divider,
} from "antd";
import {
  RocketOutlined,
  LineChartOutlined,
  EyeOutlined,
  ReadOutlined,
  ThunderboltFilled,
  CheckCircleFilled,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import {
  GetDashboardButton,
  GetLoginButton,
  GetSignupButton,
  HeaderPropsCommon,
} from "../components/bars";

const { Title, Paragraph, Text } = Typography;

const Page = () => {
  const navigate = useNavigate();
  const {
    token: {
      colorPrimary,
      colorBgContainer,
      borderRadiusLG,
      fontSizeXL,
      colorTextSecondary,
    },
  } = theme.useToken();

  // --- Reusable Styles ---
  const sectionStyle = {
    padding: "60px 24px",
    maxWidth: "1200px",
    margin: "0 auto",
  };

  return (
    <div style={{ width: "100%", overflowX: "hidden" }}>
      {/* =======================
          1. HERO SECTION 
         ======================= */}
      <div
        style={{
          background: `linear-gradient(135deg, ${colorBgContainer} 0%, rgba(22, 119, 255, 0.1) 100%)`,
          padding: "100px 24px",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <Space orientation="vertical" size="large">
            <Title level={1} style={{ fontSize: "3.5rem", marginBottom: 0 }}>
              Unlock the <span style={{ color: colorPrimary }}>Soul</span> of
              Your Story
            </Title>

            <Paragraph
              style={{
                fontSize: fontSizeXL,
                color: colorTextSecondary,
                maxWidth: 600,
                margin: "0 auto",
              }}
            >
              The first intelligent workspace that lets you write, analyze, and
              visualize your narrative arc in real-time.
            </Paragraph>

            <Space size="middle" style={{ marginTop: 24 }}>
              <Button
                type="primary"
                size="large"
                icon={<RocketOutlined />}
                onClick={() => navigate("/auth/signup")}
              >
                Start Writing for Free
              </Button>
              <Button size="large" icon={<ReadOutlined />}>
                Explore Demo Script
              </Button>
            </Space>
          </Space>
        </div>
      </div>

      {/* =======================
          2. CORE FEATURES 
         ======================= */}
      <div style={sectionStyle}>
        <Row gutter={[32, 32]} justify="center">
          <Col xs={24} md={8}>
            <Card
              variant="borderless"
              hoverable
              style={{ height: "100%", textAlign: "center" }}
            >
              <ReadOutlined
                style={{
                  fontSize: "48px",
                  color: colorPrimary,
                  marginBottom: 24,
                }}
              />
              <Title level={3}>Distraction-Free Writing</Title>
              <Paragraph type="secondary">
                A clean, modern editor supporting standard screenplay formats
                (Fountain, Final Draft). Focus on the words, we handle the
                formatting.
              </Paragraph>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card
              variant="borderless"
              hoverable
              style={{ height: "100%", textAlign: "center" }}
            >
              <LineChartOutlined
                style={{
                  fontSize: "48px",
                  color: colorPrimary,
                  marginBottom: 24,
                }}
              />
              <Title level={3}>Deep Analysis</Title>
              <Paragraph type="secondary">
                Track emotional sentiment, character presence, and pacing
                beat-by-beat. Spot plot holes before you finish the first draft.
              </Paragraph>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card
              variant="borderless"
              hoverable
              style={{ height: "100%", textAlign: "center" }}
            >
              <EyeOutlined
                style={{
                  fontSize: "48px",
                  color: colorPrimary,
                  marginBottom: 24,
                }}
              />
              <Title level={3}>3D Visualization</Title>
              <Paragraph type="secondary">
                See your story as a "Tunnel of Consciousness." Visualize
                narrative tension and dialogue density in a 3D space.
              </Paragraph>
            </Card>
          </Col>
        </Row>
      </div>

      <Divider />

      {/* =======================
          3. HOW IT WORKS / METRICS
         ======================= */}
      <div
        style={{
          ...sectionStyle,
          background: colorBgContainer,
          borderRadius: borderRadiusLG,
        }}
      >
        <Row gutter={[48, 48]} align="middle">
          <Col xs={24} md={12}>
            <Title level={2}>Data-Driven Storytelling</Title>
            <Paragraph style={{ fontSize: "1.1rem" }}>
              Stop guessing if your climax hits hard enough. Our engine
              processes your script through multiple NLP models to give you
              objective feedback.
            </Paragraph>
            <Space
              orientation="vertical"
              size="middle"
              style={{ marginTop: 16 }}
            >
              <Space>
                <CheckCircleFilled style={{ color: colorPrimary }} />{" "}
                <Text>Real-time Sentiment Analysis</Text>
              </Space>
              <Space>
                <CheckCircleFilled style={{ color: colorPrimary }} />{" "}
                <Text>Character Dialogue Balance</Text>
              </Space>
              <Space>
                <CheckCircleFilled style={{ color: colorPrimary }} />{" "}
                <Text>Thematic Keyword Extraction</Text>
              </Space>
            </Space>
          </Col>
          <Col xs={24} md={12}>
            {/* Mock Stat Display */}
            <Card variant="outlined">
              <Row gutter={16}>
                <Col span={12}>
                  <Statistic
                    title="Scripts Analyzed"
                    value={1128}
                    prefix={<ThunderboltFilled />}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Avg. Improvement"
                    value={24}
                    suffix="%"
                    precision={0}
                  />
                </Col>
              </Row>
              <Divider />
              <div
                style={{
                  background: "#f5f5f5",
                  height: 100,
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#999",
                }}
              >
                [3D Analysis Graph Placeholder]
              </div>
            </Card>
          </Col>
        </Row>
      </div>

      {/* =======================
          4. FOOTER CTA 
         ======================= */}
      <div style={{ padding: "80px 24px", textAlign: "center" }}>
        <Title level={2}>Ready to tell your story?</Title>
        <Paragraph type="secondary" style={{ marginBottom: 32 }}>
          Join thousands of writers using data to perfect their craft.
        </Paragraph>
        <Button
          type="primary"
          size="large"
          onClick={() => navigate("/auth/signup")}
        >
          Get Started Now
        </Button>
      </div>
    </div>
  );
};

const GetHeaderProps = (context) => {
  return {
    ...HeaderPropsCommon,
    rightItems: context.isLoggedIn
      ? [GetDashboardButton(context)]
      : [GetLoginButton(context), GetSignupButton(context)],
  };
};

export const Home = { Page, GetHeaderProps };
