use crate::common::traits::{Bookmarker, ItemIter};
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Clone, serde::Serialize, serde::Deserialize, Default, PartialEq, Debug)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[serde(bound(deserialize = "T: serde::de::DeserializeOwned"))]
pub struct ListResponse<T>
where
    T: Clone + serde::Serialize + serde::de::DeserializeOwned,
{
    pub items: Vec<T>,
    pub bookmark: Option<String>,
}

// TypeScript binding (`make gen-ts` only). ts-rs substitutes `ts_rs::Dummy` for
// `T` when declaring a generic type, which the serde `where` bound above
// rejects, so the declaration comes from a bound-free mirror with the same
// fields and the real type delegates to it.
#[cfg(feature = "ts-bridge")]
#[derive(ts_rs::TS)]
#[ts(export, export_to = "types/", rename = "ListResponse")]
pub struct ListResponseTs<T> {
    pub items: Vec<T>,
    pub bookmark: Option<String>,
}

#[cfg(feature = "ts-bridge")]
impl<T> ts_rs::TS for ListResponse<T>
where
    T: ts_rs::TS + Clone + serde::Serialize + serde::de::DeserializeOwned,
{
    type WithoutGenerics = ListResponseTs<ts_rs::Dummy>;

    fn ident() -> String {
        <ListResponseTs<T> as ts_rs::TS>::ident()
    }
    fn decl() -> String {
        <ListResponseTs<T> as ts_rs::TS>::decl()
    }
    fn decl_concrete() -> String {
        <ListResponseTs<T> as ts_rs::TS>::decl_concrete()
    }
    fn name() -> String {
        <ListResponseTs<T> as ts_rs::TS>::name()
    }
    fn inline() -> String {
        <ListResponseTs<T> as ts_rs::TS>::inline()
    }
    fn inline_flattened() -> String {
        <ListResponseTs<T> as ts_rs::TS>::inline_flattened()
    }
    fn visit_dependencies(v: &mut impl ts_rs::TypeVisitor)
    where
        Self: 'static,
    {
        <ListResponseTs<T> as ts_rs::TS>::visit_dependencies(v)
    }
    fn visit_generics(v: &mut impl ts_rs::TypeVisitor)
    where
        Self: 'static,
    {
        <ListResponseTs<T> as ts_rs::TS>::visit_generics(v)
    }
    fn output_path() -> Option<&'static std::path::Path> {
        <ListResponseTs<T> as ts_rs::TS>::output_path()
    }
}

impl<T> From<(Vec<T>, Option<String>)> for ListResponse<T>
where
    T: Clone + serde::de::DeserializeOwned + serde::Serialize,
{
    fn from((items, bookmark): (Vec<T>, Option<String>)) -> Self {
        Self { items, bookmark }
    }
}

impl<T> Bookmarker<String> for ListResponse<T>
where
    T: Clone + serde::Serialize + serde::de::DeserializeOwned,
{
    fn bookmark(&self) -> Option<String> {
        self.bookmark.clone()
    }
}

impl<T> ItemIter<T> for ListResponse<T>
where
    T: Clone + serde::Serialize + serde::de::DeserializeOwned,
{
    fn items(&self) -> &'_ Vec<T> {
        &self.items
    }
}
