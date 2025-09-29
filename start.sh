#!/bin/bash
set -e

echo "Starting Mechanicus CAD System..."

# Kill any existing processes
pkill -f "nodemon\|tsx\|vite" 2>/dev/null || true
sleep 2

# Start backend in background
echo "Starting backend server..."
npm run server &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Start frontend in background
echo "Starting frontend server..."
cd frontend
npm run dev -- --host 0.0.0.0 --port 5000 &
cd ..

# Wait for both to start
sleep 8

echo "Both servers started successfully"

# Keep script running - wait for any background job to finish
wait