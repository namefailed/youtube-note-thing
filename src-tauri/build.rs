fn main() {
    embed_google_creds();
    tauri_build::build();
}

/// Compile the app's default Google OAuth client (id + secret) into the binary so
/// "Connect YouTube" works without each user registering their own. Values come
/// from a gitignored `../.env` (local dev) or process env (CI secrets) — never
/// from committed source. Blank if neither is set, in which case users must add
/// their own client in Settings. The secret only lives in the binary, not the JS
/// bundle or the repo (Google treats Desktop-app client secrets as non-confidential).
fn embed_google_creds() {
    use std::collections::HashMap;
    let keys = ["YTNT_GOOGLE_CLIENT_ID", "YTNT_GOOGLE_CLIENT_SECRET"];

    let mut from_file: HashMap<String, String> = HashMap::new();
    if let Ok(contents) = std::fs::read_to_string("../.env") {
        for line in contents.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            if let Some((k, v)) = line.split_once('=') {
                from_file.insert(k.trim().to_string(), v.trim().trim_matches('"').to_string());
            }
        }
    }

    for k in keys {
        // Process env (e.g. CI secrets) wins over the local .env file.
        let v = std::env::var(k)
            .ok()
            .filter(|s| !s.is_empty())
            .or_else(|| from_file.get(k).cloned())
            .unwrap_or_default();
        println!("cargo:rustc-env={k}={v}");
        println!("cargo:rerun-if-env-changed={k}");
    }
    println!("cargo:rerun-if-changed=../.env");
}
