import * as WebSocket from 'ws';
import { Log } from './Log';
import { WSTransport, RPCNode } from 'modular-json-rpc';

const wss = new WebSocket.Server({ port: 3001 });

wss.on('connection', (ws: WebSocket) => {
    Log.info("index: New websocket connection");

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
    node.bind("auth_uid", (object: string, uid: string) => {
        if (uid === "046981BA703A80")
            return true;
        else
            return false;
    });
});

process.on('unhandledRejection', (reason, promise) => {
    Log.error("Unhandled promise rejection", {reason, promise});
});
