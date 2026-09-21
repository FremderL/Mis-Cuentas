#!/usr/bin/env python3
"""Servidor de vista previa/ desarrollo para Mis Cuentas.

Sirve los archivos estáticos SIN caché (no-store), para que
cada recarga traiga siempre la versión más reciente del código.
Uso:  python3 server.py  [puerto=8000]
"""
import http.server
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):  # consola limpia
        pass


if __name__ == '__main__':
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(('0.0.0.0', PORT), NoCacheHandler) as httpd:
        print(f'Vista previa en http://0.0.0.0:{PORT} (sin caché)')
        httpd.serve_forever()
