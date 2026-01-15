#!/bin/bash

export DATABASE_URL="postgresql://neondb_owner:npg_kU0ZuBOcHR6j@ep-quiet-king-ahb6gd7v-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
export SESSION_SECRET=dsgflgfsduhgsfdouhigf
export NODE_ENV=production
export PORT=7000

echo "Starting Eden Hangwa..."
npm run start



