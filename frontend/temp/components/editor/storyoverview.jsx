import React, { useState, useEffect, useContext, useMemo } from "react";
import {
	theme,
	Card,
	Tag,
	Typography,
	Row,
	Col,
	Statistic,
	Divider,
	Empty,
	Tooltip,
} from "antd";
import {
	ClockCircleOutlined,
	EnvironmentOutlined,
	TeamOutlined,
	ThunderboltOutlined,
	CaretDownOutlined,
} from "@ant-design/icons";
import { ScriptStateContext } from "../contexts";

const { Text } = Typography;

// ==========================================
// HELPER: Format Seconds to MM:SS
// ==========================================
const formatTime = (seconds) => {
	if (!seconds && seconds !== 0) return "--:--";
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${m}:${s < 10 ? "0" : ""}${s}`;
};

const MAX_STRUCTURAL_BEAT_TAGS = 7;
const CANONICAL_BEATS = [
	"Setup",
	"Inciting Incident",
	"First Plot Point",
	"Midpoint",
	"Crisis",
	"Climax",
	"Resolution",
];

const normalizeStructuralBeat = (rawBeat) => {
	if (!rawBeat || typeof rawBeat !== "string") return null;
	const cleaned = rawBeat.trim().toLowerCase();

	if (cleaned.includes("setup") || cleaned.includes("opening")) {
		return "Setup";
	}
	if (cleaned.includes("inciting") || cleaned.includes("catalyst")) {
		return "Inciting Incident";
	}
	if (
		cleaned.includes("first plot point") ||
		cleaned.includes("plot point i") ||
		cleaned.includes("plot point 1")
	) {
		return "First Plot Point";
	}
	if (cleaned.includes("midpoint")) {
		return "Midpoint";
	}
	if (
		cleaned.includes("crisis") ||
		cleaned.includes("all is lost") ||
		cleaned.includes("dark night")
	) {
		return "Crisis";
	}
	if (cleaned.includes("climax")) {
		return "Climax";
	}
	if (
		cleaned.includes("resolution") ||
		cleaned.includes("denouement") ||
		cleaned.includes("ending")
	) {
		return "Resolution";
	}

	return null;
};

// ==========================================
// STORY OVERVIEW COMPONENT
// ==========================================

export const StoryOverview = ({ provider }) => {
	const { currentTime, setCurrentTime } = useContext(ScriptStateContext);
	const { token } = theme.useToken();
	const [scenes, setScenes] = useState([]);
	const [characters, setCharacters] = useState([]);

	// --- 1. DATA PROCESSING ---
	useEffect(() => {
		if (!provider) return;
		const map = provider.document.getMap("script_analysis");

		const updateHandler = () => {
			// Calculate absolute start times for seeking
			const rawScenes = map.get("scenes") || [];
			let accumulated = 0;
			const processedScenes = rawScenes.map((s) => {
				const start = accumulated;
				const duration = s.durationSecs || 10;
				accumulated += duration;
				return { ...s, startTime: start, endTime: start + duration };
			});

			setScenes(processedScenes);
			setCharacters(map.get("characters") || []);
		};

		updateHandler();
		map.observe(updateHandler);
		return () => map.unobserve(updateHandler);
	}, [provider]);

	// Derived Metrics
	const totalDurationSecs = Math.max(
		1,
		scenes.reduce((acc, s) => acc + (s.durationSecs || 0), 0),
	);
	const totalFormatted = formatTime(totalDurationSecs);
	const totalLocations = new Set(scenes.map((s) => s.name.split(" - ")[0]))
		.size;

	const structuralBeatTags = useMemo(() => {
		if (scenes.length === 0) return [];

		const usedSceneIds = new Set();
		const sceneKey = (scene, index) =>
			scene.id ?? `${scene.name || "scene"}-${index}`;
		const jumpTimeBySceneKey = new Map();
		let accumulatedDuration = 0;
		scenes.forEach((scene, index) => {
			const key = sceneKey(scene, index);
			jumpTimeBySceneKey.set(key, accumulatedDuration);
			accumulatedDuration += scene.durationSecs || 10;
		});

		const tagsByBeat = new Map();

		// 1) Keep one explicit scene per beat (if provided by analysis)
		scenes.forEach((scene, index) => {
			const beat = normalizeStructuralBeat(scene.metrics?.structuralBeat);
			const key = sceneKey(scene, index);
			if (!beat || usedSceneIds.has(key) || tagsByBeat.has(beat)) return;

			tagsByBeat.set(beat, {
				beat,
				scene,
				key,
				jumpTime: jumpTimeBySceneKey.get(key) ?? 0,
			});
			usedSceneIds.add(key);
		});

		// 2) Fill missing beats with heuristic scene picks to reach up to 7 tags
		const targetRatios = {
			Setup: 0.0,
			"Inciting Incident": 0.12,
			"First Plot Point": 0.25,
			Midpoint: 0.5,
			Crisis: 0.72,
			Climax: 0.88,
			Resolution: 0.99,
		};

		const pickNearestUnassignedScene = (ratio) => {
			if (scenes.length === 0) return null;
			const target = Math.round((scenes.length - 1) * ratio);
			for (let offset = 0; offset < scenes.length; offset += 1) {
				const left = target - offset;
				if (left >= 0) {
					const leftScene = scenes[left];
					const leftKey = sceneKey(leftScene, left);
					if (!usedSceneIds.has(leftKey)) {
						return { scene: leftScene, key: leftKey };
					}
				}

				const right = target + offset;
				if (right < scenes.length) {
					const rightScene = scenes[right];
					const rightKey = sceneKey(rightScene, right);
					if (!usedSceneIds.has(rightKey)) {
						return { scene: rightScene, key: rightKey };
					}
				}
			}

			return null;
		};

		CANONICAL_BEATS.forEach((beat) => {
			if (tagsByBeat.has(beat)) return;
			const picked = pickNearestUnassignedScene(targetRatios[beat] ?? 0.5);
			if (!picked) return;

			tagsByBeat.set(beat, {
				beat,
				scene: picked.scene,
				key: picked.key,
				jumpTime: jumpTimeBySceneKey.get(picked.key) ?? 0,
			});
			usedSceneIds.add(picked.key);
		});

		return CANONICAL_BEATS.map((beat) => tagsByBeat.get(beat))
			.filter(Boolean)
			.slice(0, MAX_STRUCTURAL_BEAT_TAGS);
	}, [scenes]);

	// Calculate percentage for the global playhead
	const currentProgress = (currentTime / totalDurationSecs) * 100;

	// --- 2. RENDERERS ---

	// Common "You Are Here" Line for graphs
	const PlayheadOverlay = () => (
		<div
			style={{
				position: "absolute",
				left: `${currentProgress}%`,
				top: 0,
				bottom: 0,
				width: 2,
				background: token.colorError, // Red line for visibility
				zIndex: 10,
				pointerEvents: "none",
				transition: "left 0.1s linear",
			}}
		>
			<div
				style={{
					position: "absolute",
					top: -6,
					left: "50%",
					transform: "translateX(-50%)",
					color: token.colorError,
					fontSize: 10,
				}}
			>
				<CaretDownOutlined />
			</div>
		</div>
	);

	// A. PACING GRAPH
	const PacingGraph = () => {
		if (scenes.length === 0) return null;

		const height = 60;
		const step = 100 / (scenes.length - 1 || 1);

		const points = scenes
			.map((s, i) => {
				const x = i * step;
				const val = s.metrics?.pacing || 50;
				const y = height - (val / 100) * height;
				return `${x},${y}`;
			})
			.join(" ");

		return (
			<div
				style={{
					width: "100%",
					height: height,
					position: "relative",
					marginBottom: 10,
					borderBottom: `1px solid ${token.colorBorderSecondary}`,
				}}
			>
				<svg
					width="100%"
					height="100%"
					viewBox={`0 0 100 ${height}`}
					preserveAspectRatio="none"
					style={{ overflow: "visible" }}
				>
					<defs>
						<linearGradient id="pacingGradient" x1="0" x2="0" y1="0" y2="1">
							<stop
								offset="0%"
								stopColor={token.colorPrimary}
								stopOpacity={0.3}
							/>
							<stop
								offset="100%"
								stopColor={token.colorPrimary}
								stopOpacity={0.0}
							/>
						</linearGradient>
					</defs>
					<path
						d={`M0,${height} ${points} L100,${height} Z`}
						fill="url(#pacingGradient)"
						stroke="none"
					/>
					<polyline
						points={points}
						fill="none"
						stroke={token.colorPrimary}
						strokeWidth="2"
						vectorEffect="non-scaling-stroke"
					/>
				</svg>
			</div>
		);
	};

	// B. GANTT STRIP (Proportional Widths)
	const NarrativeGantt = () => {
		return (
			<div
				style={{
					display: "flex",
					width: "100%",
					height: 30,
					borderRadius: 4,
					overflow: "hidden",
					position: "relative", // Needed for playhead
				}}
			>
				{scenes.map((scene) => {
					const flexShare = scene.durationSecs || 10;
					return (
						<Tooltip
							key={scene.id}
							title={
								<div>
									<strong>{scene.name}</strong>
									<div style={{ fontSize: 10 }}>Click to jump</div>
								</div>
							}
						>
							<div
								onClick={() => setCurrentTime(scene.startTime)}
								style={{
									flex: flexShare,
									background: scene.color || "#ccc",
									borderRight: `1px solid ${token.colorBgContainer}`,
									opacity: 0.8,
									cursor: "pointer",
									transition: "opacity 0.2s",
								}}
								onMouseEnter={(e) => (e.currentTarget.style.opacity = 1)}
								onMouseLeave={(e) => (e.currentTarget.style.opacity = 0.8)}
							/>
						</Tooltip>
					);
				})}
			</div>
		);
	};

	// C. CHARACTER THREADS
	const CharacterThreads = () => {
		return (
			<div style={{ marginTop: 10, position: "relative" }}>
				{characters.map((char) => (
					<div
						key={char.id}
						style={{
							display: "flex",
							alignItems: "center",
							marginBottom: 4,
							height: 16,
						}}
					>
						<div
							style={{
								width: 120,
								fontSize: 11,
								color: token.colorTextSecondary,
								whiteSpace: "nowrap",
								overflow: "hidden",
								textOverflow: "ellipsis",
							}}
						>
							{char.name}
						</div>
						<div
							style={{
								flex: 1,
								display: "flex",
								height: "100%",
								alignItems: "center",
							}}
						>
							{scenes.map((scene) => {
								const charList = Array.isArray(scene.characters)
									? scene.characters
									: Array.from(scene.characters || []);

								const isPresent =
									charList.includes(char.name) || charList.includes(char.id);

								const flexShare = scene.durationSecs || 10;

								return (
									<div
										key={scene.id}
										style={{
											flex: flexShare,
											height: isPresent ? 8 : 1,
											background: isPresent ? char.color : token.colorBorder,
											opacity: isPresent ? 1 : 0.35,
											borderRadius: 999,
											margin: "0 1px",
											transition: "height 0.15s ease, opacity 0.15s ease",
										}}
									/>
								);
							})}
						</div>
					</div>
				))}
			</div>
		);
	};

	if (scenes.length === 0) return <Empty description="No Script Data" />;

	return (
		<div
			style={{
				height: "100%",
				overflowY: "auto",
				padding: 24,
				background: token.colorBgContainer,
			}}
		>
			{/* 1. HEADER STATS */}
			<Row gutter={16} style={{ marginBottom: 24 }}>
				<Col span={6}>
					<Statistic
						title="Total Scenes"
						value={scenes.length}
						prefix={<ThunderboltOutlined />}
					/>
				</Col>
				<Col span={6}>
					<Statistic
						title="Est. Duration"
						value={totalFormatted}
						prefix={<ClockCircleOutlined />}
					/>
				</Col>
				<Col span={6}>
					<Statistic
						title="Key Locations"
						value={totalLocations}
						prefix={<EnvironmentOutlined />}
					/>
				</Col>
				<Col span={6}>
					<Statistic
						title="Cast Size"
						value={characters.length}
						prefix={<TeamOutlined />}
					/>
				</Col>
			</Row>

			<Divider />

			{/* 2. NARRATIVE FLOW (GANTT) */}
			<Card
				size="small"
				title="Narrative Timeline & Structural Beats"
				style={{ marginBottom: 24, background: token.colorFillQuaternary }}
				variant="borderless"
			>
				<div
					style={{
						marginBottom: 8,
						display: "flex",
						justifyContent: "space-between",
					}}
				>
					<Text type="secondary" style={{ fontSize: 12 }}>
						Click blocks or beat tags to jump
					</Text>
					<Text style={{ fontSize: 12, color: token.colorError }}>
						Current Time: {formatTime(currentTime)}
					</Text>
				</div>

				<NarrativeGantt />
				<div
					style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}
				>
					{structuralBeatTags.map(({ beat, scene, key, jumpTime }) => (
						<Tag
							key={key}
							color="geekblue"
							onClick={() => setCurrentTime(jumpTime)}
							style={{ cursor: "pointer" }}
						>
							{beat}: {scene.name}
						</Tag>
					))}
				</div>
			</Card>

			{/* 3. PACING GRAPH */}
			<Card
				size="small"
				title="Pacing & Intensity Rhythm"
				style={{ marginBottom: 24, background: token.colorFillQuaternary }}
				variant="borderless"
			>
				<Text
					type="secondary"
					style={{ fontSize: 12, marginBottom: 8, display: "block" }}
				>
					Real-time dialogue density analysis.
				</Text>
				<PacingGraph />
			</Card>

			{/* 4. CHARACTER PRESENCE */}
			<Card
				size="small"
				title="Character Presence Threads"
				style={{ marginBottom: 24, background: token.colorFillQuaternary }}
				variant="borderless"
			>
				<CharacterThreads />
			</Card>
		</div>
	);
};
