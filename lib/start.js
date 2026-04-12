import shell from "shelljs";
import chalk from "chalk";
import fs from "fs";
import { spawn } from "child_process";
import { getProjectRoot } from "./config.js";
import updateHosts from "./updateHosts.js"
import path from "path";

function startPortForward() {
  console.log(chalk.yellow("🔌 Setting up persistent port-forward for Postgres..."));
  const pfPostgres = spawn(
    "kubectl",
    ["-n", "data", "port-forward", "svc/postgres-postgresql", "5432:5432"],
    { stdio: "ignore", detached: true }
  );
  fs.writeFileSync(".lagerr-pf-postgres.pid", pfPostgres.pid.toString());
  pfPostgres.unref();
  console.log(chalk.green("✅ Postgres port-forward active (localhost:5432)"));

  console.log(chalk.yellow("🔌 Setting up persistent port-forward for RabbitMQ..."));
  const pfRabbit = spawn(
    "kubectl",
    ["-n", "messaging", "port-forward", "svc/rabbitmq", "5672:5672", "15672:15672"],
    { stdio: "ignore", detached: true }
  );
  fs.writeFileSync(".lagerr-pf-rabbitmq.pid", pfRabbit.pid.toString());
  pfRabbit.unref();
  console.log(chalk.green("✅ RabbitMQ port-forward active (localhost:5672 for AMQP, 15672 for UI)"));
}

export default function start() {
  console.log(chalk.green("▶ Starting lagerr cluster..."));
  shell.exec("docker start lagerr-control-plane || true");

  // TODO: Ensure DB secret
  shell.exec(`kubectl -n default create secret generic app-db         --from-literal=url=jdbc:postgresql://postgres-postgresql.data.svc.cluster.local:5432/appdb         --from-literal=username=app         --from-literal=password=app123         --dry-run=client -o yaml | kubectl apply -f -`);

  // Reapply infra if projectRoot known
  const projectRoot = getProjectRoot();
  if (projectRoot) {
    const appsInfraPath = path.join(projectRoot, "apps", "infra");
    if (fs.existsSync(appsInfraPath)) {
      shell.exec(`kubectl apply -f ${appsInfraPath}`);
    }
    const appOfApps = path.join(projectRoot, "apps", "app-of-apps.yaml");
    if (fs.existsSync(appOfApps)) {
      shell.exec(`kubectl apply -n argocd -f ${appOfApps}`);
    }

    const infraIngressPath = path.join(projectRoot, "infra", "ingress");
    if (fs.existsSync(infraIngressPath)) {
      shell.exec(`kubectl apply -f ${infraIngressPath}`);
    }
  }

  startPortForward();
  console.log(chalk.green("✅ lagerr cluster started"));

  updateHosts();
  console.log(chalk.green("✅ localhost addresses updated (/etc/hosts)"));
}
