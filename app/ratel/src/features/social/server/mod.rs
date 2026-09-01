use crate::*;

pub fn serve(app: fn() -> Element) {
    let config = config::get();

    dioxus::serve(move || {
        let session_layer = crate::common::middlewares::session_layer::get_session_layer(
            config.common.env.to_string(),
        );
        async move {
            let dioxus_router = dioxus::server::router(app);
            Ok(dioxus_router.layer(session_layer))
        }
    });
}
