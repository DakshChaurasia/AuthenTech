#!/usr/bin/env bash
# Starts AuthenTech at http://localhost:8000
# Uses $AUTHENTECH_PY if set, else ./.venv, else python3 on the PATH.
set -e
cd "$(dirname "$0")/backend"
if [ -n "$AUTHENTECH_PY" ]; then PY="$AUTHENTECH_PY"
elif [ -x ../.venv/bin/python ]; then PY=../.venv/bin/python
else PY=python3; fi
exec "$PY" -m uvicorn main:app --port 8000
