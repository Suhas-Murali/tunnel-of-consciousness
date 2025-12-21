import { useState, useEffect } from "react";
import {
  Typography,
  Input,
  Button,
  List,
  Avatar,
  Select,
  Tag,
  Space,
  Popconfirm,
  message,
  Card,
  Spin,
  Divider,
} from "antd";
import { UserOutlined, SendOutlined } from "@ant-design/icons";

import {
  renameScript,
  shareScript,
  updateScriptPermission,
  removeCollaborator,
  transferOwnership,
} from "../../api";

const { Text } = Typography;
const { Option } = Select;

// ==========================================
// SCRIPT SETTINGS TAB (Permissions & Metadata)
// ==========================================
const ScriptSettings = ({
  script: inScript,
  currentUser,
  onRename,
  onDelete,
  loadScriptData,
}) => {
  const [script, setScript] = useState(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    setScript(inScript);
    setRenameValue(inScript.name);
  }, [inScript]);

  if (!script) {
    return null;
  }

  // --- ACTIONS ---
  const handleRename = async () => {
    if (!renameValue.trim() || renameValue === script.name) return;
    try {
      await renameScript(script._id, renameValue);
      message.success("Script renamed.");
      loadScriptData();
      if (onRename) onRename(renameValue); // Update parent UI if needed
    } catch (err) {
      message.error("Failed to rename script.");
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail) return;
    try {
      await shareScript(script._id, inviteEmail, inviteRole);
      message.success(`Invited ${inviteEmail}`);
      setInviteEmail("");
      loadScriptData();
    } catch (err) {
      message.error(err.response?.data?.error || "Failed to invite user.");
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await updateScriptPermission(script._id, userId, newRole);
      message.success("Permissions updated.");
      loadScriptData();
    } catch (err) {
      message.error("Failed to update role.");
    }
  };

  const handleRemoveUser = async (userId) => {
    try {
      await removeCollaborator(script._id, userId);
      message.success("User removed.");
      loadScriptData();
    } catch (err) {
      message.error("Failed to remove user.");
    }
  };

  const handleLeaveScript = async () => {
    try {
      await removeCollaborator(script._id, currentUser.id);
      message.success("You left the script.");
      onDelete(); // Navigate away
    } catch (err) {
      message.error("Failed to leave script.");
    }
  };

  const handleTransfer = async () => {
    const newOwnerId = prompt("Enter the User ID of the new owner (Advanced):");
    if (!newOwnerId) return;
    try {
      await transferOwnership(script._id, newOwnerId);
      message.success("Ownership transferred.");
      loadScriptData();
    } catch (err) {
      message.error("Transfer failed. Check User ID.");
    }
  };

  const isOwner = script?.owner?._id === currentUser.id;

  // Combine Owner + Collaborators for the list
  const userList = [
    { ...script.owner, role: "owner", _id: script.owner._id },
    ...script.collaborators.map((c) => ({
      ...c.user,
      role: c.role,
      _id: c.user._id,
    })),
  ];

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", paddingBottom: 40 }}>
      {/* 1. General Settings */}
      <Card title="General" style={{ marginBottom: 24 }}>
        <Text strong>Script Name</Text>
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            disabled={!isOwner}
          />
          {isOwner && (
            <Button type="primary" onClick={handleRename}>
              Save
            </Button>
          )}
        </div>
      </Card>

      {/* 2. Collaboration */}
      <Card title="Collaborators" style={{ marginBottom: 24 }}>
        {isOwner && (
          <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
            <Input
              placeholder="Enter email to invite"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              prefix={<UserOutlined />}
            />
            <Select
              value={inviteRole}
              onChange={setInviteRole}
              style={{ width: 120 }}
            >
              <Option value="viewer">Viewer</Option>
              <Option value="editor">Editor</Option>
            </Select>
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleInvite}
            >
              Invite
            </Button>
          </div>
        )}

        <List
          itemLayout="horizontal"
          dataSource={userList}
          renderItem={(item) => (
            <List.Item
              actions={[
                // Action: Role Select (Only Owner can change others)
                isOwner && item.role !== "owner" ? (
                  <Select
                    defaultValue={item.role}
                    size="small"
                    style={{ width: 100 }}
                    onChange={(val) => handleRoleChange(item._id, val)}
                  >
                    <Option value="viewer">Viewer</Option>
                    <Option value="editor">Editor</Option>
                  </Select>
                ) : (
                  <Tag color={item.role === "owner" ? "gold" : "blue"}>
                    {item.role.toUpperCase()}
                  </Tag>
                ),
                // Action: Remove (Only Owner can remove others)
                isOwner && item.role !== "owner" && (
                  <Popconfirm
                    title="Remove user?"
                    onConfirm={() => handleRemoveUser(item._id)}
                  >
                    <Button type="text" danger size="small">
                      Remove
                    </Button>
                  </Popconfirm>
                ),
              ]}
            >
              <List.Item.Meta
                avatar={<Avatar icon={<UserOutlined />} />}
                title={
                  <span>
                    {item.username} {item._id === currentUser.id && "(You)"}
                  </span>
                }
                description={item.email}
              />
            </List.Item>
          )}
        />
      </Card>

      {/* 3. Danger Zone */}
      <Card
        title={<span style={{ color: "#ff4d4f" }}>Danger Zone</span>}
        style={{ borderColor: "#ffa39e" }}
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          {isOwner ? (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <Text strong>Transfer Ownership</Text>
                  <div style={{ fontSize: 12, color: "#888" }}>
                    Give full control to another user. You will become an
                    editor.
                  </div>
                </div>
                <Button onClick={handleTransfer}>Transfer</Button>
              </div>
              <Divider style={{ margin: "12px 0" }} />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <Text strong type="danger">
                    Delete Script
                  </Text>
                  <div style={{ fontSize: 12, color: "#888" }}>
                    Permanently delete this script and all its data.
                  </div>
                </div>
                <Popconfirm
                  title="Delete Script"
                  description="Are you absolutely sure? This cannot be undone."
                  onConfirm={onDelete}
                  okText="Yes, Delete"
                  okButtonProps={{ danger: true }}
                >
                  <Button danger type="primary">
                    Delete Script
                  </Button>
                </Popconfirm>
              </div>
            </>
          ) : (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <Text strong type="danger">
                  Leave Script
                </Text>
                <div style={{ fontSize: 12, color: "#888" }}>
                  Remove yourself from this script.
                </div>
              </div>
              <Popconfirm title="Leave Script?" onConfirm={handleLeaveScript}>
                <Button danger>Leave</Button>
              </Popconfirm>
            </div>
          )}
        </Space>
      </Card>
    </div>
  );
};

export { ScriptSettings };
