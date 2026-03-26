"""
Proxy server that forwards all requests to NestJS backend running on port 3001
"""
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import httpx
import subprocess
import threading
import os
import time
import signal
import sys

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

NESTJS_PORT = 3001
NESTJS_URL = f"http://localhost:{NESTJS_PORT}"
nestjs_process = None

def start_nestjs():
    """Start NestJS backend in background"""
    global nestjs_process
    
    # Set PORT for NestJS
    env = os.environ.copy()
    env['PORT'] = str(NESTJS_PORT)
    env['MONGO_URL'] = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    env['DB_NAME'] = os.environ.get('DB_NAME', 'fomo_market')
    
    print(f"[Proxy] Starting NestJS on port {NESTJS_PORT}...")
    nestjs_process = subprocess.Popen(
        ['node', 'dist/main.js'],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
        cwd='/app/backend'
    )
    
    # Log output in background
    def log_output(stream, prefix):
        for line in iter(stream.readline, b''):
            print(f"[NestJS {prefix}] {line.decode().strip()}")
    
    threading.Thread(target=log_output, args=(nestjs_process.stdout, 'OUT'), daemon=True).start()
    threading.Thread(target=log_output, args=(nestjs_process.stderr, 'ERR'), daemon=True).start()
    
    # Wait for NestJS to be ready with health check
    import urllib.request
    max_retries = 30
    for i in range(max_retries):
        try:
            with urllib.request.urlopen(f"http://localhost:{NESTJS_PORT}/api/health", timeout=2) as resp:
                if resp.status == 200:
                    print(f"[Proxy] NestJS ready after {i+1} attempts")
                    break
        except Exception:
            pass
        time.sleep(1)
    else:
        print(f"[Proxy] Warning: NestJS may not be ready after {max_retries} attempts")
    
    print(f"[Proxy] NestJS started with PID {nestjs_process.pid}")

def cleanup(signum=None, frame=None):
    global nestjs_process
    if nestjs_process:
        print("[Proxy] Stopping NestJS...")
        nestjs_process.terminate()
        nestjs_process.wait()
    sys.exit(0)

signal.signal(signal.SIGTERM, cleanup)
signal.signal(signal.SIGINT, cleanup)

# Start NestJS on app startup
@app.on_event("startup")
async def startup_event():
    start_nestjs()

@app.on_event("shutdown") 
async def shutdown_event():
    cleanup()

# Proxy all requests to NestJS
@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def proxy(request: Request, path: str):
    # Build target URL
    target_url = f"{NESTJS_URL}/{path}"
    if request.query_params:
        target_url += f"?{request.query_params}"
    
    # Get request body
    body = await request.body()
    
    # Forward headers
    headers = dict(request.headers)
    headers.pop('host', None)
    
    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            # Retry logic for connection
            for attempt in range(3):
                try:
                    response = await client.request(
                        method=request.method,
                        url=target_url,
                        content=body,
                        headers=headers,
                    )
                    
                    # Return response
                    return Response(
                        content=response.content,
                        status_code=response.status_code,
                        headers=dict(response.headers),
                    )
                except httpx.ConnectError:
                    if attempt < 2:
                        import asyncio
                        await asyncio.sleep(1)
                        continue
                    raise
    except httpx.ConnectError:
        return Response(
            content='{"error": "NestJS backend not available"}',
            status_code=503,
            media_type="application/json"
        )
    except Exception as e:
        return Response(
            content=f'{{"error": "{str(e)}"}}',
            status_code=500,
            media_type="application/json"
        )
