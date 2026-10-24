"""Wrapper chạy production: python gunicorn.py

Lưu ý: file này tên 'gunicorn.py' nên sẽ che mất package gunicorn thật nếu
thư mục script nằm trong sys.path. Vì vậy ta gỡ nó ra trước khi import gunicorn,
rồi mới thêm lại để import được main.py.
Đừng chạy lệnh `gunicorn main:app` trong thư mục này - hãy dùng file này.

Biến môi trường: HOST, PORT, WORKERS, THREADS, TIMEOUT, LOG_LEVEL
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path = [p for p in sys.path if os.path.abspath(p or os.getcwd()) != HERE]

HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8080"))
WORKERS = int(os.getenv("WORKERS", "2"))
THREADS = int(os.getenv("THREADS", "32"))
TIMEOUT = int(os.getenv("TIMEOUT", "300"))


def run():
    try:
        from gunicorn.app.base import BaseApplication  # import gunicorn thật TRƯỚC
    except ImportError:
        BaseApplication = None

    sys.path.append(HERE)  # giờ mới cho phép import main.py
    from main import app, lan_ips  # noqa: E402

    print(f"Speedtest LAN đang chạy trên {HOST}:{PORT}")
    for ip in lan_ips():
        print(f"  http://{ip}:{PORT}")

    if BaseApplication is None:
        # Windows không có gunicorn (thiếu fcntl) -> dùng waitress
        from waitress import serve
        serve(app, host=HOST, port=PORT, threads=max(THREADS, 16))
        return

    class Standalone(BaseApplication):
        def __init__(self, application, options):
            self.application = application
            self.options = options
            super().__init__()

        def load_config(self):
            for k, v in self.options.items():
                self.cfg.set(k, v)

        def load(self):
            return self.application

    Standalone(app, {
        "bind": f"{HOST}:{PORT}",
        "workers": WORKERS,
        "threads": THREADS,
        "worker_class": "gthread",   # cần cho nhiều stream download/upload song song
        "timeout": TIMEOUT,
        "keepalive": 5,
        "accesslog": None,
        "errorlog": "-",
        "loglevel": os.getenv("LOG_LEVEL", "warning"),
    }).run()


if __name__ == "__main__":
    run()
