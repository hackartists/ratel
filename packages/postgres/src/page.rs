/// `find` 의 페이지네이션 결과 — 조회된 행(`items`)과 함께, 같은 WHERE 조건에
/// 대한 전체 개수(`total_count`, `COUNT(*) OVER()` 윈도우 집계로 한 번의 쿼리에서
/// 산출)와 페이지 메타데이터를 담는다.
///
/// 페이징 없이(`page_size` 미지정) `find` 를 호출하면 모든 행이 `items` 에 담기고
/// `page == 1`, `page_size == total_count`, `total_pages == 1` 이 된다.
#[derive(Debug, Clone)]
pub struct Page<T> {
    /// 이 페이지의 행들 (eager hydrate 까지 완료된 상태).
    pub items: Vec<T>,
    /// 1-based 현재 페이지 번호.
    pub page: i64,
    /// 페이지 크기. 페이징 없이 조회하면 `total_count` 와 같다.
    pub page_size: i64,
    /// WHERE 조건에 매칭되는 전체 행 수 (LIMIT/OFFSET 무시).
    pub total_count: i64,
    /// 전체 페이지 수 (`ceil(total_count / page_size)`; `total_count == 0` 이면 1).
    pub total_pages: i64,
}
