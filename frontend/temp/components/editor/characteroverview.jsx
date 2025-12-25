import React, { useState, useEffect, useMemo } from "react";
import {
  theme,
  Select,
  Space,
  Empty,
  Avatar,
  Typography,
  Tag,
  Row,
  Col,
  Card,
  Progress,
  Statistic,
  Divider,
  Collapse,
  List,
} from "antd";
import {
  UserOutlined,
  ShareAltOutlined,
  SmileOutlined,
  FrownOutlined,
  RiseOutlined,
  MessageOutlined,
  EnvironmentOutlined,
} from "@ant-design/icons";

const { Text, Title, Paragraph } = Typography;

export const CharacterOverview = ({ provider }) => {
  const { token } = theme.useToken();
  const [characters, setCharacters] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    if (!provider) return;
    const map = provider.document.getMap("script_analysis");
    const updateHandler = () => setCharacters(map.get("characters") || []);
    updateHandler();
    map.observe(updateHandler);
    return () => map.unobserve(updateHandler);
  }, [provider]);

  const activeChar = useMemo(
    () => characters.find((c) => c.id === selectedId),
    [selectedId, characters]
  );

  const getSentimentColor = (val) =>
    val > 0.2
      ? token.colorSuccess
      : val < -0.2
      ? token.colorError
      : token.colorWarning;

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
          placeholder="Select Character"
          onChange={setSelectedId}
          value={selectedId}
          options={characters.map((c) => ({
            value: c.id,
            label: (
              <Space>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    backgroundColor: c.color,
                  }}
                />
                {c.name}
              </Space>
            ),
          }))}
        />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        {!selectedId || !activeChar ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No Character Selected"
            style={{ marginTop: 40 }}
          />
        ) : (
          <div>
            <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
              <Avatar
                size={64}
                style={{ backgroundColor: activeChar.color }}
                icon={<UserOutlined />}
              >
                {activeChar.name.substring(0, 2)}
              </Avatar>
              <div style={{ flex: 1 }}>
                <Title level={4} style={{ margin: 0 }}>
                  {activeChar.name}
                </Title>
                <div
                  style={{
                    marginTop: 4,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 4,
                  }}
                >
                  <Tag color="purple">{activeChar.archetype || "Unknown"}</Tag>
                  {(activeChar.traits || []).map((t) => (
                    <Tag key={t}>{t}</Tag>
                  ))}
                </div>
              </div>
            </div>

            {activeChar.metrics && (
              <div style={{ marginBottom: 24 }}>
                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <Card
                      size="small"
                      title={
                        <Space>
                          <ShareAltOutlined /> Influence
                        </Space>
                      }
                      bordered={false}
                      style={{
                        background: token.colorFillQuaternary,
                        height: "100%",
                      }}
                    >
                      <div style={{ marginBottom: 12 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 10,
                          }}
                        >
                          <span>Centrality</span>
                          <span>
                            {Math.round(
                              (activeChar.metrics.degreeCentrality || 0) * 100
                            )}
                            %
                          </span>
                        </div>
                        <Progress
                          percent={
                            (activeChar.metrics.degreeCentrality || 0) * 100
                          }
                          showInfo={false}
                          size="small"
                          strokeColor={activeChar.color}
                        />
                      </div>
                      <div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 10,
                          }}
                        >
                          <span>Bridge</span>
                          <span>
                            {Math.round(
                              (activeChar.metrics.betweenness || 0) * 100
                            )}
                            %
                          </span>
                        </div>
                        <Progress
                          percent={(activeChar.metrics.betweenness || 0) * 100}
                          showInfo={false}
                          size="small"
                          strokeColor={token.colorWarning}
                        />
                      </div>
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card
                      size="small"
                      title={
                        <Space>
                          <SmileOutlined /> Emotion
                        </Space>
                      }
                      bordered={false}
                      style={{
                        background: token.colorFillQuaternary,
                        height: "100%",
                      }}
                    >
                      <Row gutter={8}>
                        <Col span={12}>
                          <Statistic
                            title="Avg"
                            value={
                              (activeChar.metrics.avgSentiment || 0) > 0
                                ? "Pos"
                                : "Neg"
                            }
                            valueStyle={{
                              color: getSentimentColor(
                                activeChar.metrics.avgSentiment || 0
                              ),
                              fontSize: 14,
                            }}
                            prefix={
                              (activeChar.metrics.avgSentiment || 0) > 0 ? (
                                <SmileOutlined />
                              ) : (
                                <FrownOutlined />
                              )
                            }
                          />
                        </Col>
                        <Col span={12}>
                          <Statistic
                            title="Vol"
                            value={Math.round(
                              (activeChar.metrics.volatility || 0) * 100
                            )}
                            suffix="%"
                            valueStyle={{ fontSize: 14 }}
                            prefix={<RiseOutlined />}
                          />
                        </Col>
                      </Row>
                      <div style={{ marginTop: 8 }}>
                        <Progress
                          percent={
                            ((activeChar.metrics.avgSentiment || 0) + 1) * 50
                          }
                          showInfo={false}
                          size="small"
                          steps={5}
                          strokeColor={[token.colorError, token.colorSuccess]}
                        />
                      </div>
                    </Card>
                  </Col>
                </Row>
              </div>
            )}

            <Divider orientation="left" style={{ fontSize: 13 }}>
              <Tag color="blue" icon={<UserOutlined />}>
                Characteristics
              </Tag>
            </Divider>
            <Paragraph type="secondary" style={{ fontSize: 13 }}>
              {activeChar.description}
            </Paragraph>

            <Divider orientation="left" style={{ fontSize: 13 }}>
              <MessageOutlined /> Dialogue
            </Divider>
            <Collapse
              ghost
              accordion
              items={(activeChar.scenes || []).map((s) => ({
                key: s.sceneId,
                label: (
                  <Space>
                    <EnvironmentOutlined
                      style={{ color: token.colorTextSecondary }}
                    />
                    <Text strong>{s.sceneName}</Text>
                    <Tag size="small">{s.dialogueCount}</Tag>
                  </Space>
                ),
                children: (
                  <List
                    size="small"
                    dataSource={s.dialogues}
                    renderItem={(i) => (
                      <List.Item>
                        <Text style={{ fontSize: 13 }}>{i}</Text>
                      </List.Item>
                    )}
                  />
                ),
              }))}
            />
          </div>
        )}
      </div>
    </div>
  );
};
