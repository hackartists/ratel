use super::super::*;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateDaoResult {
    #[serde(rename = "daoAddress")]
    pub dao_address: String,
    #[serde(rename = "transactionHash")]
    pub transaction_hash: String,
}

#[derive(Debug, Clone)]
pub struct DaoWalletError {
    pub code: Option<String>,
    pub message: String,
}

impl std::fmt::Display for DaoWalletError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        if let Some(code) = &self.code {
            write!(f, "[{}] {}", code, self.message)
        } else {
            write!(f, "{}", self.message)
        }
    }
}

#[cfg(feature = "server")]
pub async fn create_dao(
    _admins: Vec<String>,
    _network: &str,
    _rpc_url: &str,
    _block_explorer_url: &str,
) -> std::result::Result<CreateDaoResult, DaoWalletError> {
    Err(DaoWalletError {
        code: Some("NOT_SUPPORTED".to_string()),
        message: "DAO creation is only available on web".to_string(),
    })
}

#[cfg(not(feature = "server"))]
fn format_js_error(err: crate::common::wasm_bindgen::JsValue) -> DaoWalletError {
    use crate::common::web_sys::js_sys::{JSON, Reflect};

    let code = if err.is_object() {
        Reflect::get(&err, &crate::common::wasm_bindgen::JsValue::from_str("code"))
            .ok()
            .and_then(|value| value.as_string())
    } else {
        None
    };

    let message = if let Some(msg) = err.as_string() {
        msg
    } else if err.is_object() {
        Reflect::get(&err, &crate::common::wasm_bindgen::JsValue::from_str("message"))
            .ok()
            .and_then(|value| value.as_string())
            .or_else(|| JSON::stringify(&err).ok().and_then(|v| v.as_string()))
            .unwrap_or_else(|| "Unknown error".to_string())
    } else {
        "Unknown error".to_string()
    };

    DaoWalletError { code, message }
}

#[cfg(feature = "server")]
fn format_js_error(_err: wasm_bindgen::JsValue) -> DaoWalletError {
    DaoWalletError {
        code: Some("NOT_SUPPORTED".to_string()),
        message: "DAO creation is only available on web".to_string(),
    }
}
