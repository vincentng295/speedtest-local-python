# Speedtest LAN

A self-hosted, speedtest.net-style web page that measures ping, jitter, download and upload speed between a browser and a Flask server on your local network.

## Files

| File | Purpose |
|------|---------|
| `main.py` | Flask app (API + static UI) |
| `gunicorn.py` | Production wrapper (binds `0.0.0.0`) |
| `static/` | `index.html`, `style.css`, `app.js` |
| `requirements.txt` | Dependencies |

## Run

```bash
pip install -r requirements.txt
python gunicorn.py     # production
python main.py         # development
```

Open `http://<server-lan-ip>:8080` from any device on the network. The URLs are printed on startup.

> Always start with `python gunicorn.py`. Do not run `gunicorn main:app` in this folder: the file name shadows the real `gunicorn` package (the wrapper handles this). On Windows it falls back to `waitress`.

## Configuration (environment variables)

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Bind address |
| `PORT` | `8080` | Port |
| `WORKERS` | `2` | Gunicorn workers |
| `THREADS` | `32` | Threads per worker |
| `TIMEOUT` | `300` | Worker timeout (s) |
| `SPEEDTEST_ISP` | `Local Network` | Name shown next to the client IP |
| `SPEEDTEST_SERVER_NAME` | hostname | Server name shown in the UI |
| `SPEEDTEST_LOCATION` | `LAN` | Server location shown in the UI |
| `MAX_DOWNLOAD_MB` | `1024` | Max size per download request |
| `TRUST_PROXY` | unset | Set `1` behind nginx/cloudflared to read the real client IP |

## API

- `GET /api/info` – client IP and server info
- `GET /api/ping` – empty response for latency
- `GET /api/download?size=<bytes>` – streams random data
- `POST /api/upload` – discards the body, returns byte count

## Notes

- Multi mode uses parallel streams (default 6, configurable in Settings); Single uses one.
- The first 1.5 s of each phase is excluded to skip TCP slow start.
- For accurate results on gigabit or faster links, use a wired client and keep `WORKERS × THREADS` above the number of streams.
