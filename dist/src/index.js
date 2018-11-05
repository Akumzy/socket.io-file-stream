"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = __importDefault(require("./lib/client"));
const server_1 = __importDefault(require("./lib/server"));
exports.Server = server_1.default;
const client_web_1 = __importDefault(require("./lib/client-web"));
let Client = isNodejs ? client_1.default : client_web_1.default;
exports.Client = Client;
function isNodejs() {
    return (typeof "process" !== "undefined" &&
        process &&
        process.versions &&
        process.versions.node);
}
exports.default = { Client, Server: server_1.default, Web: client_web_1.default };
