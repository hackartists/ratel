use dioxus::document::eval;

use crate::*;

pub async fn copy_text(text: &str) -> Result<()> {
    use wasm_bindgen_futures::JsFuture;

    let window = web_sys::window().ok_or(Error::OnlyWebFunction)?;
    let promise = window.navigator().clipboard().write_text(text);

    JsFuture::from(promise)
        .await
        .map_err(|_| Error::OnlyWebFunction)?;

    Ok(())
}

pub async fn invoke_with_args<ARG: serde::Serialize, T: serde::de::DeserializeOwned>(
    method: &str,
    args: ARG,
) -> Result<T> {
    let mut runner = eval(include_str!("web/invoke_with_args.js"));
    runner
        .send(serde_json::json!({
            "method": method,
            "args": args,
        }))
        .map_err(|e| {
            error!("Failed to send method {}: {}", method, e);
            Error::OnlyWebFunction
        })?;

    runner.recv::<T>().await.map_err(|e| {
        error!("Failed to invoke method {}: {}", method, e);
        Error::OnlyWebFunction
    })
}

/// Invoke a Tauri command directly via the WebView IPC
/// (`window.__TAURI_INTERNALS__.invoke`), bypassing the `window.ratel` JS
/// dispatch table. Used by the tauri-web HTTP transport to reach the native
/// `api_request` command (persistent reqwest cookie jar) so API calls don't go
/// through the in-WebView fetch, which iOS WKWebView strips the cross-site
/// session cookie from.
pub async fn invoke_tauri<ARG: serde::Serialize, T: serde::de::DeserializeOwned>(
    method: &str,
    args: ARG,
) -> Result<T> {
    let mut runner = eval(include_str!("web/invoke_tauri.js"));
    runner
        .send(serde_json::json!({
            "method": method,
            "args": args,
        }))
        .map_err(|e| {
            error!("Failed to send tauri invoke {}: {}", method, e);
            Error::OnlyWebFunction
        })?;

    runner.recv::<T>().await.map_err(|e| {
        error!("Failed tauri invoke {}: {}", method, e);
        Error::OnlyWebFunction
    })
}

/// Upload a file's bytes to a presigned S3 URL through the native
/// `s3_put_object` Tauri command. In the Tauri WebView a direct `fetch` PUT to
/// S3 is cross-origin (`tauri://localhost` → `s3.amazonaws.com`) and dies on
/// the CORS preflight (`403 Preflight response is not successful`); routing the
/// PUT through the app process (reqwest) avoids CORS entirely. The bytes are
/// base64-encoded because raw binary can't cross the JS invoke bridge. Keys are
/// camelCase per Tauri's JS→snake_case arg convention (`contentType` →
/// `content_type`, `bodyB64` → `body_b64`).
#[cfg(feature = "tauri-web")]
pub async fn s3_put_object_native(
    presigned_url: &str,
    content_type: &str,
    file: &web_sys::File,
) -> Result<()> {
    use base64::Engine;
    use wasm_bindgen_futures::JsFuture;

    #[derive(serde::Deserialize)]
    struct Resp {
        status: u16,
        #[allow(dead_code)]
        body: String,
    }

    let buf = JsFuture::from(file.array_buffer())
        .await
        .map_err(|_| Error::OnlyWebFunction)?;
    let bytes = js_sys::Uint8Array::new(&buf).to_vec();
    let body_b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);

    // Try the native `s3_put_object` command first. It only exists inside the
    // Tauri WebView (`window.__TAURI_INTERNALS__.invoke`); when this tauri-web
    // bundle is served in a plain browser — a mis-deployed web target, or a dev
    // preview — the invoke throws `Cannot read properties of undefined (reading
    // 'invoke')` and `invoke_tauri` returns `Err`. In that case fall back to a
    // direct presigned fetch PUT: a real browser has no `tauri://localhost` → S3
    // cross-origin problem, so the PUT works exactly like the pure-web build.
    //
    // Falling back on `Err` (bridge missing) rather than on a non-2xx status
    // keeps native S3 errors inside the Tauri app intact — a genuine 403/expired
    // presign there still surfaces as an error instead of a masked CORS failure.
    let invoke_result: Result<Resp> = invoke_tauri(
        "s3_put_object",
        serde_json::json!({
            "url": presigned_url,
            "contentType": content_type,
            "bodyB64": body_b64,
        }),
    )
    .await;

    let resp = match invoke_result {
        Ok(resp) => resp,
        Err(_) => {
            // No Tauri IPC bridge (running in a browser) — use fetch instead.
            return s3_put_object_fetch(presigned_url, content_type, file).await;
        }
    };

    if !(200..300).contains(&resp.status) {
        error!(
            "s3_put_object_native failed: {} {}",
            resp.status, resp.body
        );
        return Err(Error::OnlyWebFunction);
    }
    Ok(())
}

/// Browser fallback for `s3_put_object_native`: PUT the file straight to the
/// presigned S3 URL via `fetch`. Used when the tauri-web bundle runs in a real
/// browser (no Tauri IPC), where there is no `tauri://localhost` cross-origin
/// restriction and the presigned PUT succeeds directly.
#[cfg(feature = "tauri-web")]
async fn s3_put_object_fetch(
    presigned_url: &str,
    content_type: &str,
    file: &web_sys::File,
) -> Result<()> {
    use wasm_bindgen::JsCast;
    use wasm_bindgen_futures::JsFuture;

    let opts = web_sys::RequestInit::new();
    opts.set_method("PUT");
    opts.set_body(&wasm_bindgen::JsValue::from(file.clone()));

    let request = web_sys::Request::new_with_str_and_init(presigned_url, &opts).map_err(|e| {
        error!("s3_put_object_fetch: build request failed: {:?}", e);
        Error::OnlyWebFunction
    })?;
    if !content_type.is_empty() {
        let _ = request.headers().set("Content-Type", content_type);
    }

    let window = web_sys::window().ok_or(Error::OnlyWebFunction)?;
    let resp_value = JsFuture::from(window.fetch_with_request(&request))
        .await
        .map_err(|e| {
            error!("s3_put_object_fetch: fetch failed: {:?}", e);
            Error::OnlyWebFunction
        })?;
    let resp: web_sys::Response = resp_value.dyn_into().map_err(|_| Error::OnlyWebFunction)?;
    if !resp.ok() {
        error!("s3_put_object_fetch failed: {}", resp.status());
        return Err(Error::OnlyWebFunction);
    }
    Ok(())
}

pub async fn invoke_with_empty<T: serde::de::DeserializeOwned>(method: &str) -> Result<T> {
    let mut runner = eval(include_str!("web/invoke_with_args.js"));
    runner
        .send(serde_json::json!({
            "method": method,
        }))
        .map_err(|e| {
            error!("Failed to send method {}: {}", method, e);
            Error::OnlyWebFunction
        })?;
    runner.recv::<T>().await.map_err(|e| {
        error!("Failed to invoke method {}: {}", method, e);
        Error::OnlyWebFunction
    })
}
