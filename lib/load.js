import shell from "shelljs";
import chalk from "chalk";
import inquirer from "inquirer";
import path from "path";
import fs from "fs";
import { getServicePath, setServicePath, getProjectRoot } from "./config.js";

export default async function loadService(service) {
  let svcPath = getServicePath(service);
  const projectRoot = getProjectRoot();

  // Resolve service path
  if (!svcPath && projectRoot) {
    svcPath = path.join(projectRoot, "services", service);
    if (fs.existsSync(svcPath)) {
      setServicePath(service, svcPath);
    }
  }

  // If still not found, ask user
  if (!svcPath) {
    const { inputPath } = await inquirer.prompt([
      {
        type: "input",
        name: "inputPath",
        message: `Enter absolute path to service '${service}':`,
        validate: (input) =>
          path.isAbsolute(input) ? true : "Please enter an absolute path",
      },
    ]);
    svcPath = inputPath;
    setServicePath(service, svcPath);
  }

  // === NEW FEATURE: build & copy lager-messaging into service/lib ===

  const messagingPath = path.join(
    projectRoot, 
    "services",
    "lager-messaging"
  );

  if (!fs.existsSync(messagingPath)) {
    console.log(chalk.red(`❌ Shared library not found at: ${messagingPath}`));
    process.exit(1);
  }

  console.log(chalk.cyan("🔨 Building shared library lager-messaging..."));
  if (shell.exec(`mvn -q -DskipTests package -f ${messagingPath}`).code !== 0) {
    console.log(chalk.red("❌ Failed to build lager-messaging"));
    process.exit(1);
  }

  const jarPath = path.join(
    messagingPath,
    "target",
    "lager-messaging-0.0.1-SNAPSHOT.jar"
  );

  if (!fs.existsSync(jarPath)) {
    console.log(chalk.red(`❌ Built JAR not found at: ${jarPath}`));
    process.exit(1);
  }

  // Ensure /lib exists inside microservice
  const libFolder = path.join(svcPath, "lib");
  if (!fs.existsSync(libFolder)) {
    fs.mkdirSync(libFolder);
  }

  const targetCopyPath = path.join(libFolder, "lager-messaging.jar");

  console.log(
    chalk.cyan(`📁 Copying messaging library to ${targetCopyPath} ...`)
  );
  fs.copyFileSync(jarPath, targetCopyPath);

  console.log(chalk.green("✔ Shared library copied to service /lib folder"));

  // === CONTINUE WITH DOCKER BUILD ===

  console.log(chalk.cyan(`▶ Building ${service} from ${svcPath}`));
  if (
    shell.exec(
      `docker buildx build --platform linux/arm64 -t ${service}:local --load ${svcPath}`
    ).code !== 0
  ) {
    console.log(chalk.red(`❌ Failed to build ${service}`));
    process.exit(1);
  }

  shell.exec(`kind load docker-image ${service}:local --name lagerr`);

  const exists =
    shell.exec(`kubectl -n default get deploy ${service}`, {
      silent: true,
    }).code === 0;

  if (!exists) {
    console.log(
      chalk.yellow(`📦 No Deployment found for ${service}, applying manifests...`)
    );
    const k8sPath = path.join(svcPath, "k8s");
    if (fs.existsSync(k8sPath)) {
      shell.exec(`kubectl apply -n default -f ${k8sPath}`);
    } else {
      console.log(chalk.red(`❌ No k8s/ folder found in ${svcPath}`));
      process.exit(1);
    }
  }

  // Reapply ingress
  if (projectRoot) {
    const ingressFile = path.join(
      projectRoot,
      "infra",
      "ingress",
      "services-ingress.yaml"
    );
    if (fs.existsSync(ingressFile)) {
      console.log(chalk.cyan("🔁 Reapplying ingress..."));
      shell.exec(`kubectl apply -f ${ingressFile}`);
    }
  }

  console.log(chalk.yellow(`🔄 Restarting deployment for ${service}`));
  shell.exec(`kubectl -n default rollout restart deploy/${service} || true`);
  shell.exec(`kubectl -n default rollout status deploy/${service} || true`);

  console.log(chalk.green(`✅ ${service} deployed and up to date`));
}
