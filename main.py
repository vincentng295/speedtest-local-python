"""Speedtest LAN - Flask backend.

Endpoints
  GET  /                -> giao diện (static/index.html)
  GET  /api/info        -> IP client + thông tin server
  GET  /api/ping        -> phản hồi rỗng, dùng đo latency/jitter
  GET  /api/download    -> stream dữ liệu ngẫu nhiên (?size=bytes)
  POST /api/upload      -> nhận và đếm byte, bỏ dữ liệu
Chạy dev:        python main.py
Chạy production: python gunicorn.py
"""
import os
import socket
import time

from flask import Flask, Response, jsonify, request, send_from_directory

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8080"))

ISP_NAME = os.getenv("SPEEDTEST_ISP", "Local Network")
SERVER_NAME = os.getenv("SPEEDTEST_SERVER_NAME", socket.gethostname())
SERVER_LOCATION = os.getenv("SPEEDTEST_LOCATION", "LAN")
MAX_DOWNLOAD = int(os.getenv("MAX_DOWNLOAD_MB", "1024")) * 1024 * 1024

# 1 MiB dữ liệu ngẫu nhiên (không nén được), dùng lại cho mọi response
CHUNK = os.urandom(1024 * 1024)

app = Flask(__name__, static_folder=STATIC_DIR, static_url_path="/static")

if os.getenv("TRUST_PROXY") == "1":  # đứng sau nginx / cloudflared
    from werkzeug.middleware.proxy_fix import ProxyFix
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)


@app.after_request
def no_cache(resp):
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Access-Control-Allow-Origin"] = "*"
    return resp


def lan_ips():
    """Các IP LAN của máy để in ra khi khởi động."""
    ips = set()
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))
        ips.add(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ips.add(info[4][0])
    except OSError:
        pass
    return sorted(ip for ip in ips if not ip.startswith("127."))


@app.get("/")
def index():
    return send_from_directory(STATIC_DIR, "index.html")


@app.get("/healthz")
def healthz():
    return "ok"


@app.get("/api/info")
def info():
    return jsonify(
        ip=request.remote_addr,
        isp=ISP_NAME,
        server=SERVER_NAME,
        location=SERVER_LOCATION,
        max_download=MAX_DOWNLOAD,
        time=time.time(),
    )


@app.route("/api/ping", methods=["GET", "HEAD", "POST"])
def ping():
    return Response(b"", status=200, mimetype="text/plain")


@app.get("/api/download")
def download():
    try:
        size = int(request.args.get("size", 64 * 1024 * 1024))
    except ValueError:
        size = 64 * 1024 * 1024
    size = max(1, min(size, MAX_DOWNLOAD))

    def gen():
        sent = 0
        n = len(CHUNK)
        while sent < size:
            left = size - sent
            if left >= n:
                yield CHUNK
                sent += n
            else:
                yield CHUNK[:left]
                sent += left

    return Response(
        gen(),
        mimetype="application/octet-stream",
        headers={"Content-Length": str(size), "Content-Encoding": "identity"},
    )


@app.post("/api/upload")
def upload():
    t0 = time.perf_counter()
    total = 0
    stream = request.stream
    while True:
        buf = stream.read(1024 * 1024)
        if not buf:
            break
        total += len(buf)
    return jsonify(bytes=total, seconds=time.perf_counter() - t0)


if __name__ == "__main__":
    for ip in lan_ips():
        print(f"  http://{ip}:{PORT}")
    app.run(host=HOST, port=PORT, threaded=True)
