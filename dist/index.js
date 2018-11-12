"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
}
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
}
Object.defineProperty(exports, "__esModule", { value: true });
const commandLineArgs = require("command-line-args");
const commandLineUsage = require("command-line-usage");
const eacs_socket_1 = require("eacs-socket");
const fs_1 = require("fs");
const https = __importStar(require("https"));
const Log_1 = require("./Log");
const modular_json_rpc_1 = require("modular-json-rpc");
const Defines_1 = require("modular-json-rpc/dist/Defines");
const options_1 = __importDefault(require("./options"));
const ldap = __importStar(require("ldapjs"));
// Options
const options = commandLineArgs(options_1.default);
// Print usage
if (options.help) {
    const sections = [
        {
            header: 'eacs-user-auth',
            content: 'Extensible Access Control System. User Authentication Module.'
        },
        {
            header: 'Options',
            optionList: options_1.default
        }
    ];
    console.log(commandLineUsage(sections));
    process.exit();
}
// Load JWT public key
const jwtPublicKey = fs_1.readFileSync(options.jwtPublicKey, "utf8");
// Setup EACSSocket (websockets with JWT auth)
if (options.tls_cert.length) {
    // With TLS
    var server = https.createServer({
        cert: fs_1.readFileSync(options.tls_cert),
        key: fs_1.readFileSync(options.tls_key)
    }).listen(options.port, options.host);
    var socket = new eacs_socket_1.EACSSocket({
        jwtPubKey: jwtPublicKey,
        server
    });
}
else {
    // Without TLS
    var socket = new eacs_socket_1.EACSSocket({
        host: options.host,
        port: options.port,
        jwtPubKey: jwtPublicKey
    });
}
var RPCErrors;
(function (RPCErrors) {
    RPCErrors[RPCErrors["UNSUPPORTED_TAG_TYPE"] = 1] = "UNSUPPORTED_TAG_TYPE";
    RPCErrors[RPCErrors["AUTHENTICATE_FAILED"] = 2] = "AUTHENTICATE_FAILED";
    RPCErrors[RPCErrors["INITIALIZE_KEY_FAILED"] = 3] = "INITIALIZE_KEY_FAILED";
    RPCErrors[RPCErrors["ACCESS_DENIED"] = 4] = "ACCESS_DENIED";
})(RPCErrors || (RPCErrors = {}));
// Initialize LDAP client
var ldapClient = ldap.createClient({
    url: options.ldapURL,
    timeout: 1000,
    connectTimeout: 1000,
    reconnect: true,
    tlsOptions: {
        ca: (options.ldapURL.startsWith('ldaps') ? fs_1.readFileSync(options.ldapCert) : undefined),
        rejectUnauthorized: false // BETTER FIX ME SOON
    }
});
ldapClient.on('error', function (err) {
    Log_1.Log.error('index: LDAP client error', err);
});
// Authenticate LDAP
ldapClient.bind(options.ldapUser, options.ldapPass, (err) => __awaiter(this, void 0, void 0, function* () {
    if (err)
        throw new Error(`LDAP bind failed: ${err}`);
    else
        Log_1.Log.info('index: LDAP bind successful.');
    var user = yield findUserByUID("046981BA703A80");
    Log_1.Log.debug(`auth_uid: user: ${JSON.stringify(user)}`);
}));
function asyncLDAPSearch(base, filter) {
    return new Promise((resolve, reject) => {
        var opts = {
            scope: 'sub',
            filter
        };
        // Holds all currently fetched results
        var results = [];
        // Start search
        ldapClient.search(base, opts, function (err, res) {
            if (err) {
                reject(err);
                return;
            }
            // Append results when new entry is received
            res.on('searchEntry', function (entry) {
                results.push(entry.object);
            });
            // Rejects promise on error
            res.on('error', function (err) {
                reject(err);
            });
            // Resolve promise with the acquired results
            res.on('end', function (result) {
                resolve(results);
            });
        });
    });
}
function findUserByUID(uid) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!uid.match(/^[a-z0-9]+$/i))
            throw new Error('Invalid UID format');
        var users = yield asyncLDAPSearch(options.ldapSearchBase, `(associatedDomain=${uid})`);
        Log_1.Log.debug(`findUserByUID: users: ${JSON.stringify(users)}`);
        if (!users.length)
            throw new Error('User not found');
        return users[0];
    });
}
function userOfGroupWithPermission(uid, perm) {
    return __awaiter(this, void 0, void 0, function* () {
        var groups = yield asyncLDAPSearch(options.ldapSearchBase, `(&(memberUid=${uid})(bootFile=${perm}))`);
        Log_1.Log.debug(`userOfGroupWithPermission: groups: ${JSON.stringify(groups)}`);
        return groups.length > 0;
    });
}
socket.on('connection', (ws, req) => {
    let token = req.token;
    Log_1.Log.info(`index: New connection from ${req.connection.remoteAddress}. Identifier: ${token.identifier}`);
    // Create RPC transport over websocket
    let transport = new modular_json_rpc_1.WSTransport(ws);
    // Create bidirectional RPC connection
    let node = new modular_json_rpc_1.RPCNode(transport);
    // Handle error
    node.on('error', (e) => {
        Log_1.Log.error("Internal JSONRPC Error", e);
    });
    ws.on('error', (e) => {
        Log_1.Log.error("WebSocket Error", e);
    });
    // object - permission (i.e. main door, lights, etc)
    node.bind("auth_uid", (object, uid) => __awaiter(this, void 0, void 0, function* () {
        // Check password for this method
        if (!token.hasPermission("eacs-user-auth:auth_uid"))
            throw new Defines_1.RPCMethodError(RPCErrors.ACCESS_DENIED, 'No permission to call auth_uid');
        try {
            let user = yield findUserByUID(uid);
            Log_1.Log.debug(`auth_uid: user: ${JSON.stringify(user)}`);
            let auth = yield userOfGroupWithPermission(user.uid, token.identifier);
            return auth;
        }
        catch (err) {
            Log_1.Log.error(`auth_uid: find user error: ${err}`);
            return false;
        }
    }));
});
process.on('unhandledRejection', (reason, promise) => {
    Log_1.Log.error("Unhandled promise rejection", { reason, promise });
});
