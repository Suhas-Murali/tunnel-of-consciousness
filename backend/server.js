import "dotenv/config";
import { Server } from "@hocuspocus/server";
import { Database } from "@hocuspocus/extension-database";
import { WebSocketServer } from "ws";
import cookie from "cookie";
import jwt from "jsonwebtoken";
import "./database/connection.js";
import app from "./app.js";
import Script from "./database/script.js";
import User from "./database/user.js";

if (!process.env.JWT_SECRET) {
  console.error("JWT SECRET not set");
  process.exit(-1);
}

const PORT = process.env.PORT || 5050;
const expressServer = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on port ${PORT}`);
});

const hocuspocusServer = new Server({
  name: "hocuspocus-script-provider",
  port: PORT,
  onAuthenticate: async ({ context, documentName, connectionConfig }) => {
    // 1. Verify Token Presence
    if (!context.token) {
      throw new Error("Authentication required");
    }

    try {
      // 2. Decode User
      const payload = jwt.verify(context.token, process.env.JWT_SECRET);
      // Fallback for 'id' vs 'userId' depending on how you signed the token
      const userId = payload.userId || payload.id;

      const user = await User.findById(userId).select("-password");
      if (!user) {
        throw new Error("User Not found");
      }

      // 3. Fetch Script
      // documentName is the Script ID
      const script = await Script.findById(documentName);

      if (!script) {
        throw new Error("Script not found");
      }

      // 4. NEW SCHEMA LOGIC
      const currentUserIdStr = userId.toString();
      const isOwner = script.owner.toString() === currentUserIdStr;

      // Check if user is in the collaborators list
      const collaborator = script.collaborators.find(
        (c) => c.user.toString() === currentUserIdStr
      );

      // 5. Access Check
      // If you are not the owner AND not a collaborator -> Deny Access
      if (!isOwner && !collaborator) {
        throw new Error("You do not have permission to view this script.");
      }

      // 6. Determine Read-Only Status
      // You have Write Access if: You are Owner OR you are an 'editor'
      const canWrite =
        isOwner || (collaborator && collaborator.role === "editor");

      if (!canWrite) {
        connectionConfig.readOnly = true;
      }

      // 7. Return Context
      return {
        user: {
          id: user._id.toString(),
          name: user.username,
          // Pass color/avatar if you have them, useful for cursors
          color: "#555",
        },
      };
    } catch (err) {
      console.log("Auth failed:", err.message);
      // Hocuspocus catches this error and closes the connection
      throw new Error("Unauthorized");
    }
  },
  extensions: [
    new Database({
      fetch: async ({ documentName }) => {
        const doc = await Script.findById(documentName);
        return doc ? doc.data : null;
      },
      store: async ({ documentName, state }) => {
        try {
          await Script.findByIdAndUpdate(
            documentName,
            { data: state },
            { upsert: true, new: true }
          );
        } catch (err) {
          console.error("Error saving:", err);
        }
      },
    }),
  ],
});

const wss = new WebSocketServer({ noServer: true });

expressServer.on("upgrade", (request, socket, head) => {
  const parsedCookies = cookie.parse(request.headers.cookie || "");
  wss.handleUpgrade(request, socket, head, (wsocket) => {
    hocuspocusServer.hocuspocus.handleConnection(wsocket, request, {
      token: parsedCookies.token,
    });
  });
});
