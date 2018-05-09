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
import * as ldap from 'ldapjs';

// Options
const options = commandLineArgs(optionDefinitions);

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
}
else
{
    // Without TLS
    var socket = new EACSSocket({
        host: options.host,
        port: options.port,
        jwtPubKey: jwtPublicKey
    });
}

enum RPCErrors
{
    UNSUPPORTED_TAG_TYPE                = 1,
    AUTHENTICATE_FAILED                 = 2,
    INITIALIZE_KEY_FAILED               = 3,
    ACCESS_DENIED                       = 4,
}

// Initialize LDAP client
var ldapClient = ldap.createClient({
    url: options.ldapURL
});

// Authenticate LDAP
ldapClient.bind(options.ldapUser, options.ldapPass, (err) => {
    if (err)
        throw new Error(`LDAP bind failed: ${err}`);
    else
        Log.info('index: LDAP bind successful.');
});

function asyncLDAPSearch(base: string, filter: string): Promise<any[]>
{
    return new Promise((resolve, reject) => {
        var opts = {
            scope: 'sub',
            filter
        };

        var results: any[] = [];
        ldapClient.search(base, opts, function(err, res) {
            if (err)
            {
                Log.error(`index: LDAP search error: ${err}`);
                return;
            }

            res.on('searchEntry', function(entry) {
                results.push(entry.object);
            });
            res.on('error', function(err) {
                reject(err);
            });
            res.on('end', function(result) {
                resolve(results);
            });
        });
    })
}

async function findUserByUID(uid: string)
{
    if (!uid.match(/^[a-z0-9]+$/i))
        throw new Error('Invalid UID format');

    var users = await asyncLDAPSearch(
        'dc=example,dc=com',
        `(&(associatedDomain=${uid}))`
    );

    Log.debug(`findUserByUID: users: ${JSON.stringify(users)}`);

    if (!users.length)
        throw new Error('User not found');

    return users[0];
}

async function userOfGroupWithPermission(uid: string, perm: string)
{
    var groups = await asyncLDAPSearch(
        'dc=example,dc=com',
        `(&(memberUid=${uid})(bootFile=${perm}))`
    );

    Log.debug(`userOfGroupWithPermission: groups: ${JSON.stringify(groups)}`);

    return groups.length > 0;
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
        // Check password for this method
        if (!token.hasPermission("eacs-user-auth:auth_uid"))
            throw new RPCMethodError(RPCErrors.ACCESS_DENIED, 'No permission to call auth_uid');

        try {
            let user = await findUserByUID(uid);
            Log.debug(`auth_uid: user: ${JSON.stringify(user)}`);

            let auth = await userOfGroupWithPermission(user.uid, token.identifier);

            return auth;
        } catch (err) {
            Log.debug(`auth_uid: find user error: ${err}`);
            return false;
        }
    });
});

process.on('unhandledRejection', (reason, promise) => {
    Log.error("Unhandled promise rejection", {reason, promise});
});
