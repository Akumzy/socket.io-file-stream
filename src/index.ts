import client from "./lib/client";
import Server from "./lib/server";
import clientWeb from "./lib/client-web";
let Client = isNodejs ? client : clientWeb;

function isNodejs() {
  return (
    typeof "process" !== "undefined" &&
    process &&
    process.versions &&
    process.versions.node
  );
}
export { Client, Server };
export default { Client, Server, Web: clientWeb };
