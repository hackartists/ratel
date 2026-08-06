use crate::features::spaces::models::RespondentAttr;
use crate::features::spaces::*;
pub use crate::common::models::did::VerifiedAttributes;
use crate::common::models::User;

#[cfg(feature = "server")]
pub async fn get_attributesss(user_pk: Partition) -> Result<Option<RespondentAttr>> {
    let res = VerifiedAttributes::get_by_user(&user_pk)
        .await
        .unwrap_or_default()
        .unwrap_or_default();

    let age = if res.age().is_none() {
        None
    } else {
        use crate::common::attribute::Age;

        match res.age().unwrap_or_default() {
            0..=17 => Some(Age::Range {
                inclusive_max: 17,
                inclusive_min: 0,
            }),
            18..=29 => Some(Age::Range {
                inclusive_max: 29,
                inclusive_min: 18,
            }),
            30..=39 => Some(Age::Range {
                inclusive_max: 39,
                inclusive_min: 30,
            }),
            40..=49 => Some(Age::Range {
                inclusive_max: 49,
                inclusive_min: 40,
            }),
            50..=59 => Some(Age::Range {
                inclusive_max: 59,
                inclusive_min: 50,
            }),
            60..=69 => Some(Age::Range {
                inclusive_max: 69,
                inclusive_min: 60,
            }),
            _ => Some(Age::Range {
                inclusive_max: 100,
                inclusive_min: 70,
            }),
        }
    };
    // Postgres migration: `VerifiedAttributes.gender` is now the bare
    // snake_case string ("male" / "female") rather than the typed `Gender`
    // enum — parse it back the same way serde would.
    let gender = match res.gender.as_deref() {
        Some("male") => Some(crate::common::attribute::Gender::Male),
        Some("female") => Some(crate::common::attribute::Gender::Female),
        _ => None,
    };

    let school = res.university;

    Ok(Some(RespondentAttr {
        age,
        gender,
        school,
    }))
}

#[cfg(feature = "server")]
#[async_trait::async_trait]
pub trait UserAttributesExt {
    async fn get_attributes(&self) -> Result<VerifiedAttributes>;
}

#[cfg(feature = "server")]
#[async_trait::async_trait]
impl UserAttributesExt for User {
    async fn get_attributes(&self) -> Result<VerifiedAttributes> {
        Ok(VerifiedAttributes::get_by_user(&self.pk())
            .await?
            .unwrap_or_default())
    }
}
