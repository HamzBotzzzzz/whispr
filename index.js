require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// mount API routes
app.use("/api/register", require("./api/register"));
app.use("/api/login", require("./api/login"));
app.use("/api/send", require("./api/send"));
app.use("/api/messages", require("./api/messages"));
app.use("/api/profile", require("./api/profile"));
app.use("/api/delete-account", require("./api/delete-account"));
app.use("/api/clear-messages", require("./api/clear-messages"));

// fallback ke index.html untuk SPA routing (/@slug dll)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`whispr running at http://localhost:${PORT}`);
});
