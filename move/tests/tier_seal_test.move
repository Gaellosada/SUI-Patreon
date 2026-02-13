#[test_only]
module patreon_copy::tier_seal_tests;

use patreon_copy::tier_seal;
use sui::clock;
use sui::test_scenario;

/// Test creating registry, setting tier requirement, and seal_approve succeeds when tier is sufficient.
#[test]
fun test_seal_approve_success() {
    let ctx = &mut tx_context::dummy();
    let (cap, mut registry) = tier_seal::create_registry(ctx);
    let content_key = b"premium_post";
    tier_seal::set_required_tier(&mut registry, &cap, content_key, 2);
    let membership = tier_seal::create_membership(2, ctx);
    let clock = clock::create_for_testing(ctx);

    let id = tier_seal::build_seal_id_for_test(&registry, content_key);
    tier_seal::seal_approve(id, &registry, &membership, &clock);
    clock::destroy_for_testing(clock);
    tier_seal::destroy_for_testing(registry, cap, membership);
}

/// Test seal_approve fails when user's tier is below required.
#[test, expected_failure(abort_code = patreon_copy::tier_seal::ENoAccess)]
fun test_seal_approve_fail_insufficient_tier() {
    let ctx = &mut tx_context::dummy();
    let (cap, mut registry) = tier_seal::create_registry(ctx);
    let content_key = b"vip_content";
    tier_seal::set_required_tier(&mut registry, &cap, content_key, 3);
    let membership = tier_seal::create_membership(1, ctx);
    let clock = clock::create_for_testing(ctx);

    let id = tier_seal::build_seal_id_for_test(&registry, content_key);
    tier_seal::seal_approve(id, &registry, &membership, &clock);
    clock::destroy_for_testing(clock);
    tier_seal::destroy_for_testing(registry, cap, membership);
}

/// Test seal_approve succeeds for temporary membership when not expired.
#[test]
fun test_seal_approve_temp_membership_before_expiry() {
    let ctx = &mut tx_context::dummy();
    let (cap, mut registry) = tier_seal::create_registry(ctx);
    tier_seal::set_required_tier(&mut registry, &cap, b"content", 1);
    let clock = clock::create_for_testing(ctx);
    // Membership expires in 30 days; clock is at 0, so valid.
    let expires_at = 30 * 24 * 60 * 60 * 1000;
    let membership = tier_seal::create_membership_with_expiry(1, expires_at, ctx);
    let id = tier_seal::build_seal_id_for_test(&registry, b"content");
    tier_seal::seal_approve(id, &registry, &membership, &clock);
    clock::destroy_for_testing(clock);
    tier_seal::destroy_for_testing(registry, cap, membership);
}

/// Test seal_approve fails when temporary membership has expired.
#[test, expected_failure(abort_code = patreon_copy::tier_seal::EMembershipExpired)]
fun test_seal_approve_fail_expired_membership() {
    let ctx = &mut tx_context::dummy();
    let (cap, mut registry) = tier_seal::create_registry(ctx);
    tier_seal::set_required_tier(&mut registry, &cap, b"content", 1);
    let mut clock = clock::create_for_testing(ctx);
    let membership = tier_seal::create_membership_with_expiry(1, 1000, ctx); // expires at 1000ms
    clock::increment_for_testing(&mut clock, 2000); // now = 2000 > 1000
    let id = tier_seal::build_seal_id_for_test(&registry, b"content");
    tier_seal::seal_approve(id, &registry, &membership, &clock);
    clock::destroy_for_testing(clock);
    tier_seal::destroy_for_testing(registry, cap, membership);
}

/// Test create_and_share_registry entry and that cap is transferred to sender.
#[test]
fun test_create_and_share_registry() {
    let mut scenario = test_scenario::begin(@0x1);
    tier_seal::create_and_share_registry(scenario.ctx());
    scenario.next_tx(@0x1);
    let cap = test_scenario::take_from_sender<patreon_copy::tier_seal::TierRegistryCap>(&scenario);
    test_scenario::return_to_sender(&scenario, cap);
    scenario.end();
}
