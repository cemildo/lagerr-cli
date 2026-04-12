import shell from "shelljs";
import chalk from "chalk";
import fs from "fs";
import { spawn } from "child_process";
import inquirer from "inquirer";
import path from "path";
import { saveProjectRoot, getProjectRoot, setServicePath } from "./config.js";
import updateHosts from "./updateHosts.js"

let projectRoot = getProjectRoot();

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

export default async function setup() {
  console.log(chalk.green("🚀 Setting up lagerr cluster..."));
  shell.exec("kind delete cluster --name lagerr");

  // Create cluster
  shell.exec(`
cat <<'YAML' > kind-config-lagerr.yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: lagerr
nodes:
  - role: control-plane
    image: kindest/node:v1.30.0
    extraPortMappings:
      - containerPort: 80
        hostPort: 80
      - containerPort: 443
        hostPort: 443
YAML
kind create cluster --config kind-config-lagerr.yaml
  `);

  // Ingress
  shell.exec("helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx");
  shell.exec("helm repo update");
  shell.exec("helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx --namespace ingress-nginx --create-namespace --set controller.hostPort.enabled=true --set controller.publishService.enabled=false");

  // ArgoCD
  shell.exec("kubectl create namespace argocd || true");
  shell.exec("kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml");

  // Monitoring
  shell.exec("helm repo add prometheus-community https://prometheus-community.github.io/helm-charts");
  shell.exec("helm repo update");
  shell.exec("helm upgrade --install monitoring prometheus-community/kube-prometheus-stack --namespace monitoring --create-namespace");

  // Grafana Loki
  shell.exec("helm repo add grafana https://grafana.github.io/helm-charts");
  shell.exec("helm repo update");
  shell.exec("helm upgrade --install loki grafana/loki-stack --namespace monitoring --create-namespace --set grafana.enabled=false --set prometheus.enabled=false");

  // Grafana Tempo
  shell.exec(" helm repo add grafana https://grafana.github.io/helm-charts");
  shell.exec("helm repo update");
  shell.exec("helm upgrade --install tempo grafana/tempo --namespace monitoring --create-namespace");
  shell.exec("kubectl -n monitoring delete cm loki-loki-stack");
  shell.exec("kubectl -n monitoring rollout restart deploy/monitoring-grafana");
  shell.exec("kubectl -n monitoring rollout status deploy/monitoring-grafana");

  // create namespace for rabbitmq
  shell.exec("kubectl create namespace messaging");

  // create namespace for data
  shell.exec("kubectl create namespace data");
  shell.exec(`helm install postgres ${projectRoot}/charts/postgresql -n data -f ${projectRoot}/apps/infra/values/postgres-values.yaml`);

  // Ask for project root if not saved
  
  if (!projectRoot) {
    const { inputPath } = await inquirer.prompt([{
      type: "input",
      name: "inputPath",
      message: "Enter absolute path to lagerr project root (where apps/ and services/ exist):",
      validate: (input) => path.isAbsolute(input) ? true : "Please enter an absolute path"
    }]);
    projectRoot = inputPath;
    saveProjectRoot(projectRoot);
  }

  // Apply infra & app-of-apps from projectRoot
  const infraPath = path.join(projectRoot, "apps", "infra");
  if (fs.existsSync(infraPath)) {
    shell.exec(`kubectl apply -f ${infraPath}`);
  }

  const infraTempoPath = path.join(projectRoot, "apps", "infra", "tempo");
  if (fs.existsSync(infraTempoPath)) {
    shell.exec(`helm upgrade --install tempo grafana/tempo-distributed -n monitoring -f ${infraTempoPath}/values.yaml`);
  }

  const infraIngresPath = path.join(projectRoot, "infra", "ingress");
  if (fs.existsSync(infraIngresPath)) {
    shell.exec(`kubectl apply -f ${infraIngresPath}`);
  }

  const appOfApps = path.join(projectRoot, "apps", "app-of-apps.yaml");
  if (fs.existsSync(appOfApps)) {
    shell.exec(`kubectl apply -n argocd -f ${appOfApps}`);
  }

  // Preload service paths
  const servicesDir = path.join(projectRoot, "services");
  if (fs.existsSync(servicesDir)) {
    fs.readdirSync(servicesDir).forEach(svc => {
      const fullPath = path.join(servicesDir, svc);
      if (fs.statSync(fullPath).isDirectory()) {
        setServicePath(svc, fullPath);
      }
    });
  }

  // Start port-forward
  startPortForward();

  updateHosts();
  console.log(chalk.green("✅ localhost addresses updated (/etc/hosts)"));

  console.log(chalk.green("✅ lagerr setup complete!"));
}
