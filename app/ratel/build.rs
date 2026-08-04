use std::path::Path;
use std::process::Command;

fn main() {
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
    let manifest_path = Path::new(&manifest_dir);
    let js_dir = manifest_path.join("js");
    let assets_dir = manifest_path.join("assets");

    let status = Command::new("npm")
        .args(["install"])
        .current_dir(&js_dir)
        .status()
        .expect("failed to run npm install");
    assert!(status.success(), "npm install for ratel/common failed");

    let status = Command::new("npm")
        .args(["run", "build"])
        .env("ASSETS_DIR", &assets_dir)
        .current_dir(&js_dir)
        .status()
        .expect("failed to run npm build");
    assert!(status.success(), "npm build for ratel/common failed");

    println!("cargo:rerun-if-changed={}", "build.rs");
    println!("cargo:rerun-if-changed={}", js_dir.join("src").display());

    // The generated bundles (one `assets/<name>.js` per `js/src/<name>/`
    // directory — mirrors vite.config.ts) live in the SOURCE tree, are
    // gitignored, and CI's checkout clean wipes them on every run. A restored
    // `target/` cache then marks this script fresh, so without declaring the
    // OUTPUTS cargo skips it and the `asset!()` macros fail with "Asset ...
    // doesn't exist" (dev-deploy run 30915117611). Cargo reruns the script
    // whenever a rerun-if-changed path is MISSING, which is exactly the
    // self-heal we need — but cargo stamps the fingerprint BEFORE running the
    // script, so a freshly written bundle would look "newer" and retrigger
    // the script (and an app-shell recompile) on every build. Resetting each
    // bundle's mtime to the epoch after the vite build gives the intended
    // semantics: present ⇒ fresh, deleted ⇒ rerun. (Content, not mtime, is
    // what dx/manganis hashes, so the epoch mtime is otherwise inert.)
    for entry in std::fs::read_dir(js_dir.join("src")).expect("failed to read js/src") {
        let entry = entry.expect("failed to read js/src entry");
        if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            let bundle = assets_dir.join(format!("{}.js", entry.file_name().display()));
            let f = std::fs::File::options()
                .write(true)
                .open(&bundle)
                .unwrap_or_else(|e| panic!("generated bundle {} missing: {e}", bundle.display()));
            f.set_modified(std::time::SystemTime::UNIX_EPOCH)
                .expect("failed to reset bundle mtime");
            println!("cargo:rerun-if-changed={}", bundle.display());
        }
    }

    // `option_env!()` across the app reads these at compile time. Without
    // `rerun-if-env-changed`, cargo caches stale values into the binary even
    // when the env vars change between builds — so re-running the build with new
    // values (e.g. PORTONE keys, MOBILE_API_URL) silently keeps the OLD/empty
    // baked value. Declare EVERY compile-time env var the app reads via
    // `option_env!` so any change triggers a rebuild.
    //
    // Keep in sync with: `grep -rhoE 'option_env!\("[A-Z_]+"\)' src`.
    for var in [
        "ENV",
        "MOBILE_API_URL",
        "RUST_LOG",
        "PORT",
        "DYNAMO_TABLE_PREFIX",
        "DYNAMODB_ENDPOINT",
        "AWS_ACCESS_KEY_ID",
        "AWS_SECRET_ACCESS_KEY",
        "AWS_REGION",
        "ACCOUNT_ID",
        "PORTONE_STORE_ID",
        "PORTONE_INICIS_CHANNEL_KEY",
        "PORTONE_KPN_CHANNEL_KEY",
        "PORTONE_API_SECRET",
        "FIREBASE_API_KEY",
        "FIREBASE_APP_ID",
        "FIREBASE_AUTH_DOMAIN",
        "FIREBASE_MEASUREMENT_ID",
        "FIREBASE_MESSAGING_SENDER_ID",
        "FIREBASE_PROJECT_ID",
        "FIREBASE_STORAGE_BUCKET",
        "KAIA_ENDPOINT",
        "BLOCK_EXPLORER_URL",
        "IC_URL",
        "RATEL_CANISTER_ID",
        "ICP_IDENTITY_PEM",
        "VOTER_TAG_SECRET",
        "ATTR_VOTING_AUTHORITY_JSON",
        "QDRANT_URL",
        "QDRANT_API_KEY",
        "QDRANT_PREFIX",
        "BUCKET_NAME",
        "BUCKET_EXPIRE",
        "DISABLE_ANSI",
        "LINKEDIN_CLIENT_ID",
        "LINKEDIN_CLIENT_SECRET",
        "LAUNCHPAD_BASE_URL",
        "LAUNCHPAD_PARTNER_SECRET",
        "LAUNCHPAD_POINT_SYMBOL",
        "LAUNCHPAD_PROJECT_ID",
        "BEDROCK_KNOWLEDGE_BASE_ID",
        "BEDROCK_MODEL_ID",
        "CROSS_POSTING_DATA_KEY",
        "CROSS_POSTING_DATA_KEY_PREVIOUS",
        "TELEGRAM_TOKEN",
        "WALLETCONNECT_PROJECT_ID",
        "ASSET_DIR",
    ] {
        println!("cargo:rerun-if-env-changed={var}");
    }
}
