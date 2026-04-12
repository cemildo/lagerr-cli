import shell from "shelljs";
import chalk from "chalk";
import fs from "fs";

export default function stop() {
  console.log(chalk.yellow("⏸ Stopping lagerr cluster..."));
  shell.exec("docker stop lagerr-control-plane || true");
  if (fs.existsSync(".lagerr-pf.pid")) {
    const pid = fs.readFileSync(".lagerr-pf.pid", "utf8").trim();
    try { process.kill(pid, "SIGTERM"); } catch {}
    fs.unlinkSync(".lagerr-pf.pid");
    console.log(chalk.yellow("🛑 Stopped Postgres port-forward"));
  }
  console.log(chalk.yellow("✅ lagerr cluster stopped"));
}
