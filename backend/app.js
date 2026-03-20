import express from "express";
import { randomUUID } from "crypto";
import cors from "cors";
import cookieParser from "cookie-parser";

import records from "./routes/records.js";

const app = express();

app.use(
	cors({
		origin: process.env.FRONT_END_URL || "http://localhost:5173",
		credentials: true,
	}),
);
app.use(express.json());
app.use(cookieParser());
app.use((req, res, next) => {
	const requestId = req.headers["x-request-id"] || randomUUID();
	const start = Date.now();

	req.requestId = requestId;
	res.setHeader("x-request-id", requestId);

	console.info(`[HTTP][${requestId}] START ${req.method} ${req.originalUrl}`);
	res.on("finish", () => {
		const durationMs = Date.now() - start;
		console.info(
			`[HTTP][${requestId}] END ${req.method} ${req.originalUrl} status=${res.statusCode} durationMs=${durationMs}`,
		);
	});

	next();
});
app.use("/", records);

export default app;
