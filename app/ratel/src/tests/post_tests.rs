use super::*;
use crate::common::types::ContentBody;

// #[tokio::test]
// async fn test_create_post_by_user() {
//     let TestContext { app, test_user, .. } = TestContext::setup().await;

//     let (status, _headers, body) = crate::test_post! {
//         app: app,
//         path: "/api/posts",
//         headers: test_user.1.clone(),
//     };

//     assert_eq!(status, 200, "create post response: {:?}", body);
// }

#[tokio::test]
async fn test_create_post_without_auth() {
    let TestContext { app, .. } = TestContext::setup().await;

    let (status, _headers, _body) = crate::test_post! {
        app: app,
        path: "/api/posts",
    };

    assert_ne!(status, 200, "unauthenticated request should fail");
}

/// Backward-compat test: rows persisted under the legacy bare-string
/// `body` shape (pre-tagged-enum `ContentBody`) must still deserialize
/// cleanly into `ContentBody::HtmlContent`.
///
/// Creates a Post via the model, then **surgically overwrites** the `body`
/// jsonb column with a bare JSON string (the legacy DynamoDB
/// `html_contents: String` shape, before `ContentBody` became a tagged
/// enum), then reads it back. Exercises `ContentBody`'s custom
/// `Deserialize` (which accepts a bare JSON string as `HtmlContent`).
#[tokio::test]
async fn legacy_html_contents_string_loads_as_html_content_body() {
    use crate::features::posts::models::Post;
    use crate::features::posts::types::{Author, PostType};
    use postgres::sqlx::{Postgres, QueryBuilder};

    let ctx = TestContext::setup().await;

    // 1) Create a normal post via the model so all indexed fields land correctly.
    let author = Author {
        pk: ctx.test_user.0.pk(),
        display_name: ctx.test_user.0.display_name.clone(),
        profile_url: ctx.test_user.0.profile_url.clone(),
        username: ctx.test_user.0.username.clone(),
        user_type: ctx.test_user.0.user_type.clone(),
    };
    let post = Post::new("Legacy title", "irrelevant initial body", PostType::Post, author);
    post.create().await.unwrap();

    // 2) Surgically rewrite the row's `body` jsonb column to the LEGACY
    //    shape: a bare JSON string instead of the tagged
    //    `{"content_type": ..., "data": ...}` object. The model must still
    //    read this row as `ContentBody::HtmlContent` thanks to
    //    `ContentBody`'s custom Deserialize.
    let mut qb = QueryBuilder::<Postgres>::new("UPDATE \"posts\" SET \"body\" = ");
    postgres::Value::Json(serde_json::Value::String("<p>legacy body</p>".to_string()))
        .push_bind(&mut qb);
    qb.push(" WHERE \"id\" = ");
    postgres::Value::from(post.id).push_bind(&mut qb);
    Post::repository().db().execute(qb).await.unwrap();

    // 3) Read via the model.
    let loaded = Post::get_by_feed_id(post.id)
        .await
        .unwrap()
        .expect("post should be present");
    assert_eq!(
        loaded.body.0,
        ContentBody::HtmlContent("<p>legacy body</p>".into()),
    );
}
