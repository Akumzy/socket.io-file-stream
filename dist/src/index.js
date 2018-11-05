"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = __importDefault(require("./lib/client"));
exports.Client = client_1.default;
const server_1 = __importDefault(require("./lib/server"));
exports.Server = server_1.default;
const client_web_1 = __importDefault(require("./lib/client-web"));
exports.ClientWeb = client_web_1.default;
exports.default = { Client: client_1.default, Server: server_1.default, ClientWeb: client_web_1.default };
