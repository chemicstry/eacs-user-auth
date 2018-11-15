import commandLineArgs = require('command-line-args');
import commandLineUsage = require('command-line-usage');
import { EACSSocket, EACSToken } from 'eacs-socket';
import * as WebSocket from 'ws';
import { readFileSync } from 'fs';
import { IncomingMessage } from 'http';
import * as https from 'https';
import { Log } from './Log';
import { WSTransport, RPCNode } from 'modular-json-rpc';
import { RPCMethodError } from 'modular-json-rpc/dist/Defines';
import optionDefinitions from './options';
import DB from './DB';
import Bonjour from 'bonjour';

// Options
const options = commandLineArgs(<commandLineUsage.OptionDefinition[]>optionDefinitions);

// Print usage
if (options.help)
{
    const sections = [
        {
            header: 'eacs-user-auth',
            content: 'Extensible Access Control System. User Authentication Module.'
        },
        {
            header: 'Options',
            optionList: optionDefinitions
        }
    ];

    console.log(commandLineUsage(sections));
    process.exit();
}

// Load JWT public key
const jwtPublicKey = readFileSync(options.jwtPublicKey, "utf8");

// Setup EACSSocket (websockets with JWT auth)
if (options.tls_cert.length)
{
    // With TLS
    var server = https.createServer({
        cert: readFileSync(options.tls_cert),
        key: readFileSync(options.tls_key)
    }).listen(options.port, options.host);

    var socket = new EACSSocket({
        jwtPubKey: jwtPublicKey,
        server
    });

    Log.info(`Service started on ${options.host}:${options.port} with TLS encryption`)
}
else
{
    // Without TLS
    var socket = new EACSSocket({
        host: options.host,
        port: options.port,
        jwtPubKey: jwtPublicKey
    });

    Log.info(`Service started on ${options.host}:${options.port}`)
}

// Start mdns advertisement
if (options.mdns)
{
    var mdns = Bonjour();
    mdns.publish({ name: 'eacs-user-auth', type: 'eacs-user-auth', port: options.port });
    Log.info("Started mDNS advertisement");
}

enum RPCErrors
{
    UNSUPPORTED_TAG_TYPE                = 1,
    AUTHENTICATE_FAILED                 = 2,
    INITIALIZE_KEY_FAILED               = 3,
    ACCESS_DENIED                       = 4,
}

// Initialize database
const db = new DB(options.dbFile);

function RequirePermission(token: EACSToken, permission: string)
{
    if (!token.hasPermission(`eacs-user-auth:${permission}`))
        throw new RPCMethodError(RPCErrors.ACCESS_DENIED, `No permission to call ${permission}`);
}

socket.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    let token = <EACSToken>(<any>req).token;

    Log.info(`index: New connection from ${req.connection.remoteAddress}. Identifier: ${token.identifier}`);

    // Create RPC transport over websocket
    let transport = new WSTransport(ws);

    // Create bidirectional RPC connection
    let node = new RPCNode(transport);

    // Handle error
    node.on('error', (e) => {
        Log.error("Internal JSONRPC Error", e);
    });
    ws.on('error', (e) => {
        Log.error("WebSocket Error", e);
    });

    // object - permission (i.e. main door, lights, etc)
    node.bind("auth_uid", async (object: string, uid: string) => {
        RequirePermission(token, "auth_uid");

        var res = await db.authUID(uid, object);

        if (res) {
            Log.info("auth_uid successful", {object, uid});
            return true;
        } else {
            Log.info("auth_uid failed", {object, uid});
            return false;
        }
    });

    node.bind("getUsers", async () => {
        RequirePermission(token, "getUsers");
        return db.getUsers();
    });

    node.bind("upsertUser", async (data: any) => {
        Log.info("upsertUser", data);
        RequirePermission(token, "upsertUser");
        db.upsertUser(data);
        return true;
    });

    node.bind("deleteUser", async (id: String) => {
        Log.info("deleteUser", id);
        RequirePermission(token, "deleteUser");
        db.deleteUser(id);
        return true;
    })

    node.bind("getGroups", async () => {
        RequirePermission(token, "getGroups");
        return db.getGroups();
    });

    node.bind("upsertGroup", async (data: any) => {
        Log.info("upsertGroup", data);
        RequirePermission(token, "upsertGroup");
        db.upsertGroup(data);
        return true;
    });

    node.bind("deleteGroup", async (id: String) => {
        Log.info("deleteGroup", id);
        RequirePermission(token, "deleteGroup");
        db.deleteGroup(id);
        return true;
    })
});
