//! Extracts every `translate!` block and `#[derive(Translate)]` enum from the
//! Dioxus app into i18n modules for the React app, in the apps/web i18n
//! convention (biyard/asset console): one co-located `*.i18n.tsx` module per
//! bundle exporting `i18n = { en, ko }` plus a typed `use<Name>I18n()` hook,
//! registered as a react-i18next namespace
//! (docs/superpower/2026-09-14-react-frontend-migration.md §7).
//!
//! - `translate! { PostDetailTranslate; ... }` in `features/posts/i18n.rs`
//!   → `generated/features/posts/post-detail.i18n.tsx`, namespace
//!   `postDetail`, hook `usePostDetailI18n()`. Namespaces are unique across
//!   the app; colliding names are qualified with their directory.
//! - Every `Translate` enum → the `enum` namespace in `generated/enums.i18n.tsx`
//!   with `<Type>.<Variant>` keys; `#[translate(from)]` variants are listed in
//!   `delegates` (the wrapped value supplies the text).
//! - `{name}` placeholders (filled with `str::replace` in Rust) become
//!   i18next `{{name}}`; the hook exposes those keys as `(values) => string`.
//! - `generated/index.ts` maps namespace → module for `src/i18n/index.ts`.
//!
//! Parsing follows `packages/dioxus-translate-macro` so the strings are the
//! ones the Dioxus build compiles. Anything that macro would reject or
//! silently drop (missing language, non-string literal, unparsable block) is
//! reported and fails the run.
//!
//! Usage: `i18n-extract --src app/ratel/src --out apps/web/src/i18n/generated [--check]`
//! `--check` writes nothing and exits 1 when the output on disk is stale.

use std::collections::{BTreeMap, BTreeSet};
use std::fmt::Write as _;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::ExitCode;

use syn::ext::IdentExt;
use syn::parse::{Parse, ParseStream};
use syn::punctuated::Punctuated;
use syn::visit::Visit;
use syn::{Fields, Ident, Lit, LitStr, Meta, Token, braced};

struct Args {
    src: PathBuf,
    out: PathBuf,
    check: bool,
}

fn parse_args() -> Result<Args, String> {
    let (mut src, mut out, mut check) = (None, None, false);
    let mut it = std::env::args().skip(1);
    while let Some(arg) = it.next() {
        match arg.as_str() {
            "--src" => src = it.next().map(PathBuf::from),
            "--out" => out = it.next().map(PathBuf::from),
            "--check" => check = true,
            other => return Err(format!("unknown argument `{other}`")),
        }
    }
    Ok(Args {
        src: src.ok_or("--src is required")?,
        out: out.ok_or("--out is required")?,
        check,
    })
}

// ---------------------------------------------------------------------------
// Parsing (mirrors dioxus-translate-macro)

/// A `translate! { Name; key: { en: "...", ko: "..." }, ... }` block.
struct Block {
    name: String,
    fields: Vec<Field>,
}

struct Field {
    key: String,
    en: Option<String>,
    ko: Option<String>,
    problems: Vec<String>,
}

impl Parse for Block {
    fn parse(input: ParseStream) -> syn::Result<Self> {
        let name: Ident = input.parse()?;
        input.parse::<Token![;]>()?;
        let mut fields = Vec::new();
        while !input.is_empty() {
            let key: Ident = input.parse()?;
            input.parse::<Token![:]>()?;
            let content;
            braced!(content in input);
            let mut field = Field {
                key: key.unraw().to_string(),
                en: None,
                ko: None,
                problems: Vec::new(),
            };
            while !content.is_empty() {
                let lang: Ident = content.parse()?;
                content.parse::<Token![:]>()?;
                let value: Lit = content.parse()?;
                let _ = content.parse::<Token![,]>();
                match (lang.to_string().as_str(), value) {
                    ("en", Lit::Str(s)) => field.en = Some(s.value()),
                    ("ko", Lit::Str(s)) => field.ko = Some(s.value()),
                    ("en" | "ko", _) => field.problems.push(format!("`{lang}` is not a string literal")),
                    (other, _) => field.problems.push(format!("unknown language `{other}`")),
                }
            }
            fields.push(field);
            let _ = input.parse::<Token![,]>();
        }
        Ok(Block { name: name.to_string(), fields })
    }
}

