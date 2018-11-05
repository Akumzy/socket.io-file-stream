import client from "./lib/client";
import Server from "./lib/server";
import clientWeb from "./lib/client-web";
declare let Client: typeof client | typeof clientWeb;
export { Client, Server };
declare const _default: {
    Client: typeof client | typeof clientWeb;
    Server: typeof Server;
    Web: typeof clientWeb;
};
export default _default;
