import express from "express";

import userRouter from "./user-records.js";
import scriptRouter from "./script-records.js";

const router = express.Router();

router.use("/user", userRouter);
router.use("/script", scriptRouter);

export default router;
