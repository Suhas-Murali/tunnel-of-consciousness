import React, { useContext, useEffect, useMemo, useState } from "react";
import {
	Card,
	Col,
	Empty,
	Progress,
	Row,
	Select,
	Space,
	Statistic,
	Tag,
	Typography,
	theme,
} from "antd";
import {
	CompassOutlined,
	DotChartOutlined,
	FieldTimeOutlined,
	GlobalOutlined,
	LineChartOutlined,
	RadarChartOutlined,
	UsergroupAddOutlined,
} from "@ant-design/icons";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	ComposedChart,
	Legend,
	Line,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { ScriptStateContext } from "../contexts";

const { Text, Title } = Typography;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const formatDuration = (seconds) => {
	const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
	const mins = Math.floor(safe / 60);
	const secs = safe % 60;
	return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
};

const parseSceneMeta = (sceneName = "") => {
	const heading = String(sceneName).trim();
	const upper = heading.toUpperCase();
	let environment = "MIXED";

	if (upper.startsWith("INT.")) environment = "INT";
	if (upper.startsWith("EXT.")) environment = "EXT";
	if (upper.startsWith("INT/EXT") || upper.startsWith("I/E")) {
		environment = "MIXED";
	}

	const cleanHeading = upper.replace(
		/^(INT\.?|EXT\.?|INT\/EXT\.?|I\/E\.?)\s*/i,
		"",
	);
	const [locationChunk, timeChunk] = cleanHeading.split(" - ");

	return {
		environment,
		location: (locationChunk || "UNSPECIFIED").trim() || "UNSPECIFIED",
		timeOfDay: (timeChunk || "UNKNOWN").trim() || "UNKNOWN",
	};
};

const chartCardStyle = (token) => ({
	minHeight: 360,
	overflow: "hidden",
	background: `linear-gradient(160deg, ${token.colorBgContainer} 0%, ${token.colorFillQuaternary} 100%)`,
	border: `1px solid ${token.colorBorderSecondary}`,
	borderRadius: token.borderRadiusLG,
});

const kpiCardStyle = (token) => ({
	background: `linear-gradient(160deg, ${token.colorBgContainer} 0%, ${token.colorFillQuaternary} 100%)`,
	border: `1px solid ${token.colorBorderSecondary}`,
	borderRadius: token.borderRadiusLG,
});

const tooltipStyle = {
	border: "none",
	borderRadius: 10,
	boxShadow: "0 8px 24px rgba(15, 23, 42, 0.22)",
};

