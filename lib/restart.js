import stop from "./stop.js";
import start from "./start.js";

export default function restart() {
  stop();
  start();
}
