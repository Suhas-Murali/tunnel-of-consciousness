import React, { useState, useEffect, useMemo } from "react";
import {
	theme,
	Select,
	Space,
	Empty,
	Typography,
	Tag,
	Divider,
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
	AimOutlined,
	UserOutlined,
} from "@ant-design/icons";

const { Title, Text, Paragraph } = Typography;

// Helper for generating colors for Characters (Scenes now have colors in data)
const stringToColor = (str) => {
	let hash = 0;
	for (let i = 0; i < str.length; i++)
		hash = str.charCodeAt(i) + ((hash << 5) - hash);
	const c = (hash & 0x00ffffff).toString(16).toUpperCase();
	return "#" + "00000".substring(0, 6 - c.length) + c;
};

const FALLBACK_SENTIMENTS = [
	{ key: "joy", label: "Joyful", color: "gold" },
	{ key: "hope", label: "Hopeful", color: "lime" },
	{ key: "calm", label: "Calm", color: "blue" },
	{ key: "tension", label: "Tense", color: "volcano" },
	{ key: "sadness", label: "Somber", color: "purple" },
	{ key: "anger", label: "Angry", color: "red" },
	{ key: "fear", label: "Fearful", color: "orange" },
	{ key: "neutral", label: "Neutral", color: "default" },
];

const EMOTION_ALIASES = {
	joy: "joy",
	happy: "joy",
	positive: "joy",
	hope: "hope",
	hopeful: "hope",
	optimistic: "hope",
	calm: "calm",
	peaceful: "calm",
	neutral: "neutral",
	stable: "neutral",
	tense: "tension",
	tension: "tension",
	anxious: "fear",
	fear: "fear",
	fearful: "fear",
	sad: "sadness",
	sadness: "sadness",
	melancholy: "sadness",
	anger: "anger",
	angry: "anger",
	frustrated: "anger",
};

const SYNOPSIS_FAIL_REGEX =
	/(analysis\s*failed|failed\s*analysis|unable\s*to\s*(analy[sz]e|generate)|waiting\s*for\s*analysis)/i;

const clampPercent = (value, fallback = 0) => {
	const n = Number(value);
	if (!Number.isFinite(n)) return fallback;
	return Math.max(0, Math.min(100, Math.round(n)));
};

const pickBand = (value, bands) => {
	for (const band of bands) {
		if (value <= band.max) return band.label;
	}
	return bands[bands.length - 1].label;
};

const hashString = (str = "") => {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = (hash << 5) - hash + str.charCodeAt(i);
		hash |= 0;
	}
	return Math.abs(hash);
};

const normalizeEmotionKey = (value) => {
	if (typeof value === "number") {
		if (value > 0.2) return "joy";
		if (value < -0.2) return "sadness";
		return "neutral";
	}
	if (typeof value !== "string") return null;
	const normalized = value.trim().toLowerCase();
	if (!normalized) return null;
	return EMOTION_ALIASES[normalized] || null;
};

const getSentimentMeta = (key) =>
	FALLBACK_SENTIMENTS.find((s) => s.key === key) ||
	FALLBACK_SENTIMENTS[FALLBACK_SENTIMENTS.length - 1];

const getSceneLinePreview = (scene) => {
	if (!scene) return "";
	const lineCandidates = Array.isArray(scene.lines)
		? scene.lines
				.map((line) => {
					if (!line || !line.text) return "";
					if (line.type === "dialogue" && line.speaker) {
						return `${line.speaker}: ${line.text}`;
					}
					return line.text;
				})
				.filter(Boolean)
				.slice(0, 2)
		: [];

	if (lineCandidates.length > 0) return lineCandidates.join("\n");

	const rawCandidates = (scene.rawText || "")
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean)
		.slice(0, 2);

	return rawCandidates.join("\n");
};

const getSynopsisText = (scene) => {
	if (!scene) return "Waiting for analysis...";
	const synopsis = (scene.synopsis || "").trim();
	if (synopsis && !SYNOPSIS_FAIL_REGEX.test(synopsis)) {
		return synopsis;
	}
	const fallback = getSceneLinePreview(scene);
	return fallback || "Waiting for analysis...";
};

const getDominantSentiment = (scene, characterById) => {
	const tally = {};
	const addVote = (emotionKey, weight = 1) => {
		if (!emotionKey) return;
		tally[emotionKey] = (tally[emotionKey] || 0) + weight;
	};

	if (Array.isArray(scene?.lines)) {
		scene.lines.forEach((line) => {
			if (!line || line.type !== "dialogue") return;
			addVote(normalizeEmotionKey(line.emotion || line.sentiment || line.tone));
		});
	}

	if (Object.keys(tally).length === 0 && Array.isArray(scene?.characters)) {
		scene.characters.forEach((charName) => {
			const character = characterById[charName];
			const emotionKey = normalizeEmotionKey(character?.emotion);
			const weight = Math.max(1, scene?.charLineCounts?.[charName] || 1);
			addVote(emotionKey, weight);
		});
	}

	if (Object.keys(tally).length === 0) {
		const metricSentiment = normalizeEmotionKey(scene?.metrics?.sentiment);
		if (metricSentiment) {
			return { ...getSentimentMeta(metricSentiment), source: "metric" };
		}
	}

	if (Object.keys(tally).length === 0) {
		const idx =
			hashString(scene?.id || scene?.name || "scene") %
			FALLBACK_SENTIMENTS.length;
		return { ...FALLBACK_SENTIMENTS[idx], source: "random" };
	}

	const dominantKey = Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0];
	return { ...getSentimentMeta(dominantKey), source: "dialogue" };
};

