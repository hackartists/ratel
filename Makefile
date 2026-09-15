ENV ?= dev
BASE_DOMAIN ?= ratel.foundation
DOMAIN ?= $(ENV).$(BASE_DOMAIN)
COMMIT ?= $(shell git rev-parse --short HEAD)

ACCESS_KEY_ID ?= $(shell aws configure get aws_access_key_id $(AWS_FLAG))
SECRET_ACCESS_KEY ?= $(shell aws configure get aws_secret_access_key $(AWS_FLAG))
REGION ?= $(shell aws configure get region)
WORKSPACE_ROOT ?= $(PWD)
AWS_ACCOUNT_ID ?= $(shell aws sts get-caller-identity --query "Account" --output text)

.build/evm-keys:
	mkdir -p .build
	docker run --rm ghcr.io/foundry-rs/foundry:latest "cast wallet new --json" > .build/evm-keys.json

run: .build/evm-keys
	COMMIT=${COMMIT} docker compose --profile development up -d --remove-orphans

stop:
	docker compose --profile development down --remove-orphans

# Full local stack in Docker (web + API + infra + seed data); no Rust/Node on
# the host. See docs/local-docker.md.
.PHONY: local local-down local-logs local-status local-reset
local:
	bash scripts/local-stack.sh up

local-down:
	bash scripts/local-stack.sh down

local-logs:
	bash scripts/local-stack.sh logs

local-status:
	bash scripts/local-stack.sh status

local-reset:
	bash scripts/local-stack.sh reset

# Build the mobile app and launch it on an Android emulator / iOS Simulator.
#   make android                                          # API: dev
#   MOBILE_API_ENDPOINT=http://localhost:8080 make ios    # API: `make local`
# Run `ratel_envs` first for Firebase/PortOne keys. See docs/local-docker.md.
MOBILE_API_ENDPOINT ?= https://dev.ratel.foundation
.PHONY: android ios
android:
	MOBILE_API_ENDPOINT="$(MOBILE_API_ENDPOINT)" bash scripts/mobile-run.sh android

ios:
	MOBILE_API_ENDPOINT="$(MOBILE_API_ENDPOINT)" bash scripts/mobile-run.sh ios

serve:
	cd packages/$(SERVICE) && make serve

clean:
	rm -rf .build/$(SERVICE)

node_modules:
	pnpm i

infra: .build/evm-keys
	docker compose --profile infra up -d --remove-orphans

# ── Local Lambda-handler test drivers ─────────────────────────────
# Bypass EventBridge — call the analysis handlers directly against
# the AWS DynamoDB table whose prefix matches `ratel-$(ENV)`.
# Usage:
#   ENV=victor SPACE=<uuid> REPORT=<uuid> make test-analyze-report
#   ENV=victor SPACE=<uuid> REPORT=<uuid> DISCUSSION=<discussion_id>#<request_uuid> make test-analyze-discussion
#
# `option_env!` in `aws_config.rs` captures credentials at compile time,
# so any change to ENV / region / keys requires re-touching the
# config file to force a rebuild — handled below.
TEST_ANALYZE_ENV = \
	DYNAMO_TABLE_PREFIX=ratel-$(ENV) \
	AWS_REGION=$(REGION) \
	AWS_ACCESS_KEY_ID=$(ACCESS_KEY_ID) \
	AWS_SECRET_ACCESS_KEY=$(SECRET_ACCESS_KEY) \
	RUST_LOG=$${RUST_LOG:-info}

.PHONY: test-analyze-report test-analyze-discussion run-pending-discussions

# Drain InProgress discussion-analysis rows for a space. Same effect
# as the discussion Lambda waking up. Optionally narrow by REPORT.
#
# Usage:
#   ENV=victor SPACE=<uuid> make run-pending-discussions
#   ENV=victor SPACE=<uuid> REPORT=<report_id> make run-pending-discussions
run-pending-discussions:
	@test -n "$(SPACE)" || (echo "SPACE=<space_uuid> required"; exit 1)
	@touch app/ratel/src/common/config/server/aws_config.rs
	cd app/ratel && $(TEST_ANALYZE_ENV) \
		cargo run --bin run_pending_discussions --features server -- \
		$(SPACE) $(if $(REPORT),--report $(REPORT))

