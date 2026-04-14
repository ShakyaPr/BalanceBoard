import "dotenv/config";
import { configureDatabaseUrl } from "./utils/database.js";

configureDatabaseUrl();

const { app } = await import("./app.js");

const port = Number(process.env.PORT ?? 4000);

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
});
