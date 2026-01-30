const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

// Static files + recordings folder
app.use(express.static("public"));
app.use("/recordings", express.static("recordings"));
app.get("/favicon.ico", (req, res) => res.status(204).end());

// Create recordings folder
const recordingsDir = path.join(__dirname, "recordings");
if (!fs.existsSync(recordingsDir)) {
  fs.mkdirSync(recordingsDir);
}

// Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "recordings/"),
  filename: (req, file, cb) => {
    const uniqueName = `recording-${Date.now()}-${Math.round(Math.random() * 1e9)}.webm`;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

// Socket.IO streaming (unchanged)
let broadcasters = 0;
io.on("connection", (socket) => {
  console.log("👤 Client connected:", socket.id);

  socket.on("start-broadcast", () => {
    broadcasters++;
    socket.broadcast.emit("broadcaster-ready");
    console.log("📡 Broadcaster started! Total:", broadcasters);
  });

  socket.on("video-frame", (frameData) => {
    socket.broadcast.emit("video-frame", frameData);
  });

  socket.on("disconnect", () => {
    console.log("👤 Client disconnected:", socket.id);
  });
});

// API Routes for Recordings
app.post("/upload-recording", upload.single("video"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  res.json({
    success: true,
    filename: req.file.filename,
    url: `http://localhost:3000/recordings/${req.file.filename}`,
  });
});

app.get("/recordings", (req, res) => {
  fs.readdir(recordingsDir, (err, files) => {
    if (err) return res.status(500).json({ error: "Cannot read recordings" });
    const videoFiles = files.filter((f) => f.endsWith(".webm"));
    res.json(videoFiles.map((f) => `/recordings/${f}`));
  });
});

server.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
  console.log("📱 Recordings folder: http://localhost:3000/recordings/");
});