struct EnumDef {
    name: String,
    variants: Vec<Variant>,
}

struct Variant {
    name: String,
    en: String,
    ko: String,
    /// `#[translate(from)]` on a single-field tuple variant: the inner type.
    delegate: Option<String>,
}

fn derives_translate(attrs: &[syn::Attribute]) -> bool {
    attrs.iter().any(|attr| {
        attr.path().is_ident("derive")
            && attr
                .parse_args_with(Punctuated::<syn::Path, Token![,]>::parse_terminated)
                .map(|paths| paths.iter().any(|p| p.segments.last().is_some_and(|s| s.ident == "Translate")))
                .unwrap_or(false)
    })
}

/// Same attribute handling as `translate_derive`: the variant name is the
/// default for both languages; parse errors are ignored like the macro does.
fn read_variant(variant: &syn::Variant, problems: &mut Vec<String>) -> Variant {
    let name = variant.ident.to_string();
    let (mut en, mut ko, mut from) = (name.clone(), name.clone(), false);
    for attr in &variant.attrs {
        if let Meta::List(list) = &attr.meta {
            if list.path.is_ident("translate") {
                let _ = list.parse_nested_meta(|nested| {
                    if nested.path.is_ident("en") {
                        en = nested.value()?.parse::<LitStr>()?.value();
                    }
                    if nested.path.is_ident("ko") {
                        ko = nested.value()?.parse::<LitStr>()?.value();
                    }
                    if nested.path.is_ident("from") {
                        from = true;
                    }
                    Ok(())
                });
            }
        }
    }
    let delegate = match (&variant.fields, from) {
        (Fields::Unnamed(fields), true) if fields.unnamed.len() == 1 => match &fields.unnamed[0].ty {
            syn::Type::Path(tp) => tp.path.segments.last().map(|s| s.ident.to_string()),
            _ => {
                problems.push(format!("{name}: `#[translate(from)]` inner type is not a path"));
                None
            }
        },
        _ => None,
    };
    Variant { name, en, ko, delegate }
}

#[derive(Default)]
struct Collector {
    blocks: Vec<Block>,
    enums: Vec<EnumDef>,
    problems: Vec<String>,
}

impl<'ast> Visit<'ast> for Collector {
    fn visit_macro(&mut self, mac: &'ast syn::Macro) {
        if mac.path.segments.last().is_some_and(|s| s.ident == "translate") {
            match mac.parse_body::<Block>() {
                Ok(block) => self.blocks.push(block),
                Err(e) => self.problems.push(format!("translate! does not parse: {e}")),
            }
        }
        syn::visit::visit_macro(self, mac);
    }

    fn visit_item_enum(&mut self, item: &'ast syn::ItemEnum) {
        if derives_translate(&item.attrs) {
            let mut problems = Vec::new();
            let variants = item.variants.iter().map(|v| read_variant(v, &mut problems)).collect();
            self.problems.extend(problems.into_iter().map(|p| format!("enum {}: {p}", item.ident)));
            self.enums.push(EnumDef { name: item.ident.to_string(), variants });
        }
        syn::visit::visit_item_enum(self, item);
    }
}

// ---------------------------------------------------------------------------
// Naming

/// Splits `PostDetailTranslate`, `post_detail`, `apps-general` into lowercase words.
fn words(s: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut cur = String::new();
    let chars: Vec<char> = s.chars().collect();
    for (i, &c) in chars.iter().enumerate() {
        if !c.is_ascii_alphanumeric() {
            if !cur.is_empty() {
                out.push(std::mem::take(&mut cur));
            }
            continue;
        }
        let boundary = c.is_ascii_uppercase()
            && i > 0
            && (chars[i - 1].is_ascii_lowercase()
                || chars[i - 1].is_ascii_digit()
                || (chars[i - 1].is_ascii_uppercase() && chars.get(i + 1).is_some_and(|n| n.is_ascii_lowercase())));
        if boundary && !cur.is_empty() {
            out.push(std::mem::take(&mut cur));
        }
        cur.push(c.to_ascii_lowercase());
    }
    if !cur.is_empty() {
        out.push(cur);
    }
    out
}

