import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import { WebSocketServer } from "ws";
// @ts-ignore
import { setupWSConnection } from "y-websocket/bin/utils";
import { v4 as uuidv4 } from "uuid";

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = {
  projects: [] as any[],
  productions: [] as any[],
  comments: [] as any[]
};

async function startServer() {
  const app = express();
  const PORT = 3000;
  app.use(express.json());

  app.get("/api/health", (req, res) => res.json({ status: "ok" }));

  app.get("/api/productions", (req, res) => res.json(db.productions));
  app.post("/api/productions", (req, res) => {
    const prod = { id: uuidv4(), projects: [], ...req.body };
    db.productions.push(prod);
    res.json(prod);
  });

  app.get("/api/projects", (req, res) => res.json(db.projects));
  app.post("/api/projects", (req, res) => {
    const proj = { id: uuidv4(), status: 'available', lastModified: Date.now(), ...req.body };
    db.projects.push(proj);
    if (req.body.productionId) {
      const prod = db.productions.find(p => p.id === req.body.productionId);
      if (prod) prod.projects.push(proj.id);
    }
    res.json(proj);
  });
  app.put("/api/projects/:id", (req, res) => {
    const idx = db.projects.findIndex(p => p.id === req.params.id);
    if (idx > -1) {
      db.projects[idx] = { ...db.projects[idx], ...req.body, lastModified: Date.now() };
      res.json(db.projects[idx]);
    } else {
      res.status(404).json({ error: "Not found" });
    }
  });

  app.get("/api/comments/:projectId", (req, res) => {
    res.json(db.comments.filter(c => c.projectId === req.params.projectId));
  });
  app.post("/api/comments/:projectId", (req, res) => {
    const comment = { id: uuidv4(), projectId: req.params.projectId, timestamp: Date.now(), resolved: false, ...req.body };
    db.comments.push(comment);
    res.json(comment);
  });
  app.put("/api/comments/:projectId/:commentId", (req, res) => {
    const idx = db.comments.findIndex(c => c.id === req.params.commentId);
    if (idx > -1) {
       db.comments[idx] = { ...db.comments[idx], ...req.body };
       res.json(db.comments[idx]);
    } else {
      res.status(404).json({ error: "Not found" });
    }
  });

  app.post("/api/upload-url", (req, res) => {
    const { filename } = req.body;
    res.json({ uploadUrl: `/api/mock-upload/${filename}`, fileUrl: `/assets/${filename}` });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (conn, req) => setupWSConnection(conn, req));

  server.on("upgrade", (req, socket, head) => {
    console.log(`[UPGRADE] requested for ${req.url}`);
    if (req.url && req.url.startsWith("/yjs")) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    }
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server", err);
  process.exit(1);
});
