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
  Tag,
  Tooltip,
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
  UserOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { useNavigate, useOutletContext } from "react-router-dom";
import { GetLogoutButton, HeaderPropsCommon } from "../components/bars";
import { CenteredLoader } from "../components/loader";
import { allScripts, createScript, deleteScript } from "../../api";

const { Title, Text } = Typography;
const { Meta } = Card;

const Page = () => {
  const navigate = useNavigate();
  const { user } = useOutletContext();
  const { token } = theme.useToken();
  const [loading, setLoading] = useState(true);
  const [scripts, setScripts] = useState([]);
  const [viewMode, setViewMode] = useState("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("updated-desc");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newScriptName, setNewScriptName] = useState("");
  const [creating, setCreating] = useState(false);

  // --- 1. FETCH SCRIPTS ---
  const fetchScripts = async () => {
    setLoading(true);
    try {
      const res = await allScripts();
      // The API now returns { scripts: [...] }
      setScripts(res.data.scripts);
    } catch (err) {
      console.error(err);
      message.error("Failed to load scripts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScripts();
  }, []);

  // --- 2. CREATE SCRIPT ---
  const handleCreateScript = async () => {
    if (!newScriptName.trim()) return;
    setCreating(true);
    try {
      // Call API
      const res = await createScript(newScriptName);
      const newScript = res.data.script;

      message.success("Script created successfully!");
      setIsModalOpen(false);
      setNewScriptName("");

      // Navigate immediately to the new script editor
      navigate(`/script/${newScript._id}`);
    } catch (err) {
      console.error(err);
      if (err.response && err.response.status === 409) {
        message.error("A script with this name already exists.");
      } else {
        message.error("Failed to create script. Please try again.");
      }
    } finally {
      setCreating(false);
    }
  };

  // --- 3. DELETE SCRIPT ---
  const handleDeleteScript = async (id) => {
    try {
      await deleteScript(id);
      message.success("Script deleted.");
      // Optimistically remove from UI
      setScripts((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error(err);
      message.error("Failed to delete script. You might not be the owner.");
    }
  };

  // --- UTILS ---
  const formatDate = (isoString) => {
    if (!isoString) return "N/A";
    return new Date(isoString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getPermissionIcon = (role) => {
    if (role === "owner") return <UserOutlined />;
    if (role === "editor") return <FileTextOutlined />;
    return <TeamOutlined />;
  };

  // --- FILTER & SORT ---
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

  if (loading) {
    return <CenteredLoader height="100%" />;
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
      {/* --- CONTROL BAR --- */}
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
        />
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
                // Navigate on card click
                onClick={() => navigate(`/script/${script.id}`)}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <Meta
                      avatar={
                        <FileTextOutlined
                          style={{ fontSize: 24, color: token.colorPrimary }}
                        />
                      }
                      title={
                        <Tooltip title={script.title}>
                          <span style={{ display: "block", maxWidth: "100%" }}>
                            {script.title}
                          </span>
                        </Tooltip>
                      }
                    />
                    {/* Role Badge (Owner vs Shared) */}
                    {script.permission !== "owner" && (
                      <Tag color="blue" style={{ marginRight: 0 }}>
                        Shared
                      </Tag>
                    )}
                  </div>

                  <div style={{ marginTop: 20, fontSize: 12 }}>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <ClockCircleOutlined />
                      <span>Updated: {formatDate(script.updatedAt)}</span>
                    </div>
                    {/* Show Owner Name if not me */}
                    {script.permission !== "owner" && (
                      <div
                        style={{ color: token.colorTextTertiary, marginTop: 4 }}
                      >
                        Owner: {script.ownerName}
                      </div>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 24,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Button type="primary">Open</Button>

                  {/* Only show delete if owner */}
                  {script.permission === "owner" && (
                    <Popconfirm
                      title="Delete Script"
                      description="Are you sure? This cannot be undone."
                      onConfirm={(e) => {
                        e.stopPropagation();
                        handleDeleteScript(script.id);
                      }}
                      onCancel={(e) => e.stopPropagation()}
                      okText="Delete"
                      okButtonProps={{ danger: true }}
                      cancelText="Cancel"
                      icon={<QuestionCircleOutlined style={{ color: "red" }} />}
                    >
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={(e) => e.stopPropagation()} // Stop card click
                      />
                    </Popconfirm>
                  )}
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
                cursor: "pointer",
              }}
              onClick={() => navigate(`/script/${item.id}`)}
              actions={[
                <Button
                  type="primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/script/${item.id}`);
                  }}
                >
                  Open
                </Button>,
                item.permission === "owner" && (
                  <Popconfirm
                    title="Delete Script"
                    description="Permanently delete this script?"
                    onConfirm={(e) => {
                      e.stopPropagation();
                      handleDeleteScript(item.id);
                    }}
                    onCancel={(e) => e.stopPropagation()}
                    okText="Delete"
                    okButtonProps={{ danger: true }}
                    cancelText="Cancel"
                  >
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Popconfirm>
                ),
              ]}
            >
              <List.Item.Meta
                avatar={
                  <FileTextOutlined
                    style={{ fontSize: 24, color: token.colorPrimary }}
                  />
                }
                title={item.title}
                description={
                  <Space size="large" style={{ fontSize: 12 }}>
                    <span>Updated: {formatDate(item.updatedAt)}</span>
                    {item.permission !== "owner" && (
                      <Tag color="geekblue">Owner: {item.ownerName}</Tag>
                    )}
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