fn pascal(words: &[String]) -> String {
    words
        .iter()
        .map(|w| {
            let mut c = w.chars();
            c.next().map(|f| f.to_ascii_uppercase().to_string() + c.as_str()).unwrap_or_default()
        })
        .collect()
}

fn lower_camel(words: &[String]) -> String {
    let p = pascal(words);
    let mut c = p.chars();
    c.next().map(|f| f.to_ascii_lowercase().to_string() + c.as_str()).unwrap_or_default()
}

/// `PostDetailTranslate` → `[post, detail]`.
fn bundle_words(struct_name: &str) -> Vec<String> {
    let mut w = words(struct_name);
    while w.len() > 1 && matches!(w.last().map(String::as_str), Some("translate" | "translation" | "translations" | "tr" | "i18n")) {
        w.pop();
    }
    w
}

/// Directory words that don't disambiguate anything.
const GENERIC_DIRS: &[&str] = &["features", "common", "pages", "views", "components", "controllers", "i18n", "mod", "component", "src"];

fn qualifier(rel: &str) -> Vec<String> {
    let segs: Vec<&str> = rel.trim_end_matches(".rs").split('/').filter(|s| !GENERIC_DIRS.contains(s)).collect();
    segs.iter().rev().take(2).rev().flat_map(|s| words(s)).collect()
}

// ---------------------------------------------------------------------------
// Rendering

fn json(s: &str) -> String {
    serde_json::to_string(s).expect("string serializes")
}

fn ts_key(key: &str) -> String {
    let mut chars = key.chars();
    let valid = chars.next().is_some_and(|c| c.is_ascii_alphabetic() || c == '_' || c == '$')
        && chars.all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '$');
    if valid { key.to_string() } else { json(key) }
}

/// `{name}` → `{{name}}`; returns the placeholder names.
fn interpolation(value: &str, names: &mut BTreeSet<String>) -> String {
    let mut out = String::with_capacity(value.len());
    let bytes: Vec<char> = value.chars().collect();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == '{' {
            let rest: String = bytes[i + 1..].iter().collect();
            if let Some(end) = rest.find('}') {
                let name = &rest[..end];
                let is_ident = name.chars().next().is_some_and(|c| c.is_ascii_alphabetic() || c == '_')
                    && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_');
                if is_ident {
                    names.insert(name.to_string());
                    let _ = write!(out, "{{{{{name}}}}}");
                    i += 1 + name.chars().count() + 1;
                    continue;
                }
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    out
}

const HEADER: &str = "// @generated by packages/i18n-extract from app/ratel/src. Do not edit; run\n// `cargo run -p i18n-extract -- --src app/ratel/src --out apps/web/src/i18n/generated`.\n";

struct BlockModule<'a> {
    rel: &'a str,
    block: &'a Block,
    namespace: String,
    words: Vec<String>,
}

fn render_block(m: &BlockModule<'_>, problems: &mut Vec<String>) -> String {
    let name = pascal(&m.words);
    let mut s = String::new();
    let _ = writeln!(s, "{HEADER}// Source: app/ratel/src/{} (`{}`). Namespace \"{}\".", m.rel, m.block.name, m.namespace);
    let _ = writeln!(s, "import {{ useTranslation }} from \"react-i18next\";");

    let mut placeholders: BTreeMap<&str, BTreeSet<String>> = BTreeMap::new();
    let mut en_lines = String::new();
    let mut ko_lines = String::new();
    for field in &m.block.fields {
        let names = placeholders.entry(&field.key).or_default();
        let en = interpolation(field.en.as_deref().unwrap_or_default(), names);
        let ko = interpolation(field.ko.as_deref().unwrap_or_default(), names);
        let _ = writeln!(en_lines, "  {}: {},", ts_key(&field.key), json(&en));
        let _ = writeln!(ko_lines, "  {}: {},", ts_key(&field.key), json(&ko));
    }
    let _ = write!(s, "\nconst en = {{\n{en_lines}}};\n");
    let _ = write!(s, "\nconst ko: Record<keyof typeof en, string> = {{\n{ko_lines}}};\n");
    let _ = writeln!(s, "\nexport const i18n = {{ en, ko }};");

    let mut seen = BTreeSet::new();
    let mut iface = String::new();
    let mut body = String::new();
    for field in &m.block.fields {
        let prop = lower_camel(&words(&field.key));
        if !seen.insert(prop.clone()) {
            problems.push(format!("{}: {}.{} maps to duplicate hook field `{prop}`", m.rel, m.block.name, field.key));
            continue;
        }
        let names = &placeholders[field.key.as_str()];
        if names.is_empty() {
            let _ = writeln!(iface, "  {prop}: string;");
            let _ = writeln!(body, "    {prop}: t({}),", json(&field.key));
        } else {
            let vars: Vec<String> = names.iter().map(|n| format!("{}: string | number", ts_key(n))).collect();
            let _ = writeln!(iface, "  {prop}: (values: {{ {} }}) => string;", vars.join("; "));
            // `replace` keeps placeholder names (`count`, `context`, …) from
            // being read as i18next options; Rust fills them with plain
            // `str::replace`, so there are no plurals or contexts to honor.
            let _ = writeln!(body, "    {prop}: (values) => t({}, {{ replace: values }}),", json(&field.key));
        }
    }
    let _ = write!(s, "\nexport interface {name}I18n {{\n{iface}}}\n");
    let _ = write!(
        s,
        "\nexport function use{name}I18n(): {name}I18n {{\n  const {{ t }} = useTranslation({});\n  return {{\n{body}  }};\n}}\n",
        json(&m.namespace)
    );
    s
}

struct EnumModule<'a> {
    rel: &'a str,
    def: &'a EnumDef,
    key: String,
}

