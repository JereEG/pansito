import express from "express";
import config from "./config/env.js";
import webhookRoutes from "./routes/webhookRoutes.js";
import authRoutes from "./routes/authRoutes.js"; 
import eventRoutes from "./routes/eventRoutes.js";

const app = express();
app.use(express.json());

app.use("/", webhookRoutes);
app.use("/", authRoutes); 
app.use("/", eventRoutes);
app.get("/", (req, res) => {
  res.send(`<pre>Nothing to see here.
Checkout README.md to start.</pre>`);
});

app.listen(config.PORT, () => {
  console.log(`Server is listening on port:  ${config.PORT}`);
});
