import { Schema, model } from "mongoose";

const EmotionTimelinePointSchema = new Schema(
  {
    position: {
      type: Number,
      required: true,
    },
    emotion: {
      type: String,
      required: true,
    },
    scene: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const AppearanceSchema = new Schema(
  {
    scene: {
      type: Number,
      required: true,
    },
    position: {
      type: Number,
      required: true,
    },
    emotion: {
      type: String,
      required: true,
    },
    sentiment: {
      type: Number,
      required: true,
    },
    linkedCharacters: {
      type: [String],
      default: [],
    },
    text: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const CharacterSchema = new Schema(
  {
    color: {
      type: String,
      required: true,
    },
    appearances: {
      type: [AppearanceSchema],
      required: true,
    },
    emotionTimeline: {
      type: [EmotionTimelinePointSchema],
      required: true,
    },
  },
  { _id: false }
);

const SceneSchema = new Schema(
  {
    label: {
      type: String,
      required: true,
    },
    t: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const ScriptSchema = new Schema(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
      unique: true,
    },
    script: {
      type: String,
      required: true,
    },
    scenes: {
      type: [SceneSchema],
      required: true,
    },
    characters: {
      type: Map,
      of: CharacterSchema,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Script = model("Script", ScriptSchema);

export default Script;
