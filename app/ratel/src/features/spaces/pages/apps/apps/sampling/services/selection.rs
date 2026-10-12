use rand::seq::SliceRandom;
use uuid::Uuid;

/// Draws `min(k, ids.len())` distinct ids uniformly at random.
pub fn pick_random<R: rand::Rng + ?Sized>(mut ids: Vec<Uuid>, k: usize, rng: &mut R) -> Vec<Uuid> {
    ids.shuffle(rng);
    ids.truncate(k);
    ids
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::SeedableRng;
    use std::collections::HashSet;

    fn ids(n: usize) -> Vec<Uuid> {
        (0..n).map(|_| Uuid::new_v4()).collect()
    }

    #[test]
    fn picks_k_distinct_members_of_the_input() {
        let mut rng = rand::rngs::StdRng::seed_from_u64(7);
        let all = ids(10);
        let picked = pick_random(all.clone(), 3, &mut rng);
        assert_eq!(picked.len(), 3);
        let unique: HashSet<_> = picked.iter().collect();
        assert_eq!(unique.len(), 3);
        assert!(picked.iter().all(|id| all.contains(id)));
    }

    #[test]
    fn returns_everyone_when_k_exceeds_population() {
        let mut rng = rand::rngs::StdRng::seed_from_u64(1);
        let all = ids(2);
        let picked = pick_random(all.clone(), 5, &mut rng);
        assert_eq!(picked.len(), 2);
        assert!(all.iter().all(|id| picked.contains(id)));
    }

    #[test]
    fn returns_nothing_when_k_is_zero() {
        let mut rng = rand::rngs::StdRng::seed_from_u64(3);
        assert!(pick_random(ids(4), 0, &mut rng).is_empty());
    }
}
