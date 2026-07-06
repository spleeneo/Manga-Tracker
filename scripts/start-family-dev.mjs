import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");
const servers = [
  { role: "parent", port: "3000", distDir: ".next-parent" },
  { role: "child", port: "3001", distDir: ".next-child" },
].map(({ role, port, distDir }) => spawn(process.execPath, [nextBin, "dev", "--hostname", "localhost", "--port", port], {
  env: { ...process.env, DEV_FAMILY_ROLE: role, NEXT_DIST_DIR: distDir },
  stdio: "inherit",
}));

let stopping = false;
function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const server of servers) server.kill();
  process.exitCode = exitCode;
}

process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
for (const server of servers) {
  server.on("exit", (code) => {
    if (!stopping) stop(code ?? 1);
  });
}
