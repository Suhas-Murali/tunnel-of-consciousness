import React, { useState, useEffect, useMemo, useContext } from "react";
import {
	theme,
	Select,
	Space,
	Empty,
	Avatar,
	Typography,
	Tag,
	Row,
	Card,
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
	ClockCircleOutlined,
	NumberOutlined,
	PartitionOutlined,
} from "@ant-design/icons";
import { ScriptStateContext } from "../contexts";
import { DIALOGUE_DURATION_SECS } from "./scripteditor";

const { Text, Title, Paragraph } = Typography;

const CENTRALITY_BANDS = [
	{ max: 0.12, label: "Peripheral" },
	{ max: 0.24, label: "Marginal" },
	{ max: 0.36, label: "Visible" },
	{ max: 0.48, label: "Connected" },
	{ max: 0.6, label: "Influential" },
	{ max: 0.72, label: "Central" },
	{ max: 0.84, label: "Pivotal" },
	{ max: 1, label: "Core" },
];

const BRIDGE_BANDS = [
	{ max: 0.12, label: "Isolated" },
	{ max: 0.24, label: "Occasional Link" },
	{ max: 0.36, label: "Local Connector" },
	{ max: 0.48, label: "Cross-Group Link" },
	{ max: 0.6, label: "Narrative Bridge" },
	{ max: 0.72, label: "Key Mediator" },
	{ max: 0.84, label: "Hub Connector" },
	{ max: 1, label: "Critical Linchpin" },
];

const SENTIMENT_BANDS = [
	{ max: -0.75, label: "Deeply Distressed" },
	{ max: -0.5, label: "Distressed" },
	{ max: -0.25, label: "Low" },
	{ max: 0, label: "Uneasy" },
	{ max: 0.25, label: "Balanced" },
	{ max: 0.5, label: "Warm" },
	{ max: 0.75, label: "Upbeat" },
	{ max: 1, label: "Radiant" },
];

