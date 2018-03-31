import * as WebSocket from 'ws';
import { Log } from './Log';
import { WSTransport, RPCNode } from 'modular-json-rpc';

const wss = new WebSocket.Server({ port: 3000 });

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
});

process.on('unhandledRejection', (reason, promise) => {
    Log.error("Unhandled promise rejection", {reason, promise});
});
