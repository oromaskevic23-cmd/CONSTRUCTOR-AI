# Task Manager PoC - instructions

Do not modify README.md in the repository root. This folder contains PoC code and CI configuration for Task Manager.

Local validation steps:

1. Install dependencies
   npm ci

2. Run tests
   npm test

3. Build
   npm run build

4. Run locally
   DATABASE_PATH=./data/demo-db.sqlite npm run dev

5. Docker
   npm run docker:build
   npm run docker:run

6. Demo script
   bash scripts/demo.sh
