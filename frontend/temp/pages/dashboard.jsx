import { useState, useEffect } from "react";
import {
  Typography,
  Button,
  Card,
  Row,
  Col,
  Input,
  Select,
  Space,
  Segmented,
  Modal,
  Empty,
  List,
  FloatButton,
  theme,
  Spin,
  message,
  Popconfirm,
} from "antd";
import {
  PlusOutlined,
  AppstoreOutlined,
  BarsOutlined,
  SearchOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import { useNavigate, useOutletContext } from "react-router-dom";
import { GetLogoutButton, HeaderPropsCommon } from "../components/bars";
import { allScripts } from "../../api";

const { Title, Text } = Typography;
const { Meta } = Card;

const Page = () => {
  const navigate = useNavigate();
  const { isLoggedIn } = useOutletContext();
  const { token } = theme.useToken();

  useEffect(() => {
    if (!isLoggedIn) {
      navigate("/auth/login");
    }
  }, [isLoggedIn, navigate]);

  const [loading, setLoading] = useState(true);
  const [scripts, setScripts] = useState([]);
  const [viewMode, setViewMode] = useState("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("updated-desc");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newScriptName, setNewScriptName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const fetchScripts = async () => {
      try {
        const res = await allScripts();
        setScripts(res.data.scripts);
      } catch (err) {
        console.error(err);
        message.error("Failed to load scripts.");
      } finally {
        setLoading(false);
      }
    };

    if (isLoggedIn) {
      fetchScripts();
    }
  }, [isLoggedIn]);

  const formatDate = (isoString) => {
    if (!isoString) return "N/A";
    return new Date(isoString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const filteredScripts = scripts
    .filter((s) => s.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.createdAt);
      const dateB = new Date(b.updatedAt || b.createdAt);
      const createdA = new Date(a.createdAt);
      const createdB = new Date(b.createdAt);

      switch (sortBy) {
        case "updated-desc":
          return dateB - dateA;
        case "created-desc":
          return createdB - createdA;
        case "name-asc":
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

  const handleCreateScript = async () => {
    if (!newScriptName.trim()) return;
    setCreating(true);
    try {
      message.success("Script created!");
      setIsModalOpen(false);
      setNewScriptName("");
      const res = await allScripts();
      setScripts(res.data.scripts);
    } catch (err) {
      message.error("Failed to create script.");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteScript = (id) => {
    message.info("Delete confirmed (No action taken yet)");
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", marginTop: 100, minHeight: "100vh" }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 24,
        maxWidth: 1200,
        margin: "0 auto",
        minHeight: "100vh",
      }}
    >
      <div
        style={{
          marginBottom: 24,
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <Input
          placeholder="Search scripts..."
          prefix={
            <SearchOutlined style={{ color: token.colorTextPlaceholder }} />
          }
          style={{ width: 300 }}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          allowClear
        />

        <Space>
          <Select
            defaultValue="updated-desc"
            style={{ width: 160 }}
            onChange={setSortBy}
            options={[
              { value: "updated-desc", label: "Last Updated" },
              { value: "created-desc", label: "Date Created" },
              { value: "name-asc", label: "Name (A-Z)" },
            ]}
          />
          <Segmented
            value={viewMode}
            onChange={setViewMode}
            options={[
              { value: "grid", icon: <AppstoreOutlined /> },
              { value: "list", icon: <BarsOutlined /> },
            ]}
          />
        </Space>
      </div>

      {filteredScripts.length === 0 ? (
        <Empty
          description="No scripts found"
          style={{ marginTop: 160 }}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        ></Empty>
      ) : viewMode === "grid" ? (
        // --- GRID VIEW ---
        <Row gutter={[24, 24]}>
          {filteredScripts.map((script) => (
            <Col xs={24} sm={12} md={8} lg={6} key={script.id}>
              <Card
                hoverable
                style={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}
                styles={{
                  body: {
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  },
                }}
              >
                <div>
                  {/* Header: Icon + Title */}
                  <Meta
                    avatar={
                      <FileTextOutlined
                        style={{ fontSize: 24, color: token.colorPrimary }}
                      />
                    }
                    title={script.title}
                    // Description Removed from here to fix alignment
                  />

                  {/* Date Info: Moved out of Meta to align with Icon (Left Edge) */}
                  <div style={{ marginTop: 20, fontSize: 12 }}>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <ClockCircleOutlined />
                      <span>Updated: {formatDate(script.updatedAt)}</span>
                    </div>
                    <div
                      style={{ color: token.colorTextTertiary, marginTop: 4 }}
                    >
                      Created: {formatDate(script.createdAt)}
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div
                  style={{
                    marginTop: 24,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Button
                    type="primary"
                    onClick={() => navigate(`/script/${script.id}`)}
                  >
                    Open
                  </Button>

                  <Popconfirm
                    title="Delete Script"
                    description="Are you sure you want to delete this script?"
                    onConfirm={(e) => {
                      e.stopPropagation();
                      handleDeleteScript(script.id);
                    }}
                    onCancel={(e) => e.stopPropagation()}
                    okText="Yes"
                    cancelText="No"
                    icon={<QuestionCircleOutlined style={{ color: "red" }} />}
                  >
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Popconfirm>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      ) : (
        // --- LIST VIEW ---
        <List
          itemLayout="horizontal"
          dataSource={filteredScripts}
          renderItem={(item) => (
            <List.Item
              style={{
                background: token.colorBgContainer,
                padding: 16,
                marginBottom: 12,
                borderRadius: 8,
              }}
              actions={[
                <Button
                  type="primary"
                  onClick={() => navigate(`/script/${item.id}`)}
                >
                  Open
                </Button>,
                <Popconfirm
                  title="Delete Script"
                  description="Are you sure you want to delete this script?"
                  onConfirm={() => handleDeleteScript(item.id)}
                  okText="Yes"
                  cancelText="No"
                  placement="left"
                >
                  <Button type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                avatar={
                  <FileTextOutlined
                    style={{ fontSize: 24, color: token.colorPrimary }}
                  />
                }
                title={
                  <a onClick={() => navigate(`/script/${item.id}`)}>
                    {item.title}
                  </a>
                }
                description={
                  <Space size="large" style={{ fontSize: 12 }}>
                    <span>Updated: {formatDate(item.updatedAt)}</span>
                    <span>Created: {formatDate(item.createdAt)}</span>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      )}

      {/* --- Floating Action Button --- */}
      <FloatButton
        type="primary"
        icon={<PlusOutlined />}
        tooltip="Create New Script"
        onClick={() => setIsModalOpen(true)}
        style={{ right: 48, bottom: 48, width: 56, height: 56 }}
      />

      {/* --- Create Script Modal --- */}
      <Modal
        title="Create New Script"
        open={isModalOpen}
        onOk={handleCreateScript}
        confirmLoading={creating}
        onCancel={() => setIsModalOpen(false)}
        okText="Create"
      >
        <div style={{ paddingTop: 12, paddingBottom: 12 }}>
          <Text>Script Title</Text>
          <Input
            placeholder="e.g. The Next Big Blockbuster"
            style={{ marginTop: 8 }}
            value={newScriptName}
            onChange={(e) => setNewScriptName(e.target.value)}
            onPressEnter={handleCreateScript}
            autoFocus
          />
        </div>
      </Modal>
    </div>
  );
};

const GetHeaderProps = (context) => {
  return {
    ...HeaderPropsCommon,
    headerTitle: "Dashboard",
    headerTitleAction: () => {},
    rightItems: [GetLogoutButton(context)],
    breadcrumbs: true,
  };
};

export const Dashboard = { Page, GetHeaderProps };
