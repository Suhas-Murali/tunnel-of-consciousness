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
    if (!context.token) {
      throw new Error("Authentication required");
    }

    try {
      const userId = jwt.verify(context.token, process.env.JWT_SECRET).userId;
      const user = await User.findById(userId).select("-password");
      if (!user) {
        throw new Error("User Not found");
      }

      const script = await Script.findById(documentName);

      if (!script) {
        throw new Error("Script not found");
      }

      const isOwner = script.owner.toString() === userId;
      const canWrite = script.writeAccess.some(
        (id) => id.toString() === userId
      );
      const canRead = script.readAccess.some((id) => id.toString() === userId);

      if (!isOwner && !canWrite && !canRead) {
        throw new Error("You do not have permission to view this script.");
      }

      if (!isOwner && !canWrite) {
        connectionConfig.readOnly = true;
      }

      return {
        user,
      };
    } catch (err) {
      console.log("Auth failed:", err.message);
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
