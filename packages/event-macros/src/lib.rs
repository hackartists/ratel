use proc_macro::TokenStream;
use quote::{format_ident, quote};
use syn::punctuated::Punctuated;
use syn::{Expr, ExprLit, FnArg, ItemFn, Lit, Meta, PatType, Token};

/// `#[event(service?, env?, data?, version?, key?)]`
///
/// Topic = `{env}.{service}.{data}.v{version}`. Defaults: `service`/`data` from
/// the handler name split on the first `_`; `env` from the `ENV` **runtime**
/// env var (`::event::runtime_env()`, fallback `dev`); `version` = 1.
///
/// - `server` feature ON  → keep the handler (so a stacked `#[post]` still runs)
///   and register an `EventConsumer`.
/// - `server` feature OFF → drop the handler + body, emit a same-named producer
///   client that publishes the payload.
///
/// `key = "field"` names a payload field whose stringified value becomes the
/// **Kafka message key** in the producer expansion (`::event::produce_keyed`):
/// same key → same partition → per-entity ordering on multi-partition topics.
/// Use the entity-scope id (dataroom_id / content_id / workspace_id / …); the
/// field must implement `ToString` (Uuid / String do). Without `key` the
/// producer publishes unkeyed (round-robin, no ordering guarantee). The
/// attribute is producer-side only — the consumer half ignores it — so a
/// producer-mode re-declaration MUST carry the same `key` as the owning
/// declaration to actually take effect.
///
/// The handler's payload argument must be a SIMPLE identifier (`req: SignupData`),
/// not a destructuring pattern, because the producer client reuses it both as a
/// parameter and as `&#arg_ident`.
///
/// The topic's `env` is read at RUNTIME from the process `ENV` env var
/// (`::event::runtime_env()`, cached per process), so builds need no `ENV`;
/// the producer process and the consumer process must RUN with the same `ENV`
/// to agree on the topic string.
#[proc_macro_attribute]
pub fn event(attr: TokenStream, item: TokenStream) -> TokenStream {
    let args = syn::parse_macro_input!(attr with Punctuated::<Meta, Token![,]>::parse_terminated);
    let func = syn::parse_macro_input!(item as ItemFn);

    let mut service_ov: Option<String> = None;
    let mut env_ov: Option<String> = None;
    let mut data_ov: Option<String> = None;
    let mut version: u32 = 1;
    let mut key_field: Option<syn::Ident> = None;

    for meta in &args {
        let Meta::NameValue(nv) = meta else {
            return err(meta, "expected `key = value` in #[event(...)]");
        };
        let Some(key) = nv.path.get_ident().map(|i| i.to_string()) else {
            return err(&nv.path, "expected an identifier key in #[event(...)]");
        };
        match key.as_str() {
            "service" => match lit_str(&nv.value) {
                Some(s) => service_ov = Some(s),
                None => return err(&nv.value, "`service` must be a string literal"),
            },
            "env" => match lit_str(&nv.value) {
                Some(s) => env_ov = Some(s),
                None => return err(&nv.value, "`env` must be a string literal"),
            },
            "data" => match lit_str(&nv.value) {
                Some(s) => data_ov = Some(s),
                None => return err(&nv.value, "`data` must be a string literal"),
            },
            "version" => match lit_u32(&nv.value) {
                Some(v) => version = v,
                None => return err(&nv.value, "`version` must be an unsigned integer literal"),
            },
            "key" => match lit_str(&nv.value) {
                // Parse (don't `format_ident!`) so an invalid identifier —
                // empty string, spaces, `a.b`, a keyword — becomes a proper
                // compile_error! at the attribute instead of a proc-macro
                // panic.
                Some(s) => match parse_key_ident(&s) {
                    Some(ident) => key_field = Some(ident),
                    None => {
                        return err(
                            &nv.value,
                            "`key` must be a valid field identifier (e.g. key = \"dataroom_id\")",
                        );
                    }
                },
                None => {
                    return err(
                        &nv.value,
                        "`key` must be a string literal naming a payload field",
                    );
                }
            },
            other => {
                return err(
                    &nv.path,
                    &format!(
                        "unknown #[event] key `{other}`; expected service, env, data, version, or key"
                    ),
                );
            }
        }
    }

    if func.sig.asyncness.is_none() {
        return err(&func.sig, "event handler must be `async`");
    }
    if func.sig.inputs.len() != 1 {
        return err(
            &func.sig,
            "event handler must take exactly one payload argument",
        );
    }

    let ident = func.sig.ident.clone();
    let name = ident.to_string();

    let (service, data) = match (service_ov, data_ov) {
        (Some(s), Some(d)) => (s, d),
        (s_ov, d_ov) => match name.split_once('_') {
            Some((s, d)) => (
                s_ov.unwrap_or_else(|| s.to_string()),
                d_ov.unwrap_or_else(|| d.to_string()),
            ),
            None => {
                return syn::Error::new_spanned(
                    &func.sig.ident,
                    "event handler name must be `{service}_{event}`, or set `service`/`data` explicitly",
                )
                .to_compile_error()
                .into();
            }
        },
    };

    // Single payload argument: `req: PayloadType`.
    let (arg_ident, payload_ty) = match func.sig.inputs.first() {
        Some(FnArg::Typed(PatType { pat, ty, .. })) => (pat.clone(), ty.clone()),
        _ => {
            return err(
                &func.sig,
                "event handler needs exactly one payload argument",
            );
        }
    };

    // The producer client reuses the arg both as a parameter and as `&#arg_ident`,
    // so it must be a plain identifier, not a destructuring pattern.
    if !matches!(&*arg_ident, syn::Pat::Ident(_)) {
        return err(
            &arg_ident,
            "event handler's payload argument must be a simple identifier (e.g. `req: T`), not a pattern",
        );
    }

    let vis = func.vis.clone();
    let topic_fn = format_ident!("__{}_topic", ident);
    let dispatch_fn = format_ident!("__{}_dispatch", ident);

    let env_expr = match env_ov {
        Some(e) => quote! { #e },
        None => quote! { ::event::runtime_env() },
    };

    // Producer body: keyed publish when `key = "field"` is given, plain
    // publish otherwise. The key is already validated as an identifier at
    // attribute parse time; a field that doesn't exist on the payload fails
    // at compile time in the invoking crate (the expansion references
    // `payload.field`).
    let produce_expr = match &key_field {
        Some(field_ident) => {
            quote! {
                ::event::produce_keyed(
                    &#topic_fn(),
                    &::std::string::ToString::to_string(&#arg_ident.#field_ident),
                    &#arg_ident,
                )
                .await
            }
        }
        None => quote! { ::event::produce(&#topic_fn(), &#arg_ident).await },
    };

    let expanded = quote! {
        fn #topic_fn() -> ::std::string::String {
            ::std::format!("{}.{}.{}.v{}", #env_expr, #service, #data, #version)
        }

        #[cfg(feature = "server")]
        #func

        #[cfg(feature = "server")]
        fn #dispatch_fn(
            bytes: ::std::vec::Vec<u8>,
        ) -> ::event::BoxFuture<'static, ::std::result::Result<(), ::event::Error>> {
            ::event::boxed(async move {
                let payload: #payload_ty = ::event::from_slice(&bytes)?;
                #ident(payload)
                    .await
                    .map_err(|e| ::event::Error::Handler(::std::string::ToString::to_string(&e)))
            })
        }

        #[cfg(feature = "server")]
        ::event::inventory::submit! {
            ::event::EventConsumer { topic: #topic_fn, dispatch: #dispatch_fn }
        }

        #[cfg(not(feature = "server"))]
        #vis async fn #ident(#arg_ident: #payload_ty) -> ::std::result::Result<(), ::event::Error> {
            #produce_expr
        }
    };

    expanded.into()
}

/// Emit a compile error at `tokens`' span with `msg`.
fn err(tokens: impl quote::ToTokens, msg: &str) -> TokenStream {
    syn::Error::new_spanned(tokens, msg)
        .to_compile_error()
        .into()
}

fn lit_str(expr: &Expr) -> Option<String> {
    if let Expr::Lit(ExprLit {
        lit: Lit::Str(s), ..
    }) = expr
    {
        Some(s.value())
    } else {
        None
    }
}

fn lit_u32(expr: &Expr) -> Option<u32> {
    if let Expr::Lit(ExprLit {
        lit: Lit::Int(i), ..
    }) = expr
    {
        i.base10_parse::<u32>().ok()
    } else {
        None
    }
}

/// Validate a `key = "…"` value as a Rust field identifier. `None` (empty
/// string, whitespace, paths like `a.b`, keywords, leading digits) becomes a
/// `compile_error!` at the attribute — never a proc-macro panic. Split out of
/// the attribute loop so it is unit-testable.
fn parse_key_ident(s: &str) -> Option<syn::Ident> {
    syn::parse_str::<syn::Ident>(s).ok()
}

#[cfg(test)]
mod tests {
    use super::parse_key_ident;

    #[test]
    fn valid_field_identifiers_parse() {
        for ok in ["dataroom_id", "content_id", "to", "workspace_id", "_x1"] {
            assert!(parse_key_ident(ok).is_some(), "should accept {ok:?}");
        }
    }

    #[test]
    fn invalid_field_identifiers_are_rejected() {
        // Each of these would have panicked `format_ident!` (or produced a
        // nonsense expansion); they must be rejected so the macro emits a
        // compile_error! instead.
        for bad in ["", " ", "a b", "a.b", "1abc", "fn", "req.dataroom_id"] {
            assert!(parse_key_ident(bad).is_none(), "should reject {bad:?}");
        }
    }
}
