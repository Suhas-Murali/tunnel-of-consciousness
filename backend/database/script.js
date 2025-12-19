import { Schema, model } from "mongoose";

const ScriptSchema = new Schema(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    readAccess: {
      type: [Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    writeAccess: {
      type: [Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    name: {
      type: String,
      required: true,
    },
    data: {
      type: Buffer,
      required: false,
    },
  },
  { timestamps: true }
);

const Script = model("Script", ScriptSchema);

export default Script;
