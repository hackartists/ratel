//! Extracts every `translate!` block and `#[derive(Translate)]` enum from the
//! Dioxus app into TypeScript bundles for the React app
//! (docs/superpower/2026-09-14-react-frontend-migration.md §7).
//!
//! One `.ts` module per Rust source file, at the same relative path under
//! `--out`, exporting one bundle per block/enum with the Rust name:
//!
//!     export const PostTranslate = {
//!       en: { title: "Title" },
//!       ko: { title: "제목" },
//!     } as const satisfies Bundle;
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
        (Fields::Unnamed(fields), true) if fields.unnamed.len() == 1 => {
            match &fields.unnamed[0].ty {
                syn::Type::Path(tp) => tp.path.segments.last().map(|s| s.ident.to_string()),
                _ => {
                    problems.push(format!("{name}: `#[translate(from)]` inner type is not a path"));
                    None
                }
            }
        }
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

fn json(s: &str) -> String {
    serde_json::to_string(s).expect("string serializes")
}

fn ts_key(key: &str) -> String {
    let mut chars = key.chars();
    let valid = chars.next().is_some_and(|c| c.is_ascii_alphabetic() || c == '_' || c == '$')
        && chars.all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '$');
    if valid { key.to_string() } else { json(key) }
}

fn render(rel: &str, blocks: &[Block], enums: &[EnumDef]) -> String {
    let mut s = String::new();
    let _ = writeln!(s, "// @generated by packages/i18n-extract from app/ratel/src/{rel}. Do not edit.");
    let mut imports = Vec::new();
    if !blocks.is_empty() {
        imports.push("Bundle");
    }
    if !enums.is_empty() {
        imports.push("EnumBundle");
    }
    let _ = writeln!(s, "import type {{ {} }} from \"@/i18n\";", imports.join(", "));

    for block in blocks {
        let _ = writeln!(s, "\nexport const {} = {{", block.name);
        for lang in ["en", "ko"] {
            let _ = writeln!(s, "  {lang}: {{");
            for field in &block.fields {
                let value = if lang == "en" { &field.en } else { &field.ko };
                if let Some(value) = value {
                    let _ = writeln!(s, "    {}: {},", ts_key(&field.key), json(value));
                }
            }
            let _ = writeln!(s, "  }},");
        }
        let _ = writeln!(s, "}} as const satisfies Bundle;");
    }

    for def in enums {
        let _ = writeln!(s, "\nexport const {} = {{", def.name);
        for lang in ["en", "ko"] {
            let _ = writeln!(s, "  {lang}: {{");
            for v in def.variants.iter().filter(|v| v.delegate.is_none()) {
                let value = if lang == "en" { &v.en } else { &v.ko };
                let _ = writeln!(s, "    {}: {},", ts_key(&v.name), json(value));
            }
            let _ = writeln!(s, "  }},");
        }
        let delegates: Vec<_> = def.variants.iter().filter_map(|v| Some((&v.name, v.delegate.as_ref()?))).collect();
        if !delegates.is_empty() {
            let _ = writeln!(s, "  delegates: {{");
            for (name, inner) in delegates {
                let _ = writeln!(s, "    {}: {},", ts_key(name), json(inner));
            }
            let _ = writeln!(s, "  }},");
        }
        let _ = writeln!(s, "}} as const satisfies EnumBundle;");
    }
    s
}

fn collect_files(dir: &Path, ext: &str, out: &mut Vec<PathBuf>) {
    let Ok(entries) = fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_files(&path, ext, out);
        } else if path.extension().is_some_and(|e| e == ext) {
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
    collect_files(&args.src, "rs", &mut sources);
    sources.sort();

    let mut outputs: BTreeMap<PathBuf, String> = BTreeMap::new();
    let mut problems = Vec::new();
    let (mut blocks_n, mut keys_n, mut enums_n, mut variants_n, mut delegates_n) = (0, 0, 0, 0, 0);

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
        problems.extend(collector.problems.iter().map(|p| format!("{rel}: {p}")));

        let mut names = BTreeSet::new();
        for block in &collector.blocks {
            if !names.insert(block.name.clone()) {
                problems.push(format!("{rel}: duplicate export `{}`", block.name));
            }
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
            blocks_n += 1;
            keys_n += block.fields.len();
        }
        for def in &collector.enums {
            if !names.insert(def.name.clone()) {
                problems.push(format!("{rel}: duplicate export `{}`", def.name));
            }
            enums_n += 1;
            variants_n += def.variants.len();
            delegates_n += def.variants.iter().filter(|v| v.delegate.is_some()).count();
        }

        if !collector.blocks.is_empty() || !collector.enums.is_empty() {
            let out = args.out.join(format!("{}.ts", rel.trim_end_matches(".rs")));
            outputs.insert(out, render(&rel, &collector.blocks, &collector.enums));
        }
    }

    let mut existing = Vec::new();
    collect_files(&args.out, "ts", &mut existing);
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

    println!(
        "sources: {}  modules: {}  translate! blocks: {blocks_n}  keys: {keys_n}  Translate enums: {enums_n}  variants: {variants_n}  delegates: {delegates_n}",
        sources.len(),
        outputs.len(),
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
