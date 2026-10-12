/// Splits `total` samples equally across `cells` cells.
///
/// Every cell gets `total / cells`; the remainder goes one by one to the
/// leading cells, so `100` over `6` cells yields `[17, 17, 17, 17, 16, 16]`.
/// Returns an empty list when there are no cells.
pub fn equal_allocation(total: i64, cells: usize) -> Vec<i64> {
    if cells == 0 {
        return Vec::new();
    }
    let total = total.max(0);
    let n = cells as i64;
    let base = total / n;
    let extra = (total % n) as usize;
    (0..cells)
        .map(|i| if i < extra { base + 1 } else { base })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn spreads_the_remainder_over_leading_cells() {
        assert_eq!(equal_allocation(100, 6), vec![17, 17, 17, 17, 16, 16]);
        assert_eq!(equal_allocation(6, 4), vec![2, 2, 1, 1]);
        assert_eq!(equal_allocation(7, 4), vec![2, 2, 2, 1]);
        assert_eq!(equal_allocation(3, 2), vec![2, 1]);
    }

    #[test]
    fn handles_exact_and_short_totals() {
        assert_eq!(equal_allocation(4, 4), vec![1, 1, 1, 1]);
        assert_eq!(equal_allocation(2, 4), vec![1, 1, 0, 0]);
    }

    #[test]
    fn returns_nothing_without_cells() {
        assert!(equal_allocation(5, 0).is_empty());
    }
}
