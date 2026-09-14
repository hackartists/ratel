use crate::features::spaces::pages::apps::apps::incentive_pool::*;
use uuid::Uuid;

#[cfg(feature = "server")]
use postgres::PostgresEntity;

/// One token-balance row per (incentive contract, token). Postgres
/// migration: surrogate `id` PK; the DynamoDB
/// `(SpaceIncentive(address), SpaceIncentiveToken(token_address))`
/// identity becomes the `unique(incentive_address, token_address)`
/// natural key. `incentive_address` is stored lowercase (as the old pk
/// inner was) — a cross-feature/on-chain reference, no FK.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
// Serialize through `SpaceIncentiveTokenWire` so the shipped mobile build still finds
// the legacy `pk`/`sk` keys. See `SpaceIncentiveTokenWire`.
#[serde(into = "SpaceIncentiveTokenWire")]
#[cfg_attr(feature = "server", derive(PostgresEntity))]
#[cfg_attr(
    feature = "server",
    postgres(
        table = "space_incentive_tokens",
        unique(incentive_address, token_address)
    )
)]
pub struct SpaceIncentiveToken {
    pub id: Uuid,

    #[cfg_attr(feature = "server", postgres(index))]
    pub incentive_address: String,

    pub token_address: String,
    pub symbol: String,
    pub decimals: i64,
    pub balance: String,
    pub updated_at: i64,
}

impl SpaceIncentiveToken {
    pub fn new(
        incentive_address: impl std::fmt::Display,
        token_address: impl std::fmt::Display,
        symbol: String,
        decimals: i64,
        balance: String,
        updated_at: i64,
    ) -> Self {
        Self {
            id: Uuid::now_v7(),
            incentive_address: incentive_address.to_string().to_lowercase(),
            token_address: token_address.to_string(),
            symbol,
            decimals,
            balance,
            updated_at,
        }
    }
}

#[cfg(feature = "server")]
impl SpaceIncentiveToken {
    /// Page of token rows for an incentive contract, ordered by
    /// `token_address` ascending (matching the old sk order). `bookmark`
    /// is a decimal 1-based page number; the returned bookmark is the
    /// next page number, or `None` on the last page.
    pub async fn find_page(
        incentive_address: &str,
        bookmark: Option<String>,
        page_size: i64,
    ) -> crate::common::Result<(Vec<Self>, Option<String>)> {
        use postgres::Order;
        use postgres::ops::StringOp;

        let page: i64 = bookmark
            .as_deref()
            .and_then(|s| s.parse().ok())
            .unwrap_or(1)
            .max(1);
        let addr = incentive_address.to_lowercase();

        let p = Self::repository()
            .find(
                Self::query()
                    .incentive_address(StringOp::Eq(addr))
                    .order_by(SpaceIncentiveTokenColumn::TokenAddress, Order::Asc)
                    .page(page)
                    .page_size(page_size),
            )
            .await?;

        let next = if page < p.total_pages {
            Some((page + 1).to_string())
        } else {
            None
        };

        Ok((p.items, next))
    }

    /// Every token address held under an incentive contract.
    pub async fn list_token_addresses(
        incentive_address: impl std::fmt::Display,
    ) -> crate::common::Result<std::collections::HashSet<String>> {
        let addr = incentive_address.to_string().to_lowercase();
        let mut out = std::collections::HashSet::new();
        let mut page = 1i64;
        loop {
            let (items, next) = Self::find_page(&addr, Some(page.to_string()), 200).await?;
            for it in items {
                out.insert(it.token_address);
            }
            match next {
                Some(_) => page += 1,
                None => break,
            }
        }
        Ok(out)
    }

    pub async fn upsert_balance(
        incentive_address: impl std::fmt::Display,
        token_address: impl std::fmt::Display,
        symbol: String,
        decimals: i64,
        balance: String,
        updated_at: i64,
    ) -> crate::common::Result<()> {
        let item = Self::new(
            incentive_address,
            token_address,
            symbol,
            decimals,
            balance,
            updated_at,
        );

        Self::repository()
            .upsert_on(&["incentive_address", "token_address"], &item)
            .await?;
        Ok(())
    }
}

