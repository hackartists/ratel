//! TypeScript client manifests for the React app
//! (docs/superpower/2026-09-14-react-frontend-migration.md §4.2).
//!
//! Only when `TS_SERVER_FN_PACKAGE_DIR` is set while the route macros expand,
//! each handler writes `<dir>/.gen/handlers/<METHOD>_<path>.json` describing
//! its client surface: method, path template, path/query/body arguments with
//! TypeScript types, and the `Result<T>` payload type. The macro's token
//! output is unchanged either way. `packages/ts-bridges/scripts/gen-handlers.mjs`
//! turns the manifests into `src/handlers/*.ts`.

use std::collections::BTreeSet;
use std::path::PathBuf;

use proc_macro2::TokenStream as TokenStream2;
use quote::{ToTokens, quote};
use syn::{GenericArgument, Ident, PathArguments, ReturnType, Type};

pub const ENV_DIR: &str = "TS_SERVER_FN_PACKAGE_DIR";

pub struct Handler<'a> {
    pub method: &'a str,
    pub path: &'a str,
    pub name: String,
    pub args: &'a [(&'a Ident, &'a Type)],
    pub path_args: &'a [String],
    pub query_args: &'a [String],
    pub body_arg: Option<String>,
    pub output: &'a ReturnType,
}

/// Writes the manifest when the env var is set. Returns a `compile_error!`
/// when it can't, so a generation run never silently misses a handler.
pub fn emit(handler: Handler<'_>) -> TokenStream2 {
    let Ok(dir) = std::env::var(ENV_DIR) else {
        return TokenStream2::new();
    };
    let mut mapper = Mapper::default();
    let arg_type = |mapper: &mut Mapper, name: &str| {
        handler
            .args
            .iter()
            .find(|(ident, _)| *ident == name)
            .map(|(_, ty)| (mapper.map(ty), super::is_option_type(ty)))
    };

    let path_args: Vec<_> = handler
        .path_args
        .iter()
        .filter_map(|name| {
            let (ts, _) = arg_type(&mut mapper, name)?;
            Some(serde_json::json!({ "name": name, "ts": ts }))
        })
        .collect();
    let query_args: Vec<_> = handler
        .query_args
        .iter()
        .filter_map(|name| {
            let (ts, optional) = arg_type(&mut mapper, name)?;
            Some(serde_json::json!({ "name": name, "ts": ts, "optional": optional }))
        })
        .collect();
    let body = handler.body_arg.as_deref().and_then(|name| {
        let (ts, _) = arg_type(&mut mapper, name)?;
        Some(serde_json::json!({ "name": name, "ts": ts }))
    });
    let returns = match handler.output {
        ReturnType::Default => "null".to_string(),
        ReturnType::Type(_, ty) => mapper.map(ty),
    };

    let manifest = serde_json::json!({
        "name": handler.name,
        "method": handler.method,
        "path": normalize_path(handler.path),
        "pathArgs": path_args,
        "queryArgs": query_args,
        "body": body,
        "returns": returns,
        "refs": mapper.refs,
        "unmapped": mapper.unmapped,
    });

    let slug: String = normalize_path(handler.path)
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '_' })
        .collect();
    let file = PathBuf::from(dir)
        .join(".gen/handlers")
        .join(format!("{}{}.json", handler.method, slug));
    let content = serde_json::to_string_pretty(&manifest).expect("manifest serializes") + "\n";

    let result = file
        .parent()
        .map(std::fs::create_dir_all)
        .transpose()
        .and_then(|_| {
            if std::fs::read_to_string(&file).is_ok_and(|current| current == content) {
                Ok(())
            } else {
                std::fs::write(&file, content)
            }
        });
    match result {
        Ok(()) => TokenStream2::new(),
        Err(e) => {
            let msg = format!("{ENV_DIR}: cannot write {}: {e}", file.display());
            quote! { compile_error!(#msg); }
        }
    }
}

/// `/api/posts/:post_id?bookmark` → `/api/posts/{post_id}` (query dropped;
/// the query argument list carries it).
fn normalize_path(path: &str) -> String {
    let path = path.split('?').next().unwrap_or(path);
    path.split('/')
        .map(|seg| match seg.strip_prefix(':') {
            Some(name) => format!("{{{name}}}"),
            None => seg.to_string(),
        })
        .collect::<Vec<_>>()
        .join("/")
}

#[derive(Default)]
struct Mapper {
    /// Named types the TS side must import from `../types`.
    refs: BTreeSet<String>,
    /// Types with no TS mapping, emitted as `unknown` and reported.
    unmapped: BTreeSet<String>,
}

impl Mapper {
    fn map(&mut self, ty: &Type) -> String {
        match ty {
            Type::Reference(r) => self.map(&r.elem),
            Type::Paren(p) => self.map(&p.elem),
            Type::Group(g) => self.map(&g.elem),
            // `()` serializes as JSON `null`.
            Type::Tuple(t) if t.elems.is_empty() => "null".to_string(),
            Type::Tuple(t) => {
                let items: Vec<_> = t.elems.iter().map(|e| self.map(e)).collect();
                format!("[{}]", items.join(", "))
            }
            Type::Slice(s) => array_of(self.map(&s.elem)),
            Type::Array(a) => array_of(self.map(&a.elem)),
            Type::Path(tp) if tp.qself.is_none() => self.map_path(&tp.path),
            other => {
                self.unmapped.insert(other.to_token_stream().to_string());
                "unknown".to_string()
            }
        }
    }

    fn map_path(&mut self, path: &syn::Path) -> String {
        let Some(seg) = path.segments.last() else {
            return "unknown".to_string();
        };
        let name = seg.ident.to_string();
        let args: Vec<&Type> = match &seg.arguments {
            PathArguments::AngleBracketed(a) => a
                .args
                .iter()
                .filter_map(|g| match g {
                    GenericArgument::Type(t) => Some(t),
                    _ => None,
                })
                .collect(),
            _ => Vec::new(),
        };
        let arg = |mapper: &mut Mapper, i: usize| match args.get(i) {
            Some(t) => mapper.map(t),
            None => "unknown".to_string(),
        };

        match name.as_str() {
            "String" | "str" | "char" | "Uuid" => "string".to_string(),
            "bool" => "boolean".to_string(),
            "i8" | "i16" | "i32" | "i64" | "i128" | "isize" | "u8" | "u16" | "u32" | "u64" | "u128"
            | "usize" | "f32" | "f64" => "number".to_string(),
            "Option" => format!("{} | null", arg(self, 0)),
            "Vec" | "VecDeque" | "HashSet" | "BTreeSet" | "IndexSet" => array_of(arg(self, 0)),
            "HashMap" | "BTreeMap" | "IndexMap" => format!("Record<string, {}>", arg(self, 1)),
            "Box" | "Arc" | "Rc" | "Form" | "Json" => arg(self, 0),
            // `Result<T>` / `Result<T, E>`: the client resolves to `T`.
            "Result" => arg(self, 0),
            "Value" => "unknown".to_string(),
            // SubPartition ids serialize as their prefix-less string.
            n if n == "Partition" || n == "EntityType" || n.ends_with("Partition") || n.ends_with("EntityType") => {
                "string".to_string()
            }
            _ => {
                self.refs.insert(name.clone());
                if args.is_empty() {
                    name
                } else {
                    let mapped: Vec<_> = (0..args.len()).map(|i| arg(self, i)).collect();
                    format!("{name}<{}>", mapped.join(", "))
                }
            }
        }
    }
}

fn array_of(inner: String) -> String {
    if inner.contains(' ') { format!("({inner})[]") } else { format!("{inner}[]") }
}
