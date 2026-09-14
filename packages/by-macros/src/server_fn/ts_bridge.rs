//! TypeScript client manifests for the React app
//! (docs/superpower/2026-09-14-react-frontend-migration.md §4.2).
//!
//! Each route macro also emits a test, compiled only under
//! `cfg(all(test, feature = "ts-bridge"))`, so every other build is
//! unaffected. When `TS_SERVER_FN_PACKAGE_DIR` is set, the test writes
//! `<dir>/.gen/handlers/<METHOD>_<path>.json` with the handler's client
//! surface: method, path template, path/query/body arguments and the
//! `Result<T>` payload. Types come from ts-rs at runtime (`TS::name()` and the
//! export path of every named type), so same-named Rust types in different
//! modules, renames and generics (`ListResponse<TeamItem>`) resolve exactly.
//! `packages/ts-bridges/scripts/gen-handlers.mjs` renders the manifests into
//! `src/handlers/*.ts`.

use proc_macro2::TokenStream as TokenStream2;
use quote::{format_ident, quote};
use syn::{GenericArgument, Ident, PathArguments, ReturnType, Type};

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

pub fn emit(handler: Handler<'_>) -> TokenStream2 {
    let arg = |name: &str| handler.args.iter().find(|(ident, _)| *ident == name).map(|(_, ty)| *ty);

    let path_entries: Vec<TokenStream2> = handler
        .path_args
        .iter()
        .filter_map(|name| {
            let ty = client_type(arg(name)?);
            Some(quote! { ::serde_json::json!({ "name": #name, "ts": __ty::<#ty>(&mut __refs) }) })
        })
        .collect();

    let query_entries: Vec<TokenStream2> = handler
        .query_args
        .iter()
        .filter_map(|name| {
            let original = arg(name)?;
            let optional = super::is_option_type(original);
            let ty = client_type(original);
            Some(quote! {
                ::serde_json::json!({ "name": #name, "ts": __ty::<#ty>(&mut __refs), "optional": #optional })
            })
        })
        .collect();

    let body = match handler.body_arg.as_deref().and_then(|name| Some((name, arg(name)?))) {
        Some((name, ty)) => {
            let ty = client_type(ty);
            quote! { ::serde_json::json!({ "name": #name, "ts": __ty::<#ty>(&mut __refs) }) }
        }
        None => quote! { ::serde_json::Value::Null },
    };

    let returns = match handler.output {
        ReturnType::Default => quote! { ::std::string::String::from("null") },
        ReturnType::Type(_, ty) => {
            let ty = result_payload(ty);
            quote! { __ty::<#ty>(&mut __refs) }
        }
    };

    let method = handler.method;
    let path = normalize_path(handler.path);
    let fn_name = &handler.name;
    let slug: String = path.chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '_' }).collect();
    let file_name = format!("{method}{slug}.json");
    let test_name = format_ident!("ts_bridge_manifest_{}", handler.name);

    quote! {
        #[cfg(all(test, feature = "ts-bridge"))]
        #[test]
        fn #test_name() {
            let ::std::result::Result::Ok(__dir) = ::std::env::var("TS_SERVER_FN_PACKAGE_DIR") else {
                return;
            };

            /// Named (exported) types the TS client must import: name → export path.
            struct __Refs(::std::collections::BTreeMap<::std::string::String, ::std::string::String>);
            impl ::ts_rs::TypeVisitor for __Refs {
                fn visit<T: ::ts_rs::TS + 'static + ?Sized>(&mut self) {
                    if let ::std::option::Option::Some(dep) = ::ts_rs::Dependency::from_ty::<T>() {
                        self.0.insert(dep.ts_name, dep.output_path.to_string_lossy().into_owned());
                    }
                }
            }
            fn __ty<T: ::ts_rs::TS + 'static + ?Sized>(refs: &mut __Refs) -> ::std::string::String {
                ::ts_rs::TypeVisitor::visit::<T>(refs);
                <T as ::ts_rs::TS>::visit_generics(refs);
                <T as ::ts_rs::TS>::name()
            }

            let mut __refs = __Refs(::std::collections::BTreeMap::new());
            let path_args: ::std::vec::Vec<::serde_json::Value> = ::std::vec![#(#path_entries),*];
            let query_args: ::std::vec::Vec<::serde_json::Value> = ::std::vec![#(#query_entries),*];
            let body = #body;
            let returns = #returns;
            let refs: ::std::vec::Vec<::serde_json::Value> = __refs
                .0
                .into_iter()
                .map(|(name, path)| ::serde_json::json!({ "name": name, "path": path }))
                .collect();

            let manifest = ::serde_json::json!({
                "name": #fn_name,
                "method": #method,
                "path": #path,
                "pathArgs": path_args,
                "queryArgs": query_args,
                "body": body,
                "returns": returns,
                "refs": refs,
            });

            let dir = ::std::path::Path::new(&__dir).join(".gen/handlers");
            ::std::fs::create_dir_all(&dir).expect("create manifest dir");
            ::std::fs::write(
                dir.join(#file_name),
                ::serde_json::to_string_pretty(&manifest).expect("serialize manifest") + "\n",
            )
            .expect("write manifest");
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

/// The type the client sends: `Form<T>` → `T`, references stripped.
fn client_type(ty: &Type) -> Type {
    match ty {
        Type::Reference(r) => client_type(&r.elem),
        _ => super::unwrap_form_type(ty).unwrap_or_else(|| ty.clone()),
    }
}

/// `Result<T>` / `Result<T, E>` → `T`; any other return type as-is.
fn result_payload(ty: &Type) -> Type {
    if let Type::Path(tp) = ty {
        if let Some(seg) = tp.path.segments.last() {
            if seg.ident == "Result" {
                if let PathArguments::AngleBracketed(args) = &seg.arguments {
                    if let Some(GenericArgument::Type(inner)) = args.args.first() {
                        return inner.clone();
                    }
                }
            }
        }
    }
    ty.clone()
}