test-analyze-report:
	@test -n "$(SPACE)" || (echo "SPACE=<space_uuid> required"; exit 1)
	@test -n "$(REPORT)" || (echo "REPORT=<report_id> required"; exit 1)
	@touch app/ratel/src/common/config/server/aws_config.rs
	cd app/ratel && $(TEST_ANALYZE_ENV) \
		cargo run --bin test_analyze_report --features server -- \
		$(SPACE) $(REPORT)

test-analyze-discussion:
	@test -n "$(SPACE)" || (echo "SPACE=<space_uuid> required"; exit 1)
	@test -n "$(REPORT)" || (echo "REPORT=<report_id> required"; exit 1)
	@test -n "$(DISCUSSION)" || (echo 'DISCUSSION=<discussion_id>#<request_uuid> required'; exit 1)
	@touch app/ratel/src/common/config/server/aws_config.rs
	cd app/ratel && $(TEST_ANALYZE_ENV) \
		cargo run --bin test_analyze_discussion --features server -- \
		$(SPACE) $(REPORT) $(DISCUSSION)

# Brings up app-shell-testing (API) + web-testing (React static build,
# localhost:4173) + their infra. Point Playwright's PLAYWRIGHT_BASE_URL at
# http://localhost:4173 to exercise the same web/app-shell split the
# in-cluster ingress does (deploy/pr-preview/35-web.yaml,
# docs/superpower/2026-09-14-react-frontend-migration.md § 5.1).
testing: .build/evm-keys
	COMMIT=$(COMMIT) RESET_DB=true docker compose --profile testing up -d --remove-orphans

clean-infra:
	docker compose --profile infra down

pr-testing:
	scripts/pr-testing-playwright.sh

# ── DynamoDB → Postgres migration (ETL) ──────────────────────────────────
# One-shot data migration: DynamoDB point-in-time export (S3) → all-items.ndjson
# → etl_migrate (creates schema, then loads every item). Identity is a
# deterministic uuid_v5 of pk/sk, so the load UPSERTs — re-running any step is
# idempotent and safe.
#
# Typical run (against an export dir that already exists):
#   make migrate DB=ratel-dev                     # build + create db + load
#   make migrate DB=ratel PG_HOST=127.0.0.1 PG_PORT=55432   # local compose pg
#
# Fresh export from prod DynamoDB (only when you need newer data):
#   make migrate-export                           # 1. kick off PITR export → prints ExportArn
#   aws dynamodb describe-export --export-arn <arn> --query ExportDescription.ExportStatus
#   make migrate-fetch EXPORT_ID=<id>             # 2. download S3 + assemble ndjson
#   make migrate DB=ratel-dev                     # 3. load
#
# Postgres target is chosen by PG_HOST/PG_PORT + DB:
#   cluster (needs VPN):  PG_HOST=postgres.infra.svc.cluster.local PG_PORT=5432   (default)
#   local compose:        PG_HOST=127.0.0.1 PG_PORT=55432
# If psql isn't on PATH:  PSQL=/opt/homebrew/opt/postgresql@14/bin/psql

MIG_TABLE_ARN  ?= arn:aws:dynamodb:ap-northeast-2:385474633683:table/ratel-prod-main
MIG_S3_BUCKET  ?= ratel-prod-dynamo-export
MIG_EXPORT_DIR ?= ratel-prod-export
MIG_NDJSON     ?= $(MIG_EXPORT_DIR)/all-items.ndjson

PG_HOST       ?= postgres.infra.svc.cluster.local
PG_PORT       ?= 5432
PG_SUPER_USER ?= asset
PG_SUPER_PASS ?= asset
PG_APP_USER   ?= ratel
PG_APP_PASS   ?= ratel
DB            ?= ratel-migration        # safe rehearsal target; set DB=ratel (prod) / ratel-dev

PSQL          ?= psql
ETL_BIN       ?= target/debug/etl_migrate
MIG_RUST_LOG  ?= warn
MIG_APP_DSN    = postgres://$(PG_APP_USER):$(PG_APP_PASS)@$(PG_HOST):$(PG_PORT)/$(DB)
MIG_SUPER_DSN  = postgres://$(PG_SUPER_USER):$(PG_SUPER_PASS)@$(PG_HOST):$(PG_PORT)/postgres

