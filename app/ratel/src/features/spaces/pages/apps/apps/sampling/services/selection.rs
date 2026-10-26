use std::collections::{HashMap, HashSet};

use rand::seq::SliceRandom;
use uuid::Uuid;

/// A population member eligible for the random draw.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DrawCandidate {
    pub id: Uuid,
    pub cell_key: String,
    pub unique_keys: Vec<String>,
}

/// Draws the random sample in one pass over a uniformly shuffled
/// population.
///
/// A candidate is taken when their cell still has a seat in `seats` and
/// none of their unique keys belongs to an already drawn candidate. Without
/// unique keys every cell ends up with a uniformly random subset of
/// `min(seats, members)` of its members. Returns the drawn candidates in
/// draw order.
pub fn draw_unique<R: rand::Rng + ?Sized>(
    mut candidates: Vec<DrawCandidate>,
    seats: &HashMap<String, usize>,
    rng: &mut R,
) -> Vec<DrawCandidate> {
    candidates.shuffle(rng);
    let mut left = seats.clone();
    let mut taken: HashSet<String> = HashSet::new();
    let mut drawn = Vec::new();
    for candidate in candidates {
        let Some(free) = left.get_mut(&candidate.cell_key) else {
            continue;
        };
        if *free == 0 || candidate.unique_keys.iter().any(|k| taken.contains(k)) {
            continue;
        }
        *free -= 1;
        taken.extend(candidate.unique_keys.iter().cloned());
        drawn.push(candidate);
    }
    drawn
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::SeedableRng;

    fn candidate(cell: &str, keys: &[&str]) -> DrawCandidate {
        DrawCandidate {
            id: Uuid::new_v4(),
            cell_key: cell.to_string(),
            unique_keys: keys.iter().map(|k| k.to_string()).collect(),
        }
    }

    fn seats(pairs: &[(&str, usize)]) -> HashMap<String, usize> {
        pairs.iter().map(|(k, v)| (k.to_string(), *v)).collect()
    }

    fn count_in(drawn: &[DrawCandidate], cell: &str) -> usize {
        drawn.iter().filter(|c| c.cell_key == cell).count()
    }

    fn ids(drawn: &[DrawCandidate]) -> HashSet<Uuid> {
        drawn.iter().map(|c| c.id).collect()
    }

    #[test]
    fn respects_cell_capacity() {
        let pool: Vec<_> = (0..10)
            .map(|i| candidate(if i % 2 == 0 { "a" } else { "b" }, &[]))
            .chain(std::iter::once(candidate("unknown", &[])))
            .collect();
        for seed in 0..20 {
            let mut rng = rand::rngs::StdRng::seed_from_u64(seed);
            let drawn = draw_unique(pool.clone(), &seats(&[("a", 3), ("b", 0)]), &mut rng);
            assert_eq!(count_in(&drawn, "a"), 3);
            assert_eq!(count_in(&drawn, "b"), 0);
            assert_eq!(count_in(&drawn, "unknown"), 0);
        }
    }

    #[test]
    fn takes_everyone_when_seats_exceed_members() {
        let pool = vec![candidate("a", &[]), candidate("a", &[])];
        let mut rng = rand::rngs::StdRng::seed_from_u64(1);
        let drawn = draw_unique(pool.clone(), &seats(&[("a", 5)]), &mut rng);
        assert_eq!(ids(&drawn), ids(&pool));
    }

    #[test]
    fn excludes_members_sharing_any_key() {
        let pool = vec![
            candidate("a", &["phone1", "mail1"]),
            candidate("b", &["phone1"]),
            candidate("a", &["phone2", "mail1"]),
            candidate("b", &["phone3", "mail3"]),
        ];
        let first_alone = ids(&[pool[0].clone(), pool[3].clone()]);
        let others = ids(&[pool[1].clone(), pool[2].clone(), pool[3].clone()]);
        let mut outcomes = HashSet::new();
        for seed in 0..50 {
            let mut rng = rand::rngs::StdRng::seed_from_u64(seed);
            let drawn = ids(&draw_unique(
                pool.clone(),
                &seats(&[("a", 5), ("b", 5)]),
                &mut rng,
            ));
            assert!(
                drawn == first_alone || drawn == others,
                "seed {seed}: {drawn:?}"
            );
            outcomes.insert(drawn == first_alone);
        }
        assert_eq!(outcomes.len(), 2, "both outcomes must be reachable");
    }

    #[test]
    fn keyless_members_are_unconstrained() {
        let pool = vec![
            candidate("a", &[]),
            candidate("a", &[]),
            candidate("a", &["k"]),
            candidate("a", &["k"]),
        ];
        for seed in 0..20 {
            let mut rng = rand::rngs::StdRng::seed_from_u64(seed);
            let drawn = draw_unique(pool.clone(), &seats(&[("a", 4)]), &mut rng);
            assert_eq!(drawn.len(), 3, "seed {seed}");
            assert!(drawn.contains(&pool[0]) && drawn.contains(&pool[1]));
        }
    }

    #[test]
    fn a_blocked_member_does_not_use_a_seat() {
        let pool = vec![
            candidate("a", &["k"]),
            candidate("b", &["k"]),
            candidate("b", &["other"]),
        ];
        for seed in 0..20 {
            let mut rng = rand::rngs::StdRng::seed_from_u64(seed);
            let drawn = draw_unique(pool.clone(), &seats(&[("a", 1), ("b", 1)]), &mut rng);
            assert_eq!(count_in(&drawn, "b"), 1, "seed {seed}");
            let shared = drawn
                .iter()
                .filter(|c| c.unique_keys.contains(&"k".to_string()))
                .count();
            assert_eq!(shared, 1, "seed {seed}");
        }
    }

    #[test]
    fn every_member_can_be_drawn() {
        let pool: Vec<_> = (0..4).map(|_| candidate("a", &[])).collect();
        let mut hits: HashMap<Uuid, usize> = HashMap::new();
        for seed in 0..200 {
            let mut rng = rand::rngs::StdRng::seed_from_u64(seed);
            for c in draw_unique(pool.clone(), &seats(&[("a", 1)]), &mut rng) {
                *hits.entry(c.id).or_default() += 1;
            }
        }
        assert_eq!(hits.len(), 4);
        assert!(hits.values().all(|n| *n >= 20), "{hits:?}");
    }
}
