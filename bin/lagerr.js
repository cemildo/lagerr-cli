#!/usr/bin/env node
import { program } from "commander";
import setup from "../lib/setup.js";
import destroy from "../lib/destroy.js";
import start from "../lib/start.js";
import stop from "../lib/stop.js";
import restart from "../lib/restart.js";
import test from "../lib/test.js";
import loadService from "../lib/load.js";
import configService from "../lib/config.js";

program.name("lagerr").description("Manage local lagerr Kubernetes cluster");

program.command("setup").description("Destroy old cluster and install everything fresh").action(setup);
program.command("destroy").description("Completely remove lagerr cluster").action(destroy);
program.command("start").description("Start the lagerr kind cluster").action(start);
program.command("stop").description("Stop the lagerr kind cluster").action(stop);
program.command("restart").description("Restart the lagerr kind cluster").action(restart);
program.command("test").description("lagerr runns k6 load tests").action(test);

program.command("load <service>").description("Build & load a service into Kubernetes").action(loadService);
program.command("config <service>").description("View or update path for a service").action(configService);

program.parse();
