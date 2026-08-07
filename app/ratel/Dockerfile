FROM ubuntu:24.04

# curl is baked in so the container healthcheck is a plain `curl -f localhost`
# — the previous compose healthcheck ran `apt update && apt install curl` on
# every probe, which intermittently exceeded the 10s probe timeout under CI
# load (Android emulator running alongside), flapping the container to
# `unhealthy` and failing the tauri-smoke "Bring up testing infra" step even
# though the server was serving fine.
RUN for i in 1 2 3; do apt-get update && break || sleep 5; done \
    && apt-get install -y ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app
COPY . .

EXPOSE 8080

CMD ["./server"]