const EMOTION_LABELS = {
	joy: "Joyful",
	happy: "Joyful",
	hopeful: "Hopeful",
	hope: "Hopeful",
	calm: "Calm",
	neutral: "Neutral",
	tense: "Tense",
	tension: "Tense",
	anxious: "Anxious",
	fear: "Fearful",
	fearful: "Fearful",
	sad: "Sad",
	sadness: "Sad",
	melancholy: "Melancholic",
	anger: "Angry",
	angry: "Angry",
	frustrated: "Frustrated",
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const pickBand = (value, bands, fallback = "Unknown") => {
	if (!Number.isFinite(value)) return fallback;
	for (const band of bands) {
		if (value <= band.max) return band.label;
	}
	return bands[bands.length - 1]?.label || fallback;
};

const formatDuration = (seconds) => {
	const safe = Math.max(0, Math.round(Number(seconds) || 0));
	const mins = Math.floor(safe / 60);
	const secs = safe % 60;
	if (mins === 0) return `${secs}s`;
	return `${mins}m ${String(secs).padStart(2, "0")}s`;
};

const toTitle = (value = "") =>
	value
		.split(/\s+/)
		.filter(Boolean)
		.map(
			(chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1).toLowerCase(),
		)
		.join(" ");

const KeyValue = ({ label, value, icon }) => (
	<div
		style={{
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: 12,
			padding: "6px 0",
			borderBottom: "1px dashed rgba(0,0,0,0.08)",
		}}
	>
		<Space size={8}>
			{icon}
			<Text type="secondary" style={{ fontSize: 12 }}>
				{label}
			</Text>
		</Space>
		<Text strong style={{ fontSize: 13 }}>
			{value}
		</Text>
	</div>
);

export const CharacterOverview = ({ provider }) => {
	const { focusRequest } = useContext(ScriptStateContext);
	const { token } = theme.useToken();
	const [characters, setCharacters] = useState([]);
	const [selectedId, setSelectedId] = useState(null);

	// --- 1. Subscribe to YJS Data ---
	useEffect(() => {
		if (!provider) return;
		const map = provider.document.getMap("script_analysis");
		const updateHandler = () => setCharacters(map.get("characters") || []);
		updateHandler();
		map.observe(updateHandler);
		return () => map.unobserve(updateHandler);
	}, [provider]);

	// --- 2. Auto-Selection Logic ---

	// Default to first character on load
	useEffect(() => {
		if (!selectedId && characters.length > 0) {
			setSelectedId(characters[0].id);
		}
	}, [characters, selectedId]);

	// Sync with 3D Visualizer clicks
	useEffect(() => {
		if (focusRequest?.characterId) {
			setSelectedId(focusRequest.characterId);
		}
	}, [focusRequest]);

	const activeChar = useMemo(
		() => characters.find((c) => c.id === selectedId),
		[selectedId, characters],
	);

	const characterStats = useMemo(() => {
		if (!activeChar) {
			return {
				centralityLabel: "Unknown",
				bridgeLabel: "Unknown",
				dominantEmotionLabel: "Unknown",
				totalLines: 0,
				sceneCount: 0,
				screenTimeSecs: 0,
			};
		}

		const centrality = clamp(
			Number(activeChar.metrics?.degreeCentrality || 0),
			0,
			1,
		);
		const bridge = clamp(Number(activeChar.metrics?.betweenness || 0), 0, 1);
		const avgSentiment = clamp(
			Number(activeChar.metrics?.avgSentiment || 0),
			-1,
			1,
		);

		const sceneCount = Array.isArray(activeChar.scenes)
			? activeChar.scenes.length
			: 0;
		const totalLinesFromScenes = Array.isArray(activeChar.scenes)
			? activeChar.scenes.reduce(
					(sum, scene) => sum + (Number(scene?.dialogueCount) || 0),
					0,
				)
			: 0;
		const totalLines = Math.max(
			totalLinesFromScenes,
			Number(activeChar.dialogueCount) || 0,``
		);

		const normalizedEmotion = String(activeChar.emotion || "")
			.trim()
			.toLowerCase();

		const dominantEmotionLabel = normalizedEmotion
			? EMOTION_LABELS[normalizedEmotion] || toTitle(normalizedEmotion)
			: pickBand(avgSentiment, SENTIMENT_BANDS, "Neutral");

		return {
			centralityLabel: pickBand(centrality, CENTRALITY_BANDS),
			bridgeLabel: pickBand(bridge, BRIDGE_BANDS),
			dominantEmotionLabel,
			totalLines,
			sceneCount,
			screenTimeSecs: totalLines * DIALOGUE_DURATION_SECS * 2,
		};
	}, [activeChar]);

	return (
		<div
			style={{
				height: "100%",
				display: "flex",
				flexDirection: "column",
				background: token.colorBgContainer,
			}}
		>
			{/* Header Selector */}
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

			{/* Content Area */}
			<div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
				{!selectedId || !activeChar ? (
					<Empty
						image={Empty.PRESENTED_IMAGE_SIMPLE}
						description="No Character Data"
						style={{ marginTop: 40 }}
					/>
				) : (
					<div>
						{/* Header Info */}
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

						{/* Qualitative Metrics + Presence Attributes */}
						<div style={{ marginBottom: 24 }}>
							<Row gutter={[16, 16]}>
								<div style={{ width: "100%" }}>
									<Card
										size="small"
										title={
											<Space>
												<ShareAltOutlined /> Qualitative Profile
											</Space>
										}
										bordered={false}
										style={{ background: token.colorFillQuaternary }}
									>
										<KeyValue
											label="Centrality"
											value={characterStats.centralityLabel}
											icon={
												<RiseOutlined style={{ color: token.colorPrimary }} />
											}
										/>
										<KeyValue
											label="Bridge Role"
											value={characterStats.bridgeLabel}
											icon={
												<ShareAltOutlined
													style={{ color: token.colorWarning }}
												/>
											}
										/>
										<KeyValue
											label="Dominant Emotion"
											value={characterStats.dominantEmotionLabel}
											icon={
												<SmileOutlined style={{ color: token.colorSuccess }} />
											}
										/>
									</Card>

									<Card
										size="small"
										title={
											<Space>
												<NumberOutlined /> Presence Attributes
											</Space>
										}
										bordered={false}
										style={{
											marginTop: 12,
											background: token.colorFillQuaternary,
										}}
									>
										<KeyValue
											label="Total Lines"
											value={characterStats.totalLines}
											icon={
												<MessageOutlined style={{ color: token.colorText }} />
											}
										/>
										<KeyValue
											label="Scenes Appeared"
											value={characterStats.sceneCount}
											icon={
												<PartitionOutlined style={{ color: token.colorText }} />
											}
										/>
										<KeyValue
											label="Estimated Screen Time"
											value={formatDuration(characterStats.screenTimeSecs)}
											icon={
												<ClockCircleOutlined
													style={{ color: token.colorText }}
												/>
											}
										/>
									</Card>
								</div>
							</Row>
						</div>

						{/* Description */}
						<Divider orientation="left" style={{ fontSize: 13 }}>
							<Tag color="blue" icon={<UserOutlined />}>
								Characteristics
							</Tag>
						</Divider>
						<Paragraph type="secondary" style={{ fontSize: 13 }}>
							{activeChar.description}
						</Paragraph>

						{/* Dialogue List */}
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
