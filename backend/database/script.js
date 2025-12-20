import { Schema, model } from "mongoose";

const ScriptSchema = new Schema(
  {
    name: { type: String, required: true },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    collaborators: [
      {
        user: { type: Schema.Types.ObjectId, ref: "User" },
        role: { type: String, enum: ["viewer", "editor"], default: "viewer" },
      },
    ],
    data: {
      type: Buffer,
      required: false,
    },
  },
  { timestamps: true }
);

ScriptSchema.index({ owner: 1, name: 1 }, { unique: true });

const Script = model("Script", ScriptSchema);

export default Script;