export const SceneOverview = ({ provider }) => {
	const { token } = theme.useToken();
	const [scenes, setScenes] = useState([]);
	const [characters, setCharacters] = useState([]);
	const [selectedId, setSelectedId] = useState(null);

	// --- 1. Subscribe to YJS Data (Passive Read) ---
	useEffect(() => {
		if (!provider) return;
		const map = provider.document.getMap("script_analysis");

		const updateHandler = () => {
			const loadedScenes = map.get("scenes") || [];
			const loadedCharacters = map.get("characters") || [];
			setScenes(loadedScenes);
			setCharacters(loadedCharacters);
		};

		updateHandler();
		map.observe(updateHandler);
		return () => map.unobserve(updateHandler);
	}, [provider]);

	// Auto-select first scene on load
	useEffect(() => {
		if (!selectedId && scenes.length > 0) {
			setSelectedId(scenes[0].id);
		}
	}, [scenes, selectedId]);

	const activeScene = useMemo(
		() => scenes.find((s) => s.id === selectedId),
		[selectedId, scenes],
	);

	const characterById = useMemo(
		() =>
			characters.reduce((acc, c) => {
				acc[c.id] = c;
				return acc;
			}, {}),
		[characters],
	);

	const metrics = activeScene?.metrics || {};
	const pacingValue = clampPercent(metrics.pacing, 0);
	const readSpeedValue = clampPercent(metrics.linguisticDensity, 0);
	const actionRatioValue = clampPercent(metrics.actionRatio, 50);

	const pacingLabel = pickBand(pacingValue, [
		{ max: 14, label: "Still" },
		{ max: 28, label: "Deliberate" },
		{ max: 42, label: "Measured" },
		{ max: 57, label: "Steady" },
		{ max: 71, label: "Lively" },
		{ max: 85, label: "Brisk" },
		{ max: 100, label: "Breakneck" },
	]);

	const readSpeedLabel = pickBand(readSpeedValue, [
		{ max: 14, label: "Sparse" },
		{ max: 28, label: "Light" },
		{ max: 42, label: "Easy" },
		{ max: 57, label: "Balanced" },
		{ max: 71, label: "Dense" },
		{ max: 85, label: "Heavy" },
		{ max: 100, label: "Intense" },
	]);

	const actionRatioLabel = pickBand(actionRatioValue, [
		{ max: 14, label: "Dialogue-led" },
		{ max: 28, label: "Talk-heavy" },
		{ max: 42, label: "Conversation-forward" },
		{ max: 57, label: "Balanced" },
		{ max: 71, label: "Active" },
		{ max: 85, label: "Action-heavy" },
		{ max: 100, label: "Explosive" },
	]);

	const displaySynopsis = useMemo(
		() => getSynopsisText(activeScene),
		[activeScene],
	);
	const dominantSentiment = useMemo(
		() => getDominantSentiment(activeScene, characterById),
		[activeScene, characterById],
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
			{/* Selector Header */}
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
										backgroundColor: s.color || "#ccc",
									}}
								/>
								{s.name}
							</Space>
						),
					}))}
				/>
			</div>

			{/* Content Area */}
			<div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
				{!selectedId || !activeScene ? (
					<Empty
						image={Empty.PRESENTED_IMAGE_SIMPLE}
						description="No Scene Data Available"
						style={{ marginTop: 40 }}
					/>
				) : (
					<div>
						{/* Header Metrics */}
						<div style={{ marginBottom: 20 }}>
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
							<Space style={{ marginTop: 8 }} wrap>
								<Tag icon={<ClockCircleOutlined />}>
									{activeScene.durationSecs}s
								</Tag>
								<Tag color={activeScene.type === "Action" ? "red" : "blue"}>
									{activeScene.type}
								</Tag>
								<Tag color={dominantSentiment.color}>
									{dominantSentiment.label}
								</Tag>
							</Space>
						</div>

						{/* Synopsis */}
						<Paragraph
							type="secondary"
							style={{
								fontStyle: "italic",
								borderLeft: `3px solid ${token.colorBorder}`,
								paddingLeft: 12,
								whiteSpace: "pre-line",
							}}
						>
							{displaySynopsis}
						</Paragraph>

						{/* Metrics Grid */}
						{activeScene.metrics && (
							<>
								<Divider orientation="left" style={{ fontSize: 13 }}>
									<BarChartOutlined /> Analysis
								</Divider>
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
										size={8}
									>
										{/* Pacing */}
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
												{pacingValue}/100
											</span>
										</div>
										<Progress
											percent={pacingValue}
											showInfo={false}
											strokeColor={token.colorPrimary}
											size="small"
										/>
										<Text
											type="secondary"
											style={{ fontSize: 11, marginBottom: 6 }}
										>
											{pacingLabel}
										</Text>

										{/* Read Speed */}
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
												{readSpeedValue}/100
											</span>
										</div>
										<Progress
											percent={readSpeedValue}
											showInfo={false}
											strokeColor={token.colorWarning}
											size="small"
										/>
										<Text
											type="secondary"
											style={{ fontSize: 11, marginBottom: 6 }}
										>
											{readSpeedLabel}
										</Text>

										{/* Action Ratio */}
										<div
											style={{
												display: "flex",
												justifyContent: "space-between",
												fontSize: 12,
											}}
										>
											<span>Act/Dial</span>
											<span style={{ fontWeight: "bold" }}>
												{actionRatioValue}/100
											</span>
										</div>
										<Progress
											percent={actionRatioValue}
											success={{ percent: 0 }}
											strokeColor={token.colorError}
											trailColor={token.colorInfoBg}
											showInfo={false}
											size="small"
										/>
										<Text type="secondary" style={{ fontSize: 11 }}>
											{actionRatioLabel}
										</Text>
									</Space>
								</Card>
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

						{/* Character List */}
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