fn render_enums(enums: &[EnumModule<'_>]) -> String {
    let mut s = String::new();
    let _ = writeln!(s, "{HEADER}// Every `#[derive(Translate)]` enum. Namespace \"enum\", keys `<Type>.<Variant>`.");
    let _ = writeln!(s, "import {{ useTranslation }} from \"react-i18next\";");

    let mut en = String::new();
    let mut ko = String::new();
    let mut delegates = String::new();
    for e in enums {
        let _ = writeln!(en, "  // app/ratel/src/{} `{}`", e.rel, e.def.name);
        let _ = writeln!(en, "  {}: {{", ts_key(&e.key));
        let _ = writeln!(ko, "  {}: {{", ts_key(&e.key));
        for v in e.def.variants.iter().filter(|v| v.delegate.is_none()) {
            let _ = writeln!(en, "    {}: {},", ts_key(&v.name), json(&v.en));
            let _ = writeln!(ko, "    {}: {},", ts_key(&v.name), json(&v.ko));
        }
        let _ = writeln!(en, "  }},");
        let _ = writeln!(ko, "  }},");
        let delegated: Vec<String> = e
            .def
            .variants
            .iter()
            .filter_map(|v| Some(format!("{}: {}", ts_key(&v.name), json(v.delegate.as_ref()?))))
            .collect();
        if !delegated.is_empty() {
            let _ = writeln!(delegates, "  {}: {{ {} }},", ts_key(&e.key), delegated.join(", "));
        }
    }
    let _ = write!(s, "\nconst en = {{\n{en}}};\n");
    let _ = write!(s, "\nconst ko: {{ [T in keyof typeof en]: Record<keyof (typeof en)[T], string> }} = {{\n{ko}}};\n");
    let _ = writeln!(s, "\nexport const i18n = {{ en, ko }};");
    let _ = write!(
        s,
        "\n/**\n * `#[translate(from)]` variants: the text comes from the wrapped value's own\n * enum (Rust type name, possibly qualified in this module), not from a key here.\n */\nexport const delegates = {{\n{delegates}}} as const;\n"
    );
    let _ = write!(
        s,
        "\nexport type EnumType = keyof typeof en;\n\n/** `t(\"SpaceStatus\", \"Draft\")` — the Rust `variant.translate(&lang)`. */\nexport function useEnumI18n(): <T extends EnumType>(type: T, variant: keyof (typeof en)[T] & string) => string {{\n  const {{ t }} = useTranslation(\"enum\");\n  return (type, variant) => t(`${{type}}.${{variant}}`);\n}}\n"
    );
    s
}

fn render_index(modules: &[(String, String)]) -> String {
    let mut s = String::new();
    let _ = writeln!(s, "{HEADER}// Namespace → bundle, consumed by src/i18n/index.ts.");
    for (i, (_, path)) in modules.iter().enumerate() {
        let _ = writeln!(s, "import {{ i18n as m{i} }} from \"./{path}\";");
    }
    let _ = writeln!(s, "\nexport const modules = {{");
    for (i, (ns, _)) in modules.iter().enumerate() {
        let _ = writeln!(s, "  {}: m{i},", ts_key(ns));
    }
    let _ = writeln!(s, "}};");
    s
}

// ---------------------------------------------------------------------------

fn collect_files(dir: &Path, exts: &[&str], out: &mut Vec<PathBuf>) {
    let Ok(entries) = fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_files(&path, exts, out);
        } else if path.extension().and_then(|e| e.to_str()).is_some_and(|e| exts.contains(&e)) {
            out.push(path);
        }
    }
}

