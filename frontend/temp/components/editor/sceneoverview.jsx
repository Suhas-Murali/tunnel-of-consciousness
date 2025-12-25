import React, { useState, useEffect, useMemo } from "react";
import {
  theme,
  Select,
  Space,
  Empty,
  Typography,
  Tag,
  Divider,
  Row,
  Col,
  Card,
  Tooltip,
  Progress,
  List,
  Avatar,
} from "antd";
import {
  FlagOutlined,
  ClockCircleOutlined,
  BarChartOutlined,
  ThunderboltOutlined,
  FontSizeOutlined,
  SmileOutlined,
  FrownOutlined,
  AimOutlined,
  UserOutlined,
} from "@ant-design/icons";

const { Title, Text, Paragraph } = Typography;

// ==========================================
// HELPER: Color Generator
// ==========================================
const stringToColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++)
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const c = (hash & 0x00ffffff).toString(16).toUpperCase();
  return "#" + "00000".substring(0, 6 - c.length) + c;
};

// ==========================================
// SCENE OVERVIEW COMPONENT
// ==========================================

export const SceneOverview = ({ provider }) => {
  const { token } = theme.useToken();
  const [scenes, setScenes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    if (!provider) return;
    const map = provider.document.getMap("script_analysis");
    const updateHandler = () => {
      setScenes(map.get("scenes") || []);
    };
    updateHandler();
    map.observe(updateHandler);
    return () => map.unobserve(updateHandler);
  }, [provider]);

  const activeScene = useMemo(
    () => scenes.find((s) => s.id === selectedId),
    [selectedId, scenes]
  );

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: token.colorBgContainer,
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorFillQuaternary,
        }}
      >
        <Select
          style={{ width: "100%" }}
          placeholder="Select Scene"
          onChange={setSelectedId}
          value={selectedId}
          options={scenes.map((s) => ({
            value: s.id,
            label: (
              <Space>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    backgroundColor: s.color || "#ccc", // Fallback color
                  }}
                />
                {s.name}
              </Space>
            ),
          }))}
        />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        {!selectedId || !activeScene ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No Scene Selected"
            style={{ marginTop: 40 }}
          />
        ) : (
          <div>
            <div style={{ marginBottom: 20 }}>
              {/* Header & Structural Beat */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <Title level={4} style={{ margin: 0, maxWidth: "60%" }}>
                  {activeScene.name}
                </Title>
                {activeScene.metrics?.structuralBeat && (
                  <Tag color="geekblue" icon={<FlagOutlined />}>
                    {activeScene.metrics.structuralBeat}
                  </Tag>
                )}
              </div>
              <Space style={{ marginTop: 8 }}>
                <Tag icon={<ClockCircleOutlined />}>
                  {activeScene.durationSecs}s
                </Tag>
                <Tag color={activeScene.type === "Action" ? "red" : "blue"}>
                  {activeScene.type}
                </Tag>
              </Space>
            </div>

            <Paragraph
              type="secondary"
              style={{
                fontStyle: "italic",
                borderLeft: `3px solid ${token.colorBorder}`,
                paddingLeft: 12,
              }}
            >
              {activeScene.synopsis || "Analyzing..."}
            </Paragraph>

            {activeScene.metrics && (
              <>
                <Divider orientation="left" style={{ fontSize: 13 }}>
                  <BarChartOutlined /> Analysis
                </Divider>
                <Row gutter={[12, 12]}>
                  <Col span={12}>
                    <Card
                      size="small"
                      bordered={false}
                      style={{
                        background: token.colorFillQuaternary,
                        height: "100%",
                      }}
                    >
                      <Space
                        direction="vertical"
                        style={{ width: "100%" }}
                        size={0}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 12,
                          }}
                        >
                          <Tooltip title="Dialogue pacing">
                            <span>
                              <ThunderboltOutlined /> Pacing
                            </span>
                          </Tooltip>
                          <span style={{ fontWeight: "bold" }}>
                            {activeScene.metrics.pacing || 0}/100
                          </span>
                        </div>
                        <Progress
                          percent={activeScene.metrics.pacing || 0}
                          showInfo={false}
                          strokeColor={token.colorPrimary}
                          size="small"
                          style={{ marginBottom: 8 }}
                        />

                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 12,
                          }}
                        >
                          <Tooltip title="Text density">
                            <span>
                              <FontSizeOutlined /> Read Speed
                            </span>
                          </Tooltip>
                          <span style={{ fontWeight: "bold" }}>
                            {activeScene.metrics.linguisticDensity || 0}/100
                          </span>
                        </div>
                        <Progress
                          percent={activeScene.metrics.linguisticDensity || 0}
                          showInfo={false}
                          strokeColor={token.colorWarning}
                          size="small"
                        />
                      </Space>
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card
                      size="small"
                      bordered={false}
                      style={{
                        background: token.colorFillQuaternary,
                        height: "100%",
                      }}
                    >
                      {/* Tone Slider */}
                      <div style={{ marginBottom: 12 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 12,
                          }}
                        >
                          <span>Tone</span>{" "}
                          {(activeScene.metrics.sentiment || 0) > 0 ? (
                            <SmileOutlined />
                          ) : (
                            <FrownOutlined />
                          )}
                        </div>
                        <div
                          style={{
                            height: 6,
                            borderRadius: 3,
                            background: `linear-gradient(90deg, ${token.colorError} 0%, ${token.colorBgContainer} 50%, ${token.colorSuccess} 100%)`,
                            position: "relative",
                            marginTop: 4,
                          }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              left: `${
                                ((activeScene.metrics.sentiment || 0) + 1) * 50
                              }%`,
                              top: -3,
                              width: 12,
                              height: 12,
                              borderRadius: "50%",
                              background: token.colorText,
                              border: `2px solid ${token.colorBgContainer}`,
                            }}
                          />
                        </div>
                      </div>
                      {/* Action Ratio */}
                      <div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 12,
                          }}
                        >
                          <span>Act/Dial</span>
                        </div>
                        <Progress
                          percent={activeScene.metrics.actionRatio || 50}
                          success={{ percent: 0 }}
                          strokeColor={token.colorError}
                          trailColor={token.colorInfoBg}
                          showInfo={false}
                          size="small"
                        />
                      </div>
                    </Card>
                  </Col>
                </Row>
              </>
            )}

            <Divider orientation="left" style={{ fontSize: 13 }}>
              <UserOutlined /> Cast & Focus
            </Divider>

            {/* Scene Focus */}
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Scene Focus (POV)
              </Text>
              <div
                style={{
                  marginTop: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <AimOutlined style={{ color: token.colorTextTertiary }} />
                <Tag color="gold">
                  {activeScene.focusCharacter || "Ensemble"}
                </Tag>
              </div>
            </div>

            <List
              size="small"
              header={
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Present Characters
                </Text>
              }
              dataSource={
                Array.isArray(activeScene.characters)
                  ? activeScene.characters
                  : []
              }
              renderItem={(charName) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={
                      <Avatar
                        size="small"
                        style={{ backgroundColor: stringToColor(charName) }}
                      />
                    }
                    title={<Text style={{ fontSize: 13 }}>{charName}</Text>}
                  />
                </List.Item>
              )}
            />
          </div>
        )}
      </div>
    </div>
  );
};