/// Wire form of [`SpaceIncentiveToken`] — identical plus the legacy `pk`/`sk`.
///
/// Same reason as `UserWire`. The address was lowercased when the DynamoDB key
/// was built, so the same normalization is applied here.
#[derive(Serialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/", rename = "SpaceIncentiveToken"))]
pub struct SpaceIncentiveTokenWire {
    /// `Partition::SpaceIncentive(incentive_address)` — lowercased, as written.
    pub pk: Partition,
    /// `EntityType::SpaceIncentiveToken(token_address)`.
    pub sk: EntityType,

    pub id: Uuid,
    pub incentive_address: String,
    pub token_address: String,
    pub symbol: String,
    pub decimals: i64,
    pub balance: String,
    pub updated_at: i64,
}

impl From<SpaceIncentiveToken> for SpaceIncentiveTokenWire {
    fn from(v: SpaceIncentiveToken) -> Self {
        Self {
            pk: Partition::SpaceIncentive(v.incentive_address.to_lowercase()),
            sk: EntityType::SpaceIncentiveToken(v.token_address.clone()),

            id: v.id,
            incentive_address: v.incentive_address,
            token_address: v.token_address,
            symbol: v.symbol,
            decimals: v.decimals,
            balance: v.balance,
            updated_at: v.updated_at,
        }
    }
}

#[cfg(test)]
mod shipped_client_compat_tests {
    use super::*;

    /// The identity fields the shipped mobile build declares on `SpaceIncentiveToken`,
    /// copied from commit 38ac1fcd8. Neither carries `#[serde(default)]`.
    #[derive(Debug, serde::Deserialize)]
    #[allow(dead_code)]
    struct ShippedKeys {
        pk: Partition,
        sk: EntityType,
    }

    #[test]
    fn shipped_build_can_parse_current_row() {
        let v = SpaceIncentiveToken { incentive_address: "0xABC".into(), token_address: "0xT1".into(), ..Default::default() };
        let json = serde_json::to_value(&v).expect("serialize");
        assert_eq!(json["pk"], serde_json::json!("SPACE_INCENTIVE#0xabc"));
        serde_json::from_value::<ShippedKeys>(json).expect("shipped build must parse this");
    }

    #[test]
    fn shipped_build_breaks_without_legacy_keys() {
        let mut json = serde_json::to_value(SpaceIncentiveToken { incentive_address: "0xABC".into(), token_address: "0xT1".into(), ..Default::default() }).expect("serialize");
        json.as_object_mut().unwrap().remove("pk");
        let err = serde_json::from_value::<ShippedKeys>(json).expect_err("must fail");
        assert!(err.to_string().contains("missing field `pk`"), "got: {err}");
    }
}

// TypeScript binding (`make gen-ts` only). `SpaceIncentiveToken` serializes through
// `SpaceIncentiveTokenWire`, which is exported under this name; delegate every method so
// references, declarations and the output file all come from the wire struct.
#[cfg(feature = "ts-bridge")]
impl ts_rs::TS for SpaceIncentiveToken {
    type WithoutGenerics = Self;

    fn ident() -> String {
        <SpaceIncentiveTokenWire as ts_rs::TS>::ident()
    }
    fn decl() -> String {
        <SpaceIncentiveTokenWire as ts_rs::TS>::decl()
    }
    fn decl_concrete() -> String {
        <SpaceIncentiveTokenWire as ts_rs::TS>::decl_concrete()
    }
    fn name() -> String {
        <SpaceIncentiveTokenWire as ts_rs::TS>::name()
    }
    fn inline() -> String {
        <SpaceIncentiveTokenWire as ts_rs::TS>::inline()
    }
    fn inline_flattened() -> String {
        <SpaceIncentiveTokenWire as ts_rs::TS>::inline_flattened()
    }
    fn visit_dependencies(v: &mut impl ts_rs::TypeVisitor)
    where
        Self: 'static,
    {
        <SpaceIncentiveTokenWire as ts_rs::TS>::visit_dependencies(v)
    }
    fn visit_generics(v: &mut impl ts_rs::TypeVisitor)
    where
        Self: 'static,
    {
        <SpaceIncentiveTokenWire as ts_rs::TS>::visit_generics(v)
    }
    fn output_path() -> Option<&'static std::path::Path> {
        <SpaceIncentiveTokenWire as ts_rs::TS>::output_path()
    }
}