export const StoryAnalytics = ({ provider }) => {
	const { token } = theme.useToken();
	const { selectedLanguage, showTranslated } = useContext(ScriptStateContext);
	const [scenes, setScenes] = useState([]);
	const [characters, setCharacters] = useState([]);
	const [settings, setSettings] = useState({
		selectedLanguage: "en",
		showTranslated: false,
		lastContentHashByLanguage: {},
		lastContentHash: null,
	});
	const [hasTranslationSnapshot, setHasTranslationSnapshot] = useState(false);

	const [selectedSceneId, setSelectedSceneId] = useState(null);
	const [selectedCharacterId, setSelectedCharacterId] = useState(null);

	useEffect(() => {
		if (!provider) return;

		const analysisMap = provider.document.getMap("script_analysis");
		const settingsMap = provider.document.getMap("script_settings");
		const translationsMap = provider.document.getMap("script_translations");

		const updateAnalysis = () => {
			setScenes(analysisMap.get("scenes") || []);
			setCharacters(analysisMap.get("characters") || []);
		};

		const updateSettings = () => {
			setSettings({
				selectedLanguage: settingsMap.get("selectedLanguage") || "en",
				showTranslated: settingsMap.get("showTranslated") || false,
				lastContentHashByLanguage:
					settingsMap.get("lastContentHashByLanguage") || {},
				lastContentHash: settingsMap.get("lastContentHash") || null,
			});
		};

		const updateTranslationState = () => {
			const lang = settingsMap.get("selectedLanguage") || "en";
			setHasTranslationSnapshot(Boolean(translationsMap.get(`latest:${lang}`)));
		};

		updateAnalysis();
		updateSettings();
		updateTranslationState();

		analysisMap.observe(updateAnalysis);
		settingsMap.observe(updateSettings);
		settingsMap.observe(updateTranslationState);
		translationsMap.observe(updateTranslationState);

		return () => {
			analysisMap.unobserve(updateAnalysis);
			settingsMap.unobserve(updateSettings);
			settingsMap.unobserve(updateTranslationState);
			translationsMap.unobserve(updateTranslationState);
		};
	}, [provider]);

	useEffect(() => {
		if (!scenes.length) {
			setSelectedSceneId(null);
			return;
		}

		setSelectedSceneId((previous) => {
			const exists = scenes.some((scene) => scene.id === previous);
			return exists ? previous : scenes[0].id;
		});
	}, [scenes]);

	useEffect(() => {
		if (!characters.length) {
			setSelectedCharacterId(null);
			return;
		}

		setSelectedCharacterId((previous) => {
			const exists = characters.some((character) => character.id === previous);
			return exists ? previous : characters[0].id;
		});
	}, [characters]);

	const sceneAnalytics = useMemo(() => {
		if (!scenes.length) return [];

		const maxDuration = Math.max(
			1,
			...scenes.map((scene) => Number(scene.durationSecs) || 0),
		);
		const maxCast = Math.max(
			1,
			...scenes.map((scene) => (scene.characters || []).length || 0),
		);

		let cumulativeDuration = 0;

		return scenes.map((scene, index) => {
			const duration = Number(scene.durationSecs) || 0;
			const castCount = (scene.characters || []).length || 0;
			const actionRatio = Number(scene.metrics?.actionRatio) || 0;
			const pacing = Number(scene.metrics?.pacing) || 0;
			const sentiment = Number(scene.metrics?.sentiment) || 0;
			const meta = parseSceneMeta(scene.name);
			const dialogueLines = Object.values(scene.charLineCounts || {}).reduce(
				(acc, value) => acc + (Number(value) || 0),
				0,
			);

			const complexity = clamp(
				Math.round(
					actionRatio * 0.45 +
						(duration / maxDuration) * 30 +
						(castCount / maxCast) * 25,
				),
				0,
				100,
			);

			const start = cumulativeDuration;
			cumulativeDuration += duration;

			return {
				id: scene.id,
				name: scene.name,
				shortName: `S${index + 1}`,
				index: index + 1,
				duration,
				castCount,
				actionRatio,
				pacing,
				sentiment,
				complexity,
				dialogueLines,
				location: meta.location,
				environment: meta.environment,
				timeOfDay: meta.timeOfDay,
				structuralBeat: scene.metrics?.structuralBeat || "None",
				focusCharacter: scene.focusCharacter || "N/A",
				startTime: start,
				endTime: start + duration,
				color: scene.color || token.colorPrimary,
			};
		});
	}, [scenes, token.colorPrimary]);

	const characterAnalytics = useMemo(() => {
		return characters
			.map((character) => {
				const degree = Number(character.metrics?.degreeCentrality) || 0;
				const betweenness = Number(character.metrics?.betweenness) || 0;
				const influence = clamp(
					Math.round((degree * 0.65 + betweenness * 0.35) * 100),
					0,
					100,
				);
				const scenesCovered = (character.scenes || []).length || 0;
				const dialogueCount = Number(character.dialogueCount) || 0;
				const productionLoad = Math.max(
					1,
					Math.ceil((dialogueCount + scenesCovered * 4) / 12),
				);
				const emotion = (character.emotion || "neutral").toLowerCase();
				return {
					id: character.id,
					name: character.name,
					role: character.role || "Minor",
					dialogueCount,
					scenesCovered,
					degree,
					betweenness,
					influence,
					productionLoad,
					emotion,
					color: character.color || token.colorPrimary,
				};
			})
			.sort((a, b) => b.influence - a.influence);
	}, [characters, token.colorPrimary]);

	const selectedCharacterTimeline = useMemo(() => {
		if (!selectedCharacterId) return [];
		return sceneAnalytics.map((scene) => {
			const linkedScene = scenes.find((source) => source.id === scene.id);
			const dialogueInScene =
				Number(linkedScene?.charLineCounts?.[selectedCharacterId]) || 0;
			const appears = (linkedScene?.characters || []).includes(
				selectedCharacterId,
			)
				? 1
				: 0;

			return {
				scene: scene.shortName,
				dialogue: dialogueInScene,
				presence: appears,
			};
		});
	}, [sceneAnalytics, scenes, selectedCharacterId]);

	const locationDataset = useMemo(() => {
		const bucket = new Map();
		sceneAnalytics.forEach((scene) => {
			const existing = bucket.get(scene.location) || {
				name: scene.location,
				runtime: 0,
				scenes: 0,
				avgComplexity: 0,
			};
			existing.runtime += scene.duration;
			existing.scenes += 1;
			existing.avgComplexity += scene.complexity;
			bucket.set(scene.location, existing);
		});

		return Array.from(bucket.values())
			.map((entry) => ({
				...entry,
				avgComplexity: Math.round(
					entry.avgComplexity / Math.max(1, entry.scenes),
				),
			}))
			.sort((a, b) => b.runtime - a.runtime)
			.slice(0, 8);
	}, [sceneAnalytics]);

	const kpis = useMemo(() => {
		const totalRuntime = sceneAnalytics.reduce(
			(acc, scene) => acc + scene.duration,
			0,
		);
		const uniqueLocations = new Set(
			sceneAnalytics.map((scene) => scene.location),
		).size;
		const avgComplexity = Math.round(
			sceneAnalytics.reduce((acc, scene) => acc + scene.complexity, 0) /
				Math.max(1, sceneAnalytics.length),
		);
		return {
			totalRuntime,
			totalScenes: sceneAnalytics.length,
			uniqueLocations,
			avgComplexity,
		};
	}, [sceneAnalytics]);

	const activeScene = useMemo(
		() => sceneAnalytics.find((scene) => scene.id === selectedSceneId),
		[sceneAnalytics, selectedSceneId],
	);

	const activeCharacter = useMemo(
		() =>
			characterAnalytics.find(
				(character) => character.id === selectedCharacterId,
			),
		[characterAnalytics, selectedCharacterId],
	);

	const chartTick = useMemo(
		() => ({ fill: token.colorTextSecondary, fontSize: 12 }),
		[token.colorTextSecondary],
	);

	const legendProps = useMemo(
		() => ({
			wrapperStyle: { color: token.colorTextSecondary, fontSize: 12 },
			formatter: (value) => (
				<span style={{ color: token.colorTextSecondary }}>{value}</span>
			),
		}),
		[token.colorTextSecondary],
	);

	const tooltipProps = useMemo(
		() => ({
			contentStyle: {
				...tooltipStyle,
				background: token.colorBgElevated,
				color: token.colorText,
				border: `1px solid ${token.colorBorderSecondary}`,
			},
			labelStyle: { color: token.colorText },
			itemStyle: { color: token.colorText },
		}),
		[token.colorBgElevated, token.colorBorderSecondary, token.colorText],
	);

	if (!provider) return <Empty description="Story analytics unavailable" />;
	if (!scenes.length)
		return (
			<Empty
				image={Empty.PRESENTED_IMAGE_SIMPLE}
				description="Start writing to generate live story analytics"
				style={{ marginTop: 80 }}
			/>
		);

	return (
		<div
			style={{
				height: "100%",
				overflow: "auto",
				overflowX: "hidden",
				padding: 16,
				background: `radial-gradient(circle at top right, ${token.colorFillSecondary} 0%, ${token.colorBgContainer} 42%, ${token.colorBgLayout} 100%)`,
			}}
		>
			<div style={{ marginBottom: 14 }}>
				<Space
					wrap
					align="center"
					style={{ justifyContent: "space-between", width: "100%" }}
				>
					<div>
						<Title level={4} style={{ margin: 0 }}>
							Story Analytics Deck
						</Title>
					</div>
					<Space wrap>
						<Tag color="blue" icon={<GlobalOutlined />}>
							Language: {settings.selectedLanguage || selectedLanguage}
						</Tag>
						{(settings.showTranslated || showTranslated) && (
							<Tag color="purple">Translated View</Tag>
						)}
						{hasTranslationSnapshot && (
							<Tag color="cyan">Translation Snapshot Ready</Tag>
						)}
					</Space>
				</Space>
			</div>

			<Row gutter={[12, 12]} style={{ marginBottom: 14 }}>
				<Col xs={12} md={6}>
					<Card bordered={false} style={kpiCardStyle(token)}>
						<Statistic
							title="Est. Runtime"
							value={formatDuration(kpis.totalRuntime)}
							prefix={<FieldTimeOutlined />}
						/>
						<Progress
							percent={clamp(
								Math.round((kpis.totalRuntime / 5400) * 100),
								0,
								100,
							)}
							showInfo={false}
							strokeColor={token.colorPrimary}
							style={{ marginTop: 14 }}
						/>
						<Text type="secondary">
							Measured from scene durations in Yjs analysis.
						</Text>
					</Card>
				</Col>
				<Col xs={12} md={6}>
					<Card bordered={false} style={kpiCardStyle(token)}>
						<Statistic
							title="Scenes"
							value={kpis.totalScenes}
							prefix={<DotChartOutlined />}
						/>
						<Text type="secondary">Total analyzed scenes in the script.</Text>
					</Card>
				</Col>
				<Col xs={12} md={6}>
					<Card bordered={false} style={kpiCardStyle(token)}>
						<Statistic
							title="Locations"
							value={kpis.uniqueLocations}
							prefix={<CompassOutlined />}
						/>
						<Text type="secondary">
							Unique locations parsed from scene headings.
						</Text>
					</Card>
				</Col>
				<Col xs={12} md={6}>
					<Card bordered={false} style={kpiCardStyle(token)}>
						<Statistic
							title="Avg Complexity"
							value={kpis.avgComplexity}
							suffix="/100"
							prefix={<RadarChartOutlined />}
						/>
						<Progress
							percent={kpis.avgComplexity}
							showInfo={false}
							strokeColor={token.colorWarning}
							style={{ marginTop: 14 }}
						/>
					</Card>
				</Col>
			</Row>

			<Space
				size={8}
				align="center"
				style={{ width: "100%", marginBottom: 10 }}
			>
				<UsergroupAddOutlined style={{ color: token.colorPrimary }} />
				<Title level={5} style={{ margin: 0 }}>
					Producer and Director
				</Title>
			</Space>

			<Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
				<Col xs={24}>
					<Card
						title="Scene Complexity and Duration"
						style={chartCardStyle(token)}
					>
						<ResponsiveContainer width="100%" height={280}>
							<ComposedChart
								data={sceneAnalytics}
								margin={{ top: 10, right: 18, left: 4, bottom: 18 }}
								onClick={(payload) => {
									if (payload?.activePayload?.[0]?.payload?.id) {
										setSelectedSceneId(payload.activePayload[0].payload.id);
									}
								}}
							>
								<CartesianGrid
									stroke={token.colorBorderSecondary}
									strokeDasharray="3 3"
								/>
								<XAxis
									dataKey="shortName"
									stroke={token.colorTextSecondary}
									tick={chartTick}
								/>
								<YAxis
									yAxisId="left"
									stroke={token.colorTextSecondary}
									tick={chartTick}
									domain={[0, 100]}
								/>
								<YAxis
									yAxisId="right"
									orientation="right"
									stroke={token.colorTextSecondary}
									tick={chartTick}
								/>
								<Tooltip {...tooltipProps} />
								<Legend {...legendProps} />
								<Bar
									yAxisId="left"
									dataKey="complexity"
									name="Complexity"
									fill={token.colorPrimary}
									radius={[6, 6, 0, 0]}
								/>
								<Line
									yAxisId="right"
									type="monotone"
									dataKey="duration"
									name="Duration (s)"
									stroke={token.colorWarning}
									strokeWidth={2}
									dot={{ r: 2 }}
								/>
							</ComposedChart>
						</ResponsiveContainer>
					</Card>
				</Col>

				<Col xs={24}>
					<Card
						title="Location Runtime Allocation"
						style={{ ...chartCardStyle(token), minHeight: 500 }}
					>
						<ResponsiveContainer width="100%" height={420}>
							<BarChart
								data={locationDataset}
								layout="vertical"
								margin={{ top: 10, right: 24, left: 80, bottom: 8 }}
							>
								<CartesianGrid
									stroke={token.colorBorderSecondary}
									strokeDasharray="3 3"
								/>
								<XAxis
									type="number"
									stroke={token.colorTextSecondary}
									tick={chartTick}
								/>
								<YAxis
									type="category"
									dataKey="name"
									stroke={token.colorTextSecondary}
									tick={chartTick}
									width={220}
								/>
								<Tooltip
									{...tooltipProps}
									formatter={(value) => `${formatDuration(value)} runtime`}
								/>
								<Legend {...legendProps} />
								<Bar
									dataKey="runtime"
									name="Runtime"
									fill={token.colorInfo}
									radius={[0, 6, 6, 0]}
								/>
								<Line
									dataKey="avgComplexity"
									name="Avg Complexity"
									stroke={token.colorWarning}
									strokeWidth={2}
								/>
							</BarChart>
						</ResponsiveContainer>
					</Card>
				</Col>

				<Col xs={24}>
					<Card
						title="Cast Influence and Production Load"
						style={chartCardStyle(token)}
					>
						<ResponsiveContainer width="100%" height={280}>
							<BarChart
								data={characterAnalytics.slice(0, 10)}
								margin={{ top: 10, right: 20, left: 0, bottom: 42 }}
								onClick={(payload) => {
									if (payload?.activePayload?.[0]?.payload?.id) {
										setSelectedCharacterId(payload.activePayload[0].payload.id);
									}
								}}
							>
								<CartesianGrid
									stroke={token.colorBorderSecondary}
									strokeDasharray="3 3"
								/>
								<XAxis
									dataKey="name"
									stroke={token.colorTextSecondary}
									tick={chartTick}
									interval={0}
									angle={-22}
									textAnchor="end"
									height={86}
								/>
								<YAxis
									yAxisId="left"
									stroke={token.colorTextSecondary}
									tick={chartTick}
									domain={[0, 100]}
								/>
								<YAxis
									yAxisId="right"
									orientation="right"
									stroke={token.colorTextSecondary}
									tick={chartTick}
								/>
								<Tooltip {...tooltipProps} />
								<Legend {...legendProps} />
								<Bar
									yAxisId="left"
									dataKey="influence"
									fill={token.colorSuccess}
									name="Influence"
									radius={[6, 6, 0, 0]}
								/>
								<Line
									yAxisId="right"
									dataKey="productionLoad"
									stroke={token.colorWarning}
									strokeWidth={2}
									name="Production Load"
								/>
							</BarChart>
						</ResponsiveContainer>
					</Card>
				</Col>

				<Col xs={24}>
					<Card
						style={{
							border: `1px solid ${token.colorBorderSecondary}`,
							background: `linear-gradient(120deg, ${token.colorBgElevated} 0%, ${token.colorFillTertiary} 100%)`,
						}}
					>
						<Space direction="vertical" style={{ width: "100%" }}>
							<Text type="secondary">Focus Character</Text>
							<Select
								placeholder="Select character"
								value={selectedCharacterId}
								onChange={setSelectedCharacterId}
								options={characterAnalytics.map((character) => ({
									value: character.id,
									label: character.name,
								}))}
							/>
						</Space>
					</Card>
				</Col>

				<Col xs={24}>
					<Card
						title={`Character Presence Timeline${
							activeCharacter ? `: ${activeCharacter.name}` : ""
						}`}
						style={chartCardStyle(token)}
					>
						{selectedCharacterId ? (
							<ResponsiveContainer width="100%" height={280}>
								<AreaChart
									data={selectedCharacterTimeline}
									margin={{ top: 10, right: 20, left: 0, bottom: 8 }}
								>
									<CartesianGrid
										stroke={token.colorBorderSecondary}
										strokeDasharray="3 3"
									/>
									<XAxis
										dataKey="scene"
										stroke={token.colorTextSecondary}
										tick={chartTick}
									/>
									<YAxis stroke={token.colorTextSecondary} tick={chartTick} />
									<Tooltip {...tooltipProps} />
									<Legend {...legendProps} />
									<Area
										type="monotone"
										dataKey="dialogue"
										fill={token.colorPrimary}
										stroke={token.colorPrimary}
										name="Dialogue Lines"
										fillOpacity={0.35}
									/>
									<Line
										type="monotone"
										dataKey="presence"
										stroke={token.colorSuccess}
										name="Presence"
									/>
								</AreaChart>
							</ResponsiveContainer>
						) : (
							<Empty
								image={Empty.PRESENTED_IMAGE_SIMPLE}
								description="Select a character to see timeline"
							/>
						)}
					</Card>
				</Col>
			</Row>

			<Space
				size={8}
				align="center"
				style={{ width: "100%", marginBottom: 10 }}
			>
				<LineChartOutlined style={{ color: token.colorPrimary }} />
				<Title level={5} style={{ margin: 0 }}>
					Author Lens
				</Title>
			</Space>

			<Row gutter={[12, 12]} style={{ marginBottom: 14 }}>
				<Col xs={24}>
					<Card title="Narrative Action Flow" style={chartCardStyle(token)}>
						<ResponsiveContainer width="100%" height={280}>
							<BarChart
								data={sceneAnalytics}
								margin={{ top: 10, right: 18, left: 4, bottom: 18 }}
							>
								<CartesianGrid
									stroke={token.colorBorderSecondary}
									strokeDasharray="3 3"
								/>
								<XAxis
									dataKey="shortName"
									stroke={token.colorTextSecondary}
									tick={chartTick}
								/>
								<YAxis
									stroke={token.colorTextSecondary}
									tick={chartTick}
									domain={[0, 100]}
								/>
								<Tooltip {...tooltipProps} />
								<Legend {...legendProps} />
								<Bar
									dataKey="actionRatio"
									fill={token.colorInfo}
									name="Action Ratio"
									radius={[5, 5, 0, 0]}
								/>
							</BarChart>
						</ResponsiveContainer>
					</Card>
				</Col>

				<Col xs={24}>
					<Card title="Narrative Pacing Flow" style={chartCardStyle(token)}>
						<ResponsiveContainer width="100%" height={280}>
							<ComposedChart
								data={sceneAnalytics}
								margin={{ top: 10, right: 18, left: 4, bottom: 18 }}
							>
								<CartesianGrid
									stroke={token.colorBorderSecondary}
									strokeDasharray="3 3"
								/>
								<XAxis
									dataKey="shortName"
									stroke={token.colorTextSecondary}
									tick={chartTick}
								/>
								<YAxis
									stroke={token.colorTextSecondary}
									tick={chartTick}
									domain={[0, 100]}
								/>
								<Tooltip {...tooltipProps} />
								<Legend {...legendProps} />
								<Line
									type="monotone"
									dataKey="pacing"
									stroke={token.colorPrimary}
									strokeWidth={2}
									name="Pacing"
								/>
							</ComposedChart>
						</ResponsiveContainer>
					</Card>
				</Col>

				<Col xs={24}>
					<Card title="Dialogue Share" style={chartCardStyle(token)}>
						<ResponsiveContainer width="100%" height={280}>
							<BarChart
								data={characterAnalytics.slice(0, 10)}
								margin={{ top: 10, right: 20, left: 0, bottom: 42 }}
								onClick={(payload) => {
									if (payload?.activePayload?.[0]?.payload?.id) {
										setSelectedCharacterId(payload.activePayload[0].payload.id);
									}
								}}
							>
								<CartesianGrid
									stroke={token.colorBorderSecondary}
									strokeDasharray="3 3"
								/>
								<XAxis
									dataKey="name"
									stroke={token.colorTextSecondary}
									tick={chartTick}
									interval={0}
									angle={-22}
									textAnchor="end"
									height={86}
								/>
								<YAxis stroke={token.colorTextSecondary} tick={chartTick} />
								<Tooltip {...tooltipProps} />
								<Bar
									dataKey="dialogueCount"
									fill={token.colorPrimary}
									radius={[6, 6, 0, 0]}
								/>
							</BarChart>
						</ResponsiveContainer>
					</Card>
				</Col>
			</Row>

			<Card
				style={{
					marginTop: 14,
					marginBottom: 14,
					border: `1px solid ${token.colorBorderSecondary}`,
					background: `linear-gradient(120deg, ${token.colorBgElevated} 0%, ${token.colorFillTertiary} 100%)`,
				}}
			>
				<Space direction="vertical" style={{ width: "100%" }}>
					<Text type="secondary">Focus Scene</Text>
					<Select
						placeholder="Select scene"
						value={selectedSceneId}
						onChange={setSelectedSceneId}
						options={sceneAnalytics.map((scene) => ({
							value: scene.id,
							label: `${scene.shortName} ${scene.name}`,
						}))}
					/>
				</Space>
			</Card>

			{activeScene && (
				<Card
					title={
						<Space>
							<DotChartOutlined />
							Focused Scene Brief
						</Space>
					}
					style={{
						marginTop: 14,
						border: `1px solid ${token.colorBorderSecondary}`,
						background: token.colorBgContainer,
					}}
				>
					<Row gutter={[12, 12]}>
						<Col xs={24} md={12}>
							<Space direction="vertical" size={2}>
								<Text strong>{activeScene.name}</Text>
								<Text type="secondary">
									{activeScene.environment} | {activeScene.location} |{" "}
									{activeScene.timeOfDay}
								</Text>
							</Space>
						</Col>
						<Col xs={12} md={4}>
							<Statistic
								title="Complexity"
								value={activeScene.complexity}
								suffix="/100"
							/>
						</Col>
						<Col xs={12} md={4}>
							<Statistic
								title="Duration"
								value={formatDuration(activeScene.duration)}
							/>
						</Col>
					</Row>
				</Card>
			)}
		</div>
	);
};
