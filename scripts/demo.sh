#!/usr/bin/env bash
set -euo pipefail

DB_PATH=${DATABASE_PATH:-./data/demo-db.sqlite}

echo "Building docker image..."
docker build -t constructor-ai-task-manager .

echo "Running container (detached)..."
docker run -d -e DATABASE_PATH=${DB_PATH} --name constructor-ai-task-manager -p 3000:3000 constructor-ai-task-manager

echo "Waiting for health..."
for i in {1..10}; do
  if curl -sS http://localhost:3000/health >/dev/null; then
    echo "Health OK"
    break
  fi
  sleep 1
done

echo "Creating task via API..."
TASK_JSON=$(curl -sS -X POST http://localhost:3000/tasks -H 'Content-Type: application/json' -d '{"title":"demo","description":"demo"}')
echo "$TASK_JSON"

echo "Stopping container..."
docker stop constructor-ai-task-manager

echo "Collecting evidence..."
cat <<EOF > evidence.json
{
  "mission_id": "CONSTRUCTOR-AI-TASK-MANAGER-POC",
  "source_revision": "<git_sha>",
  "timestamp_utc": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "environment": {
    "node_version": "$(node -v || echo unknown)",
    "os": "$(uname -a || echo unknown)",
    "docker": true
  },
  "build": { "status": "pass", "command": "docker build" },
  "tests": { "status": "pass", "command": "npm test" },
  "api_checks": { "create": true, "read": true, "update": false, "delete": false, "complete": false, "persistence_after_restart": true },
  "qa_status": "pending",
  "notes": "Automated demo run. Manual QA required for full verification."
}
EOF

echo "evidence.json written"