fn main() -> ExitCode {
    let args = match parse_args() {
        Ok(args) => args,
        Err(e) => {
            eprintln!("i18n-extract: {e}");
            return ExitCode::from(2);
        }
    };

    let mut sources = Vec::new();
    collect_files(&args.src, &["rs"], &mut sources);
    sources.sort();

    let mut problems = Vec::new();
    let mut parsed: Vec<(String, Collector)> = Vec::new();
    for path in &sources {
        let rel = path.strip_prefix(&args.src).unwrap_or(path).to_string_lossy().replace('\\', "/");
        let text = match fs::read_to_string(path) {
            Ok(text) => text,
            Err(e) => {
                problems.push(format!("{rel}: cannot read: {e}"));
                continue;
            }
        };
        let file = match syn::parse_file(&text) {
            Ok(file) => file,
            Err(e) => {
                problems.push(format!("{rel}: does not parse: {e}"));
                continue;
            }
        };
        let mut collector = Collector::default();
        collector.visit_file(&file);
        problems.extend(collector.problems.drain(..).map(|p| format!("{rel}: {p}")));
        if !collector.blocks.is_empty() || !collector.enums.is_empty() {
            parsed.push((rel, collector));
        }
    }

    // Validate bundles.
    for (rel, c) in &parsed {
        for block in &c.blocks {
            let mut keys = BTreeSet::new();
            for field in &block.fields {
                if !keys.insert(field.key.clone()) {
                    problems.push(format!("{rel}: {}.{} is defined twice", block.name, field.key));
                }
                if field.en.is_none() || field.ko.is_none() {
                    problems.push(format!("{rel}: {}.{} lacks en or ko", block.name, field.key));
                }
                for p in &field.problems {
                    problems.push(format!("{rel}: {}.{}: {p}", block.name, field.key));
                }
            }
        }
    }

    // Namespaces: bundle name, qualified with its directory when not unique.
    let mut blocks: Vec<BlockModule<'_>> = parsed
        .iter()
        .flat_map(|(rel, c)| {
            c.blocks.iter().map(move |block| BlockModule { rel, block, namespace: String::new(), words: bundle_words(&block.name) })
        })
        .collect();
    let mut count: BTreeMap<String, usize> = BTreeMap::new();
    for b in &blocks {
        *count.entry(lower_camel(&b.words)).or_default() += 1;
    }
    for b in &mut blocks {
        if count[&lower_camel(&b.words)] > 1 || lower_camel(&b.words) == "enum" {
            let mut w = qualifier(b.rel);
            w.extend(b.words.iter().cloned());
            b.words = w;
        }
        b.namespace = lower_camel(&b.words);
    }
    let mut namespaces = BTreeSet::new();
    for b in &blocks {
        if !namespaces.insert(b.namespace.clone()) {
            problems.push(format!("{}: namespace `{}` ({}) is still not unique", b.rel, b.namespace, b.block.name));
        }
    }

    let mut enums: Vec<EnumModule<'_>> = parsed
        .iter()
        .flat_map(|(rel, c)| c.enums.iter().map(move |def| EnumModule { rel, def, key: def.name.clone() }))
        .collect();
    let mut enum_count: BTreeMap<String, usize> = BTreeMap::new();
    for e in &enums {
        *enum_count.entry(e.def.name.clone()).or_default() += 1;
    }
    for e in &mut enums {
        if enum_count[&e.def.name] > 1 {
            let mut w = qualifier(e.rel);
            w.extend(words(&e.def.name));
            e.key = pascal(&w);
        }
    }
    enums.sort_by(|a, b| a.key.cmp(&b.key));
    let mut enum_keys = BTreeSet::new();
    for e in &enums {
        if !enum_keys.insert(e.key.clone()) {
            problems.push(format!("{}: enum key `{}` is still not unique", e.rel, e.key));
        }
    }

    // Outputs.
    let mut outputs: BTreeMap<PathBuf, String> = BTreeMap::new();
    let mut index: Vec<(String, String)> = Vec::new();
    for b in &blocks {
        let dir = Path::new(b.rel).parent().map(|p| p.to_string_lossy().into_owned()).unwrap_or_default();
        let file = format!("{}.i18n", b.words.join("-"));
        let module = if dir.is_empty() { file } else { format!("{dir}/{file}") };
        outputs.insert(args.out.join(format!("{module}.tsx")), render_block(b, &mut problems));
        index.push((b.namespace.clone(), module));
    }
    outputs.insert(args.out.join("enums.i18n.tsx"), render_enums(&enums));
    index.push(("enum".to_string(), "enums.i18n".to_string()));
    index.sort();
    outputs.insert(args.out.join("index.ts"), render_index(&index));

    let mut existing = Vec::new();
    collect_files(&args.out, &["ts", "tsx"], &mut existing);
    let stale: Vec<&PathBuf> = existing.iter().filter(|p| !outputs.contains_key(*p)).collect();

    let mut drift = Vec::new();
    for (path, content) in &outputs {
        match fs::read_to_string(path) {
            Ok(current) if &current == content => {}
            Ok(_) => drift.push(format!("changed: {}", path.display())),
            Err(_) => drift.push(format!("missing: {}", path.display())),
        }
    }
    drift.extend(stale.iter().map(|p| format!("stale: {}", p.display())));

    if !args.check {
        for (path, content) in &outputs {
            if fs::read_to_string(path).is_ok_and(|current| &current == content) {
                continue;
            }
            if let Some(parent) = path.parent() {
                let _ = fs::create_dir_all(parent);
            }
            if let Err(e) = fs::write(path, content) {
                problems.push(format!("{}: cannot write: {e}", path.display()));
            }
        }
        for path in &stale {
            let _ = fs::remove_file(path);
        }
    }

    let keys: usize = blocks.iter().map(|b| b.block.fields.len()).sum();
    let variants: usize = enums.iter().map(|e| e.def.variants.len()).sum();
    let delegates: usize = enums.iter().flat_map(|e| &e.def.variants).filter(|v| v.delegate.is_some()).count();
    let qualified_ns = blocks.iter().filter(|b| b.namespace != lower_camel(&bundle_words(&b.block.name))).count();
    let qualified_enums = enums.iter().filter(|e| e.key != e.def.name).count();
    println!(
        "sources: {}  translate! blocks: {}  keys: {keys}  Translate enums: {}  variants: {variants}  delegates: {delegates}  qualified namespaces: {qualified_ns}  qualified enums: {qualified_enums}",
        sources.len(),
        blocks.len(),
        enums.len(),
    );
    for p in &problems {
        println!("problem: {p}");
    }
    if args.check {
        for d in &drift {
            println!("{d}");
        }
        println!("out of date: {}", drift.len());
    } else {
        println!("updated: {}", drift.len());
    }

    if !problems.is_empty() || (args.check && !drift.is_empty()) {
        ExitCode::FAILURE
    } else {
        ExitCode::SUCCESS
    }
}
