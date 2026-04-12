import fs from "fs";
import yaml from "js-yaml";
import os from "os";
import { execSync } from "child_process";
import { getProjectRoot } from "./config.js";
import path from "path";

const ingressPath = "/infra/ingress/services-ingress.yaml";
const hostsFile = "/etc/hosts";
const loopback = "127.0.0.1";

export default function updateHosts() {

  const projectRoot = getProjectRoot();
  console.log("Project root: ", projectRoot);
  const ingressPathFromRoot = path.join(projectRoot, 'infra', 'ingress', 'services-ingress.yaml');
  
  if (!fs.existsSync(ingressPathFromRoot)) {
    console.error("⚠️ No ingressPath from the root path" + ingressPath + "ingress setup wont be run!!!");
    return;
  }
  // 1. Parse ingress YAML
  const content = fs.readFileSync(ingressPathFromRoot, "utf8");
  const docs = yaml.loadAll(content);

  // collect hosts from all docs with kind: Ingress
  const hosts = [];
  docs.forEach(doc => {
    if (doc && doc.kind === "Ingress" && doc.spec?.rules) {
      doc.spec.rules.forEach(rule => {
        if (rule.host) hosts.push(rule.host);
      });
    }
  });

  if (hosts.length === 0) {
    console.log("⚠️ No hosts found in ingress file");
    return;
  }

  console.log("🔎 Found hosts in ingress:", hosts.join(", "));

  // 2. Read /etc/hosts
  const hostsFileContent = fs.readFileSync(hostsFile, "utf8");
  const lines = hostsFileContent.split(/\r?\n/);

  // 3. Check and append missing ones
  let modified = false;
  hosts.forEach(host => {
    const exists = lines.some(line => line.includes(host));
    if (!exists) {
      const entry = `${loopback} ${host}`;
      console.log(`➕ Adding: ${entry}`);
      execSync(`echo "${entry}" | sudo tee -a ${hostsFile}`);
      modified = true;
    } else {
      console.log(`✅ Already exists: ${host}`);
    }
  });

  if (!modified) {
    console.log("✅ /etc/hosts already up to date");
  }
}

 