.PHONY: migrate migrate-export migrate-fetch migrate-build migrate-db migrate-load migrate-dry-run migrate-verify

# The common path: build the ETL, create the target db, load the data.
# Assumes $(MIG_NDJSON) already exists (reuse an export, or run export+fetch).
migrate: migrate-build migrate-db migrate-load
	@echo "✅ migration into '$(DB)' complete"

# 1. Kick off a point-in-time export of the prod table to S3 (async). Prints
#    the ExportArn — poll `aws dynamodb describe-export --export-arn <arn>`
#    until ExportStatus=COMPLETED before running migrate-fetch.
migrate-export:
	aws dynamodb export-table-to-point-in-time \
		--table-arn $(MIG_TABLE_ARN) \
		--s3-bucket $(MIG_S3_BUCKET) \
		--export-format DYNAMODB_JSON \
		--query 'ExportDescription.ExportArn' --output text

# 2. Download a finished export and assemble it into one ndjson file.
#    EXPORT_ID = the folder under s3://$(MIG_S3_BUCKET)/AWSDynamoDB/
#    (trailing segment of the ExportArn; see `aws dynamodb list-exports`).
migrate-fetch:
	@test -n "$(EXPORT_ID)" || (echo "EXPORT_ID=<export-id> required (aws dynamodb list-exports --table-arn $(MIG_TABLE_ARN))"; exit 1)
	mkdir -p $(MIG_EXPORT_DIR)
	aws s3 sync s3://$(MIG_S3_BUCKET)/AWSDynamoDB/$(EXPORT_ID)/ $(MIG_EXPORT_DIR)/
	gunzip -kf $(MIG_EXPORT_DIR)/data/*.json.gz
	cat $(MIG_EXPORT_DIR)/data/*.json > $(MIG_NDJSON)
	@echo "assembled $$(wc -l < $(MIG_NDJSON)) items → $(MIG_NDJSON)"

# 3a. Build the ETL binary (needs the server feature for the PostgresEntity
#     models; DYNAMO_TABLE_PREFIX is only for the vestigial DynamoEntity derives).
migrate-build:
	cd app/ratel && DYNAMO_TABLE_PREFIX=ratel-dev cargo build --bin etl_migrate --features server

# 3b. Create the target database, owned by the app role (idempotent guard).
migrate-db:
	@PGPASSWORD=$(PG_SUPER_PASS) $(PSQL) "$(MIG_SUPER_DSN)" -tAc \
		"SELECT 1 FROM pg_database WHERE datname='$(DB)'" | grep -q 1 || \
	PGPASSWORD=$(PG_SUPER_PASS) $(PSQL) "$(MIG_SUPER_DSN)" -c \
		"CREATE DATABASE \"$(DB)\" OWNER $(PG_APP_USER)"
	@echo "database '$(DB)' ready (owner $(PG_APP_USER))"

# 3c. Run the ETL: migrate schema, then load every item (upsert on uuid_v5 id).
migrate-load:
	@test -f $(MIG_NDJSON) || (echo "$(MIG_NDJSON) not found — run migrate-export + migrate-fetch first"; exit 1)
	DATABASE_URL="$(MIG_APP_DSN)" RUST_LOG=$(MIG_RUST_LOG) $(ETL_BIN) $(MIG_NDJSON)

# Parse + map every item, print the count report, write NOTHING to the db.
migrate-dry-run: migrate-build
	@test -f $(MIG_NDJSON) || (echo "$(MIG_NDJSON) not found — run migrate-export + migrate-fetch first"; exit 1)
	DATABASE_URL="$(MIG_APP_DSN)" RUST_LOG=$(MIG_RUST_LOG) $(ETL_BIN) --dry-run $(MIG_NDJSON)

# Row-count sanity check on the target db (top tables by live rows).
migrate-verify:
	@PGPASSWORD=$(PG_APP_PASS) $(PSQL) "$(MIG_APP_DSN)" -c \
		"SELECT relname, n_live_tup FROM pg_stat_user_tables WHERE n_live_tup > 0 ORDER BY n_live_tup DESC LIMIT 40;"
