import React, { useContext, useEffect, useMemo, useState } from "react";
import {
	Alert,
	Card,
	Col,
	Empty,
	Progress,
	Row,
	Segmented,
	Select,
	Space,
	Statistic,
	Switch,
	Tabs,
	Tag,
	Typography,
	theme,
} from "antd";
import {
	CompassOutlined,
	DotChartOutlined,
	FieldTimeOutlined,
	FireOutlined,
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
	Cell,
	ComposedChart,
	Legend,
	Line,
	Pie,
	PieChart,
	ResponsiveContainer,
	Scatter,
	ScatterChart,
	Tooltip,
	XAxis,
	YAxis,
	ZAxis,
} from "recharts";
import { ScriptStateContext } from "../contexts";
import { emotionHierarchy } from "../../../visualizer/emotionHierarchy";

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

const getEmotionColorMap = () => {
	const map = {};
	emotionHierarchy.forEach((item) => {
		map[item.core.toLowerCase()] = item.color;
		item.secondary.forEach((secondary) => {
			map[secondary.name.toLowerCase()] = item.color;
			secondary.tertiary.forEach((tertiary) => {
				map[tertiary.toLowerCase()] = item.color;
			});
		});
	});
	return map;
};

const chartCardStyle = (token) => ({
	height: 330,
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

	const [environmentFilter, setEnvironmentFilter] = useState("all");
	const [roleFilter, setRoleFilter] = useState("all");
	const [riskOnly, setRiskOnly] = useState(false);
	const [selectedSceneId, setSelectedSceneId] = useState(null);
	const [selectedCharacterId, setSelectedCharacterId] = useState(null);

	const emotionColors = useMemo(() => getEmotionColorMap(), []);

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

	const filteredScenes = useMemo(() => {
		if (environmentFilter === "all") return scenes;
		return scenes.filter((scene) => {
			const meta = parseSceneMeta(scene.name);
			return meta.environment === environmentFilter;
		});
	}, [environmentFilter, scenes]);

	const sceneAnalytics = useMemo(() => {
		if (!filteredScenes.length) return [];

		const maxDuration = Math.max(
			1,
			...filteredScenes.map((scene) => Number(scene.durationSecs) || 0),
		);
		const maxCast = Math.max(
			1,
			...filteredScenes.map((scene) => (scene.characters || []).length || 0),
		);

		let cumulativeDuration = 0;

		return filteredScenes.map((scene, index) => {
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

			const riskScore = clamp(
				Math.round(
					complexity * 0.6 +
						Math.max(0, -sentiment) * 22 +
						Math.abs(sentiment) * 10 +
						(castCount > 5 ? 8 : 0),
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
				riskScore,
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
	}, [filteredScenes, token.colorPrimary]);

	const filteredSceneAnalytics = useMemo(() => {
		if (!riskOnly) return sceneAnalytics;
		return sceneAnalytics.filter((scene) => scene.riskScore >= 65);
	}, [riskOnly, sceneAnalytics]);

	const characterAnalytics = useMemo(() => {
		const roleFilterValue = roleFilter.toLowerCase();
		const roleFiltered = characters.filter((character) => {
			if (roleFilterValue === "all") return true;
			return (character.role || "minor").toLowerCase() === roleFilterValue;
		});

		return roleFiltered
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
	}, [characters, roleFilter, token.colorPrimary]);

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
		filteredSceneAnalytics.forEach((scene) => {
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
	}, [filteredSceneAnalytics]);

	const emotionalDistribution = useMemo(() => {
		const bucket = new Map();
		characterAnalytics.forEach((character) => {
			const key = character.emotion || "neutral";
			bucket.set(key, (bucket.get(key) || 0) + 1);
		});
		return Array.from(bucket.entries()).map(([name, value]) => ({
			name,
			value,
			color: emotionColors[name] || token.colorPrimary,
		}));
	}, [characterAnalytics, emotionColors, token.colorPrimary]);

	const structuralBeatDataset = useMemo(() => {
		const beats = {
			"Inciting Incident": 0,
			Midpoint: 0,
			Climax: 0,
			None: 0,
		};
		sceneAnalytics.forEach((scene) => {
			beats[scene.structuralBeat] = (beats[scene.structuralBeat] || 0) + 1;
		});
		return Object.entries(beats).map(([name, value]) => ({ name, value }));
	}, [sceneAnalytics]);

	const kpis = useMemo(() => {
		const totalRuntime = filteredSceneAnalytics.reduce(
			(acc, scene) => acc + scene.duration,
			0,
		);
		const highRiskScenes = filteredSceneAnalytics.filter(
			(scene) => scene.riskScore >= 65,
		).length;
		const uniqueLocations = new Set(
			filteredSceneAnalytics.map((scene) => scene.location),
		).size;
		const avgComplexity = Math.round(
			filteredSceneAnalytics.reduce((acc, scene) => acc + scene.complexity, 0) /
				Math.max(1, filteredSceneAnalytics.length),
		);
		return {
			totalRuntime,
			highRiskScenes,
			uniqueLocations,
			avgComplexity,
		};
	}, [filteredSceneAnalytics]);

	const activeScene = useMemo(
		() => filteredSceneAnalytics.find((scene) => scene.id === selectedSceneId),
		[filteredSceneAnalytics, selectedSceneId],
	);

	const networkReady = useMemo(
		() =>
			characterAnalytics.some(
				(character) => character.degree > 0 || character.betweenness > 0,
			),
		[characterAnalytics],
	);

	const sentimentReady = useMemo(
		() => sceneAnalytics.some((scene) => Math.abs(scene.sentiment) > 0.001),
		[sceneAnalytics],
	);

	const topRiskList = useMemo(
		() =>
			[...filteredSceneAnalytics]
				.sort((a, b) => b.riskScore - a.riskScore)
				.slice(0, 5),
		[filteredSceneAnalytics],
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
						<Text type="secondary">
							Production-first story diagnostics with live script intelligence.
						</Text>
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

			{(!networkReady || !sentimentReady) && (
				<Alert
					showIcon
					type="info"
					message="Some advanced metrics need AI analysis"
					description="Influence and sentiment charts get richer after running script analysis. Baseline parser metrics are shown now."
					style={{ marginBottom: 14 }}
				/>
			)}

			<Card
				style={{
					marginBottom: 14,
					border: `1px solid ${token.colorBorderSecondary}`,
					background: `linear-gradient(120deg, ${token.colorBgElevated} 0%, ${token.colorFillTertiary} 100%)`,
				}}
			>
				<Row gutter={[12, 12]} align="middle">
					<Col xs={24} md={7}>
						<Space direction="vertical" style={{ width: "100%" }}>
							<Text type="secondary">Environment</Text>
							<Segmented
								block
								value={environmentFilter}
								onChange={setEnvironmentFilter}
								options={[
									{ label: "All", value: "all" },
									{ label: "INT", value: "INT" },
									{ label: "EXT", value: "EXT" },
									{ label: "Mixed", value: "MIXED" },
								]}
							/>
						</Space>
					</Col>
					<Col xs={24} md={6}>
						<Space direction="vertical" style={{ width: "100%" }}>
							<Text type="secondary">Cast Role Scope</Text>
							<Segmented
								block
								value={roleFilter}
								onChange={setRoleFilter}
								options={[
									{ label: "All", value: "all" },
									{ label: "Major", value: "major" },
									{ label: "Minor", value: "minor" },
								]}
							/>
						</Space>
					</Col>
					<Col xs={24} md={6}>
						<Space direction="vertical" style={{ width: "100%" }}>
							<Text type="secondary">Focus Scene</Text>
							<Select
								allowClear
								placeholder="Select scene"
								value={selectedSceneId}
								onChange={setSelectedSceneId}
								options={filteredSceneAnalytics.map((scene) => ({
									value: scene.id,
									label: `${scene.shortName} ${scene.name}`,
								}))}
							/>
						</Space>
					</Col>
					<Col xs={24} md={5}>
						<Space direction="vertical" style={{ width: "100%" }}>
							<Text type="secondary">High-Risk Only</Text>
							<Switch checked={riskOnly} onChange={setRiskOnly} />
						</Space>
					</Col>
				</Row>
			</Card>

			<Row gutter={[12, 12]} style={{ marginBottom: 14 }}>
				<Col xs={12} md={6}>
					<Card bordered={false} style={chartCardStyle(token)}>
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
					<Card bordered={false} style={chartCardStyle(token)}>
						<Statistic
							title="High-Risk Scenes"
							value={kpis.highRiskScenes}
							prefix={<FireOutlined />}
							valueStyle={{ color: token.colorError }}
						/>
						<Text type="secondary">
							Scenes above risk score 65 based on complexity and sentiment
							pressure.
						</Text>
					</Card>
				</Col>
				<Col xs={12} md={6}>
					<Card bordered={false} style={chartCardStyle(token)}>
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
					<Card bordered={false} style={chartCardStyle(token)}>
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

			<Tabs
				defaultActiveKey="producer"
				items={[
					{
						key: "producer",
						label: (
							<Space>
								<UsergroupAddOutlined />
								Producer and Director
							</Space>
						),
						children: (
							<Row gutter={[12, 12]}>
								<Col xs={24} xl={15}>
									<Card
										title="Scene Complexity and Shoot Pressure"
										style={chartCardStyle(token)}
									>
										<ResponsiveContainer width="100%" height={255}>
											<ComposedChart
												data={filteredSceneAnalytics}
												onClick={(payload) => {
													if (payload?.activePayload?.[0]?.payload?.id) {
														setSelectedSceneId(
															payload.activePayload[0].payload.id,
														);
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
												/>
												<YAxis
													yAxisId="left"
													stroke={token.colorTextSecondary}
													domain={[0, 100]}
												/>
												<YAxis
													yAxisId="right"
													orientation="right"
													stroke={token.colorTextSecondary}
												/>
												<Tooltip
													contentStyle={{
														...tooltipStyle,
														background: token.colorBgElevated,
														color: token.colorText,
													}}
												/>
												<Legend />
												<Bar
													yAxisId="left"
													dataKey="complexity"
													name="Complexity"
													fill={token.colorPrimary}
													radius={[6, 6, 0, 0]}
												/>
												<Bar
													yAxisId="left"
													dataKey="riskScore"
													name="Risk"
													fill={token.colorError}
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
								<Col xs={24} xl={9}>
									<Card
										title="Top Schedule Risks"
										style={chartCardStyle(token)}
									>
										<Space
											direction="vertical"
											style={{ width: "100%" }}
											size={12}
										>
											{topRiskList.map((scene) => (
												<div
													key={scene.id}
													onClick={() => setSelectedSceneId(scene.id)}
													style={{
														cursor: "pointer",
														padding: "10px 12px",
														borderRadius: 10,
														background:
															selectedSceneId === scene.id
																? token.colorPrimaryBg
																: token.colorFillQuaternary,
														border: `1px solid ${token.colorBorderSecondary}`,
													}}
												>
													<Space
														style={{
															width: "100%",
															justifyContent: "space-between",
														}}
													>
														<div>
															<Text strong>{scene.shortName}</Text>
															<div style={{ maxWidth: 220 }}>
																<Text type="secondary" ellipsis>
																	{scene.name}
																</Text>
															</div>
														</div>
														<Tag color="red">Risk {scene.riskScore}</Tag>
													</Space>
												</div>
											))}
											{!topRiskList.length && (
												<Empty
													image={Empty.PRESENTED_IMAGE_SIMPLE}
													description="No risky scenes under current filters"
												/>
											)}
										</Space>
									</Card>
								</Col>

								<Col xs={24} xl={12}>
									<Card
										title="Location Runtime Allocation"
										style={chartCardStyle(token)}
									>
										<ResponsiveContainer width="100%" height={250}>
											<PieChart>
												<Pie
													data={locationDataset}
													dataKey="runtime"
													nameKey="name"
													innerRadius={55}
													outerRadius={95}
													paddingAngle={2}
												>
													{locationDataset.map((item, index) => (
														<Cell
															key={`${item.name}-${index}`}
															fill={
																index % 2 ? token.colorInfo : token.colorPrimary
															}
														/>
													))}
												</Pie>
												<Tooltip
													formatter={(value) =>
														`${formatDuration(value)} runtime`
													}
													contentStyle={{
														...tooltipStyle,
														background: token.colorBgElevated,
														color: token.colorText,
													}}
												/>
												<Legend />
											</PieChart>
										</ResponsiveContainer>
									</Card>
								</Col>

								<Col xs={24} xl={12}>
									<Card
										title="Cast Influence and Production Load"
										style={chartCardStyle(token)}
									>
										<ResponsiveContainer width="100%" height={250}>
											<BarChart
												data={characterAnalytics.slice(0, 10)}
												onClick={(payload) => {
													if (payload?.activePayload?.[0]?.payload?.id) {
														setSelectedCharacterId(
															payload.activePayload[0].payload.id,
														);
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
													interval={0}
													angle={-20}
													textAnchor="end"
													height={70}
												/>
												<YAxis
													yAxisId="left"
													stroke={token.colorTextSecondary}
													domain={[0, 100]}
												/>
												<YAxis
													yAxisId="right"
													orientation="right"
													stroke={token.colorTextSecondary}
												/>
												<Tooltip
													contentStyle={{
														...tooltipStyle,
														background: token.colorBgElevated,
														color: token.colorText,
													}}
												/>
												<Legend />
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
										title="Risk Matrix (Complexity vs Sentiment vs Duration)"
										style={chartCardStyle(token)}
									>
										<ResponsiveContainer width="100%" height={250}>
											<ScatterChart>
												<CartesianGrid
													stroke={token.colorBorderSecondary}
													strokeDasharray="3 3"
												/>
												<XAxis
													type="number"
													dataKey="complexity"
													name="Complexity"
													domain={[0, 100]}
													stroke={token.colorTextSecondary}
												/>
												<YAxis
													type="number"
													dataKey="sentiment"
													name="Sentiment"
													domain={[-1, 1]}
													stroke={token.colorTextSecondary}
												/>
												<ZAxis
													type="number"
													dataKey="duration"
													range={[40, 280]}
												/>
												<Tooltip
													cursor={{ strokeDasharray: "4 4" }}
													contentStyle={{
														...tooltipStyle,
														background: token.colorBgElevated,
														color: token.colorText,
													}}
												/>
												<Scatter
													data={filteredSceneAnalytics}
													fill={token.colorPrimary}
													name="Scenes"
												/>
											</ScatterChart>
										</ResponsiveContainer>
									</Card>
								</Col>

								{selectedCharacterId && (
									<Col xs={24}>
										<Card
											title={`Character Presence Timeline: ${selectedCharacterId}`}
											style={chartCardStyle(token)}
										>
											<ResponsiveContainer width="100%" height={250}>
												<AreaChart data={selectedCharacterTimeline}>
													<CartesianGrid
														stroke={token.colorBorderSecondary}
														strokeDasharray="3 3"
													/>
													<XAxis
														dataKey="scene"
														stroke={token.colorTextSecondary}
													/>
													<YAxis stroke={token.colorTextSecondary} />
													<Tooltip
														contentStyle={{
															...tooltipStyle,
															background: token.colorBgElevated,
															color: token.colorText,
														}}
													/>
													<Legend />
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
										</Card>
									</Col>
								)}
							</Row>
						),
					},
					{
						key: "author",
						label: (
							<Space>
								<LineChartOutlined />
								Author Lens
							</Space>
						),
						children: (
							<Row gutter={[12, 12]}>
								<Col xs={24} xl={14}>
									<Card
										title="Narrative Flow: Pacing and Sentiment"
										style={chartCardStyle(token)}
									>
										<ResponsiveContainer width="100%" height={250}>
											<ComposedChart data={sceneAnalytics}>
												<CartesianGrid
													stroke={token.colorBorderSecondary}
													strokeDasharray="3 3"
												/>
												<XAxis
													dataKey="shortName"
													stroke={token.colorTextSecondary}
												/>
												<YAxis
													yAxisId="left"
													stroke={token.colorTextSecondary}
													domain={[0, 100]}
												/>
												<YAxis
													yAxisId="right"
													orientation="right"
													stroke={token.colorTextSecondary}
													domain={[-1, 1]}
												/>
												<Tooltip
													contentStyle={{
														...tooltipStyle,
														background: token.colorBgElevated,
														color: token.colorText,
													}}
												/>
												<Legend />
												<Bar
													yAxisId="left"
													dataKey="actionRatio"
													fill={token.colorInfo}
													name="Action Ratio"
													radius={[5, 5, 0, 0]}
												/>
												<Line
													yAxisId="left"
													type="monotone"
													dataKey="pacing"
													stroke={token.colorPrimary}
													strokeWidth={2}
													name="Pacing"
												/>
												<Line
													yAxisId="right"
													type="monotone"
													dataKey="sentiment"
													stroke={token.colorError}
													strokeWidth={2}
													name="Sentiment"
													dot={{ r: 2 }}
												/>
											</ComposedChart>
										</ResponsiveContainer>
									</Card>
								</Col>

								<Col xs={24} xl={10}>
									<Card title="Beat Distribution" style={chartCardStyle(token)}>
										<ResponsiveContainer width="100%" height={250}>
											<BarChart data={structuralBeatDataset}>
												<CartesianGrid
													stroke={token.colorBorderSecondary}
													strokeDasharray="3 3"
												/>
												<XAxis
													dataKey="name"
													stroke={token.colorTextSecondary}
												/>
												<YAxis
													stroke={token.colorTextSecondary}
													allowDecimals={false}
												/>
												<Tooltip
													contentStyle={{
														...tooltipStyle,
														background: token.colorBgElevated,
														color: token.colorText,
													}}
												/>
												<Bar
													dataKey="value"
													fill={token.colorWarning}
													radius={[6, 6, 0, 0]}
												/>
											</BarChart>
										</ResponsiveContainer>
									</Card>
								</Col>

								<Col xs={24} xl={12}>
									<Card title="Dialogue Share" style={chartCardStyle(token)}>
										<ResponsiveContainer width="100%" height={250}>
											<BarChart
												data={characterAnalytics.slice(0, 10)}
												onClick={(payload) => {
													if (payload?.activePayload?.[0]?.payload?.id) {
														setSelectedCharacterId(
															payload.activePayload[0].payload.id,
														);
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
													interval={0}
													angle={-20}
													textAnchor="end"
													height={70}
												/>
												<YAxis stroke={token.colorTextSecondary} />
												<Tooltip
													contentStyle={{
														...tooltipStyle,
														background: token.colorBgElevated,
														color: token.colorText,
													}}
												/>
												<Bar
													dataKey="dialogueCount"
													fill={token.colorPrimary}
													radius={[6, 6, 0, 0]}
												/>
											</BarChart>
										</ResponsiveContainer>
									</Card>
								</Col>

								<Col xs={24} xl={12}>
									<Card
										title="Character Emotion Palette"
										style={chartCardStyle(token)}
									>
										<ResponsiveContainer width="100%" height={250}>
											<PieChart>
												<Pie
													data={emotionalDistribution}
													dataKey="value"
													nameKey="name"
													innerRadius={50}
													outerRadius={95}
												>
													{emotionalDistribution.map((item) => (
														<Cell key={item.name} fill={item.color} />
													))}
												</Pie>
												<Tooltip
													contentStyle={{
														...tooltipStyle,
														background: token.colorBgElevated,
														color: token.colorText,
													}}
												/>
												<Legend />
											</PieChart>
										</ResponsiveContainer>
									</Card>
								</Col>
							</Row>
						),
					},
				]}
			/>

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
								title="Risk"
								value={activeScene.riskScore}
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
