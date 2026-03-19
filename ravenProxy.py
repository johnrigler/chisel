#!/usr/bin/env python3

import json
from http.server import BaseHTTPRequestHandler, HTTPServer
import urllib.request
import ssl

RPC_TARGET = "http://127.0.0.1:8766/"
RPC_USER = "root"
RPC_PASS = "password"
PORT = 8769
CERT = "/etc/letsencrypt/live/rigler.org/fullchain.pem"
KEY =  "/etc/letsencrypt/live/rigler.org/privkey.pem"

METHOD_GROUPS = {

    "address": [
         "getaddressbalance",
         "getaddressdeltas",
         "getaddressmempool",
         "getaddresstxids",
         "getaddressutxos"
    ],
    "block": [
        "getblockcount",
        "getblockhash",
        "getblock",
        "getblockchaininfo"
    ],
    "network": [
        "getpeerinfo",
        "getnetworkinfo"
    ],
    "tx": [
        "combinerawtransaction",
        "createrawtransaction",
        "decoderawtransaction",
        "decodescript",
        "getrawtransaction",
        "sendrawtransaction",
        "testmempoolaccept"
    ],


    "asset": [
        "listassets",
        "listaddressesbyasset",
        "issue",
        "issueunique",
        "issueadditional",
        "transfer"
    ],
    "misc": [
        "help"
    ]
}

ALLOWED_METHODS = {m for g in METHOD_GROUPS.values() for m in g}

class RPCProxy(BaseHTTPRequestHandler):

    def cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(200)
        self.cors()
        self.end_headers()

    def do_GET(self):

        if self.path == "/methods":
            self.send_response(200)
            self.cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(sorted(ALLOWED_METHODS)).encode())
            return

            self.send_error(404, "not found")

    def do_GET(self):

        if self.path == "/methods":

            self.send_response(200)
            self.cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()

            self.wfile.write(json.dumps(METHOD_GROUPS).encode())
            return

            self.send_error(404, "not found")

    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length)

        try:
            req = json.loads(body)
            method = req.get("method")
        except:
            self.send_error(400, "invalid json")
            return

        if method not in ALLOWED_METHODS:
            self.send_error(403, "method not allowed")
            return

        # forward request to internal node
        request = urllib.request.Request(
            RPC_TARGET,
            data=body,
            headers={"Content-Type": "text/plain"},
        )

        password_mgr = urllib.request.HTTPPasswordMgrWithDefaultRealm()
        password_mgr.add_password(None, RPC_TARGET, RPC_USER, RPC_PASS)

        auth_handler = urllib.request.HTTPBasicAuthHandler(password_mgr)
        opener = urllib.request.build_opener(auth_handler)

        try:
            response = opener.open(request)
            data = response.read()

            self.send_response(200)
            self.cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(data)

        except Exception as e:
            self.send_error(500, str(e))


def run():
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(CERT, KEY)  # your certificate and key files
    server = HTTPServer(("0.0.0.0", PORT), RPCProxy)
    server.socket = ctx.wrap_socket(server.socket, server_side=True)
    print(f"HTTPS RPC proxy listening on {PORT}")
    server.serve_forever()

run()
