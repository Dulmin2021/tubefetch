#!/bin/bash

echo "🔍 TubeFetch Verification"
echo "========================"

# Check backend
echo -n "Backend health check... "
if curl -s http://localhost:3001/health > /dev/null; then
    echo "✅ PASS"
else
    echo "❌ FAIL"
fi

# Check Docker
echo -n "Docker running... "
if docker ps | grep tubefetch > /dev/null; then
    echo "✅ PASS"
else
    echo "❌ FAIL"
fi

# Check yt-dlp
echo -n "yt-dlp installed... "
if command -v yt-dlp &> /dev/null; then
    echo "✅ PASS"
else
    echo "❌ FAIL"
fi

echo "========================"
echo "Done!"
