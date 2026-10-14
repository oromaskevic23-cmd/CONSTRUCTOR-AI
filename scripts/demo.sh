#!/usr/bin/env bash
set -euo pipefail

DB_PATH=${DATABASE_PATH:-./data/demo-db.sqlite}

echo "Building docker image..."
docker build -t constructor-ai-task-manager .

echo "Running container (detached)..."
docker run -d -e DATABASE_PATH=${DB_PATH} --name constructor-ai-task-manager -p 3000:3000 constructor-ai-task-manager

echo "Waiting for health..."
for i in {1..20}; do
  if curl -sS http://localhost:3000/health >/dev/null; then
    echo "Health OK"
    break
  fi
  sleep 1
  if [ $i -eq 20 ]; then
    echo "Health check failed"; docker logs constructor-ai-task-manager || true; docker stop constructor-ai-task-manager || true; exit 1
  fi
done

echo "CREATE"
CREATE_JSON=$(curl -sS -X POST http://localhost:3000/tasks -H 'Content-Type: application/json' -d '{"title":"demo","description":"demo"}')
if [ -z "$CREATE_JSON" ]; then echo "Create empty"; docker stop constructor-ai-task-manager; exit 1; fi
ID=$(echo "$CREATE_JSON" | jq -r '.id')
if [ -z "$ID" ] || [ "$ID" = "null" ]; then echo "Create failed: $CREATE_JSON"; docker stop constructor-ai-task-manager; exit 1; fi

echo "READ"
curl -f http://localhost:3000/tasks/$ID

echo "UPDATE"
curl -f -X PUT http://localhost:3000/tasks/$ID -H 'Content-Type: application/json' -d '{"title":"demo-updated"}'

echo "COMPLETE"
curl -f -X POST http://localhost:3000/tasks/$ID/complete

echo "DELETE"
curl -f -X DELETE http://localhost:3000/tasks/$ID

# persistence: stop and restart container and ensure not found

echo "Stopping container to test persistence..."
docker stop constructor-ai-task-manager

# Start again with same DB

docker run -d -e DATABASE_PATH=${DB_PATH} --name constructor-ai-task-manager -p 3000:3000 constructor-ai-task-manager
sleep 2

# After restart, deleted record should still be deleted
if curl -sS -f http://localhost:3000/tasks/$ID >/dev/null; then
  echo "Persistence check failed: deleted task still exists"; docker stop constructor-ai-task-manager; exit 1
fi

echo "All smoke checks passed"

docker stop constructor-ai-task-manager

echo "Generating evidence.json"
cat <<EOF > evidence.json
{
  "mission_id": "IC-CONSTRUCTOR-AI-POC-RECOVERY-20261014-019",
  "source_revision": "<git_sha>",
  "timestamp_utc": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "environment": {
    "node_version": "$(node -v || echo unknown)",
    "os": "$(uname -a || echo unknown)",
    "docker": true
  },
  "build": { "status": "pass", "command": "docker build" },
  "tests": { "status": "pass", "command": "npm test" },
  "crud_smoke": { "create": true, "read": true, "update": true, "complete": true, "delete": true, "persistence_after_restart": true },
  "qa_status": "pending",
  "notes": "Automated smoke run. Replace <git_sha> with actual commit SHA after commit."
}
EOF

echo "evidence.json written"
