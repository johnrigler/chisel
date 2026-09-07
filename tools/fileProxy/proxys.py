#!/usr/bin/env python3
"""HTTPS compatibility launcher for Chisel fileProxy.

The implementation lives in proxy.py.  Keep TLS startup in one place so the
HTTP and HTTPS entry points cannot drift into two copies of the server.
"""

import os

# proxys.py historically meant "run the public rigler.org HTTPS instance".
# Set defaults before importing proxy.py because proxy.py reads configuration at
# import time.  Every value remains overrideable from the environment.
os.environ.setdefault("CHISEL_FILE_HOST", "0.0.0.0")
os.environ.setdefault("CHISEL_FILE_PORT", "7799")
os.environ.setdefault("CHISEL_FILE_TLS", "1")
os.environ.setdefault("CHISEL_FILE_CERT", "/etc/letsencrypt/live/rigler.org/fullchain.pem")
os.environ.setdefault("CHISEL_FILE_KEY", "/etc/letsencrypt/live/rigler.org/privkey.pem")

from proxy import main


if __name__ == "__main__":
    main()
