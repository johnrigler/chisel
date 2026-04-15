#!/usr/bin/env python3

import base64
import json
import ssl
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


with open("proxyConfig.json", "r", encoding="utf-8") as file:
    CONFIG = json.load(file)


RPC_TARGET = CONFIG["RPC_TARGET"]
RPC_USER = CONFIG["RPC_USER"]
RPC_PASS = CONFIG["RPC_PASS"]

BIND_HOST = CONFIG.get("BIND_HOST", "0.0.0.0")
PORT = int(CONFIG.get("PORT", 8443))

USE_TLS = bool(CONFIG.get("USE_TLS", False))
CERT = CONFIG.get("CERT", "")
KEY = CONFIG.get("KEY", "")


METHOD_GROUPS = {
    "blockchain": [
        "getblockchaininfo",
        "getblockcount",
        "getblockhash",
        "getblock",
        "getbestblockhash",
        "getblockheader",
        "getchaintips",
        "getdifficulty",
        "getmempoolinfo",
        "getrawmempool",
        "gettxout",
        "gettxoutproof",
        "verifytxoutproof",
    ],
    "network": [
        "getconnectioncount",
        "getnetworkinfo",
        "getpeerinfo",
        "ping",
    ],
    "rawtx": [
        "createrawtransaction",
        "combinerawtransaction",
        "decoderawtransaction",
        "decodescript",
        "fundrawtransaction",
        "getrawtransaction",
        "sendrawtransaction",
        "signrawtransactionwithkey",
        "testmempoolaccept",
    ],
    "util": [
        "estimatesmartfee",
        "getrpcinfo",
        "help",
        "validateaddress",
    ],
    "wallet_readonly": [
        "listunspent",
    ],
}

ALLOWED_METHODS = {
    method
    for group in METHOD_GROUPS.values()
    for method in group
}


def build_basic_auth_header(username, password):
    token = f"{username}:{password}".encode("utf-8")
    encoded = base64.b64encode(token).decode("ascii")
    return f"Basic {encoded}"


def make_json_rpc_error(message, request_id=None, code=-32000):
    return {
        "result": None,
        "error": {
            "code": code,
            "message": message,
        },
        "id": request_id,
    }


class DGBRPCProxy(BaseHTTPRequestHandler):
    server_version = "dgbProxy/1.0"

    #
    # Helpers
    #
    def set_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def send_json(self, status_code, payload):
        encoded = json.dumps(payload).encode("utf-8")
        self.send_response(status_code)
        self.set_cors_headers()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def send_text(self, status_code, payload):
        encoded = payload.encode("utf-8")
        self.send_response(status_code)
        self.set_cors_headers()
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def read_json_body(self):
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            return None, "invalid content length"

        if content_length <= 0:
            return None, "empty body"

        try:
            raw_body = self.rfile.read(content_length)
            body = json.loads(raw_body.decode("utf-8"))
            return body, None
        except json.JSONDecodeError:
            return None, "invalid json"
        except UnicodeDecodeError:
            return None, "invalid utf-8"

    def forward_rpc_request(self, rpc_payload):
        request_data = json.dumps(rpc_payload).encode("utf-8")

        upstream_request = urllib.request.Request(
            RPC_TARGET,
            data=request_data,
            headers={
                "Content-Type": "application/json",
                "Authorization": build_basic_auth_header(RPC_USER, RPC_PASS),
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(upstream_request, timeout=30) as response:
                response_body = response.read().decode("utf-8")
                return response.status, json.loads(response_body)
        except urllib.error.HTTPError as error:
            try:
                error_body = error.read().decode("utf-8")
                parsed = json.loads(error_body)
            except Exception:
                parsed = make_json_rpc_error(str(error), rpc_payload.get("id"))
            return error.code, parsed
        except Exception as error:
            return 502, make_json_rpc_error(str(error), rpc_payload.get("id"))

    #
    # HTTP methods
    #
    def do_OPTIONS(self):
        self.send_response(200)
        self.set_cors_headers()
        self.end_headers()

    def do_GET(self):
        if self.path == "/methods":
            self.send_json(200, METHOD_GROUPS)
            return

        if self.path == "/health":
            self.send_json(
                200,
                {
                    "ok": True,
                    "rpcTarget": RPC_TARGET,
                    "allowedMethodCount": len(ALLOWED_METHODS),
                },
            )
            return

        self.send_json(404, {"error": "not found"})

    def do_POST(self):
        rpc_request, error = self.read_json_body()

        if error:
            self.send_json(400, make_json_rpc_error(error, None, -32700))
            return

        if not isinstance(rpc_request, dict):
            self.send_json(400, make_json_rpc_error("request must be a JSON object", None, -32600))
            return

        method = rpc_request.get("method")
        request_id = rpc_request.get("id")

        if not isinstance(method, str) or len(method) == 0:
            self.send_json(400, make_json_rpc_error("missing method", request_id, -32600))
            return

        if method not in ALLOWED_METHODS:
            self.send_json(403, make_json_rpc_error("method not allowed", request_id, -32601))
            return

        status_code, upstream_payload = self.forward_rpc_request(rpc_request)
        self.send_json(status_code, upstream_payload)

    def log_message(self, format_string, *args):
        return


def run():
    server = ThreadingHTTPServer((BIND_HOST, PORT), DGBRPCProxy)

    if USE_TLS:
        if not CERT or not KEY:
            raise RuntimeError("USE_TLS is true but CERT or KEY is missing in proxyConfig.json")

        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(CERT, KEY)
        server.socket = context.wrap_socket(server.socket, server_side=True)
        protocol = "HTTPS"
    else:
        protocol = "HTTP"

    print(f"{protocol} DGB RPC proxy listening on {BIND_HOST}:{PORT}")
    print(f"Forwarding to {RPC_TARGET}")
    server.serve_forever()


if __name__ == "__main__":
    run()
