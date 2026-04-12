import fs from "fs";
import path from "path";
import inquirer from "inquirer";
import chalk from "chalk";

const CONFIG_FILE = ".lagerr-config.json";

function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) return {};
  return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

export default async function configService(service) {
  const cfg = loadConfig();
  if (cfg[service]) {
    console.log(chalk.green(`Current path for '${service}': ${cfg[service]}`));
    const { update } = await inquirer.prompt([{
      type: "confirm",
      name: "update",
      message: "Do you want to update it?",
      default: false
    }]);
    if (!update) return;
  }
  const { svcPath } = await inquirer.prompt([{
    type: "input",
    name: "svcPath",
    message: `Enter absolute path to service '${service}':`,
    validate: (input) => path.isAbsolute(input) ? true : "Please enter an absolute path"
  }]);
  cfg[service] = svcPath;
  saveConfig(cfg);
  console.log(chalk.green(`✅ Path for '${service}' saved: ${svcPath}`));
}

export function getConfig() {
  return loadConfig();
}

export function saveProjectRoot(projectRoot) {
  const cfg = loadConfig();
  cfg.projectRoot = projectRoot;
  saveConfig(cfg);
}

export function getProjectRoot() {
  const cfg = loadConfig();
  return cfg.projectRoot || null;
}

export function getServicePath(service) {
  const cfg = loadConfig();
  return cfg[service] || null;
}

export function setServicePath(service, svcPath) {
  const cfg = loadConfig();
  cfg[service] = svcPath;
  saveConfig(cfg);
}

 
