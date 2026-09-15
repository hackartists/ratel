// API server. The web UI is the React app in apps/web; client builds of this
// crate (`tauri-web`) only exist to generate the TypeScript API client.
fn main() {
    #[cfg(feature = "server")]
    app_shell::common::run();
}
