#!/bin/bash
# ProjectOps360 — Supabase CLI Setup Script
# Run this on your LOCAL machine (not in Cowork sandbox)
# Requires: Supabase CLI installed (https://supabase.com/docs/guides/cli/getting-started)

set -e

echo "=== ProjectOps360 Supabase Setup ==="

# Step 1: Login (you'll need your Personal Access Token from https://supabase.com/dashboard/account/tokens)
echo ""
echo "Step 1: Login to Supabase"
echo "Get your token at: https://supabase.com/dashboard/account/tokens"
supabase login

# Step 2: Init (creates supabase/ folder with config)
echo ""
echo "Step 2: Initialize Supabase config in this project"
supabase init

# Step 3: Link to your remote project
echo ""
echo "Step 3: Link to remote project ocopmlnkvidvmxgiwvxw"
supabase link --project-ref ocopmlnkvidvmxgiwvxw

echo ""
echo "Done! Your project is linked to Supabase."
echo "You can now run: supabase db pull   (to pull existing schema)"
echo "               supabase db push    (to push local migrations)"
