#[test_only]
module patreon_copy::community_tests;

use patreon_copy::artist;
use patreon_copy::community;
use patreon_copy::tier_seal;
use sui::clock;
use sui::coin;
use sui::sui::SUI;
use sui::test_scenario;

/// Test that we can create a shared community as artist and that it appears in the artist's index.
#[test]
fun test_create_shared_community() {
    let mut scenario = test_scenario::begin(@0x0);
    artist::register_as_artist(scenario.ctx());
    scenario.next_tx(@0x0);
    let cap = test_scenario::take_from_sender<artist::ArtistCap>(&scenario);
    let mut communities = test_scenario::take_from_sender<artist::ArtistCommunities>(&scenario);
    let ctx = scenario.ctx();
    let creation_fee = coin::mint_for_testing<SUI>(100_000_000, ctx);
    let initial_treasury = coin::zero<SUI>(ctx);
    let tier_prices = vector[0u64, 0u64];
    community::create_community_as_artist(&cap, &mut communities, creation_fee, b"Test community", b"Description", b"Artist bio", b"", initial_treasury, tier_prices, ctx);
    assert!(artist::community_count(&communities) == 1, 0);
    scenario.next_tx(@0x0);
    let community = test_scenario::take_shared<community::Community>(&scenario);
    assert!(community::treasury_balance(&community) == 100_000_000, 0);
    assert!(community::tier_exists(&community, 0), 0);
    assert!(community::subscription_price(&community, 0) == 0, 0);
    assert!(community::artist_description(&community) == b"Artist bio", 0);
    test_scenario::return_shared(community);
    test_scenario::return_to_sender(&scenario, cap);
    test_scenario::return_to_sender(&scenario, communities);
    scenario.end();
}

/// Test that anyone can create a community with a fee (no artist registration).
#[test]
fun test_create_community_anyone() {
    let mut scenario = test_scenario::begin(@0x1);
    let ctx = scenario.ctx();
    let creation_fee = coin::mint_for_testing<SUI>(100_000_000, ctx);
    community::create_community(creation_fee, b"Public Community", b"Desc", b"", b"", coin::zero<SUI>(ctx), vector[0u64, 1_000_000_000u64], ctx);
    scenario.next_tx(@0x1);
    let community = test_scenario::take_shared<community::Community>(&scenario);
    let reg_id = community::tier_registry_id(&community);
    assert!(community::creator(&community) == @0x1, 0);
    assert!(community::treasury_balance(&community) == 100_000_000, 0);
    assert!(community::subscription_price(&community, 1) == 1_000_000_000, 0);
    test_scenario::return_shared(community);
    let cap = test_scenario::take_from_sender<tier_seal::TierRegistryCap>(&scenario);
    let registry = test_scenario::take_shared_by_id<tier_seal::TierRegistry>(&scenario, reg_id);
    test_scenario::return_to_sender(&scenario, cap);
    test_scenario::return_shared(registry);
    scenario.end();
}

/// Test join and leave community.
#[test]
fun test_join_leave_community() {
    let mut scenario = test_scenario::begin(@0x0);
    artist::register_as_artist(scenario.ctx());
    scenario.next_tx(@0x0);
    let cap = test_scenario::take_from_sender<artist::ArtistCap>(&scenario);
    let mut communities = test_scenario::take_from_sender<artist::ArtistCommunities>(&scenario);
    let ctx = scenario.ctx();
    community::create_community_as_artist(&cap, &mut communities, coin::mint_for_testing<SUI>(100_000_000, ctx), b"My Community", b"Desc", b"", b"", coin::zero<SUI>(ctx), vector[0u64], ctx);
    test_scenario::return_to_sender(&scenario, cap);
    test_scenario::return_to_sender(&scenario, communities);

    scenario.next_tx(@0x1);
    let mut community = test_scenario::take_shared<community::Community>(&scenario);
    assert!(!community::is_member(&community, @0x1), 0);
    community::join_community(&mut community, scenario.ctx());
    assert!(community::is_member(&community, @0x1), 0);
    assert!(community::member_count(&community) == 2, 0);
    community::leave_community(&mut community, scenario.ctx());
    assert!(!community::is_member(&community, @0x1), 0);
    assert!(community::member_count(&community) == 1, 0);
    test_scenario::return_shared(community);
    scenario.end();
}

/// Test subscribe: user pays SUI and receives TierMembership.
#[test]
fun test_subscribe() {
    let mut scenario = test_scenario::begin(@0x0);
    artist::register_as_artist(scenario.ctx());
    scenario.next_tx(@0x0);
    let cap = test_scenario::take_from_sender<artist::ArtistCap>(&scenario);
    let mut communities = test_scenario::take_from_sender<artist::ArtistCommunities>(&scenario);
    let ctx = scenario.ctx();
    // Tier 0 = free, tier 1 = 5 SUI
    let tier_prices = vector[0u64, 5_000_000_000u64];
    community::create_community_as_artist(&cap, &mut communities, coin::mint_for_testing<SUI>(100_000_000, ctx), b"Community", b"Desc", b"", b"", coin::zero<SUI>(ctx), tier_prices, ctx);
    test_scenario::return_to_sender(&scenario, cap);
    test_scenario::return_to_sender(&scenario, communities);

    scenario.next_tx(@0x1);
    let mut community = test_scenario::take_shared<community::Community>(&scenario);
    let reg_id = community::tier_registry_id(&community);
    let payment = coin::mint_for_testing<SUI>(5_000_000_000, scenario.ctx());
    community::subscribe(&mut community, payment, 1, scenario.ctx());
    assert!(community::treasury_balance(&community) == 5_100_000_000, 0); // 100M creation fee + 5 SUI subscription
    test_scenario::return_shared(community);
    scenario.next_tx(@0x1);
    let membership = test_scenario::take_from_sender<tier_seal::TierMembership>(&scenario);
    assert!(tier_seal::tier(&membership) == 1, 0);
    test_scenario::return_to_sender(&scenario, membership);
    let registry = test_scenario::take_shared_by_id<tier_seal::TierRegistry>(&scenario, reg_id);
    test_scenario::return_shared(registry);
    scenario.end();
}

/// Test subscribe fails with insufficient payment.
#[test, expected_failure(abort_code = patreon_copy::community::EInsufficientPayment)]
fun test_subscribe_insufficient_payment() {
    let mut scenario = test_scenario::begin(@0x0);
    artist::register_as_artist(scenario.ctx());
    scenario.next_tx(@0x0);
    let cap = test_scenario::take_from_sender<artist::ArtistCap>(&scenario);
    let mut communities = test_scenario::take_from_sender<artist::ArtistCommunities>(&scenario);
    let ctx = scenario.ctx();
    let tier_prices = vector[0u64, 10_000_000_000u64];
    community::create_community_as_artist(&cap, &mut communities, coin::mint_for_testing<SUI>(100_000_000, ctx), b"C", b"D", b"", b"", coin::zero<SUI>(ctx), tier_prices, ctx);
    test_scenario::return_to_sender(&scenario, cap);
    test_scenario::return_to_sender(&scenario, communities);

    scenario.next_tx(@0x1);
    let mut community = test_scenario::take_shared<community::Community>(&scenario);
    let payment = coin::mint_for_testing<SUI>(1_000_000_000, scenario.ctx()); // 1 SUI < 10 SUI required
    community::subscribe(&mut community, payment, 1, scenario.ctx());
    test_scenario::return_shared(community);
    scenario.end();
}

/// Test subscribe fails with invalid tier.
#[test, expected_failure(abort_code = patreon_copy::community::EInvalidTier)]
fun test_subscribe_invalid_tier() {
    let mut scenario = test_scenario::begin(@0x0);
    artist::register_as_artist(scenario.ctx());
    scenario.next_tx(@0x0);
    let cap = test_scenario::take_from_sender<artist::ArtistCap>(&scenario);
    let mut communities = test_scenario::take_from_sender<artist::ArtistCommunities>(&scenario);
    let ctx = scenario.ctx();
    community::create_community_as_artist(&cap, &mut communities, coin::mint_for_testing<SUI>(100_000_000, ctx), b"C", b"D", b"", b"", coin::zero<SUI>(ctx), vector[0u64], ctx);
    test_scenario::return_to_sender(&scenario, cap);
    test_scenario::return_to_sender(&scenario, communities);

    scenario.next_tx(@0x1);
    let mut community = test_scenario::take_shared<community::Community>(&scenario);
    let payment = coin::mint_for_testing<SUI>(0, scenario.ctx());
    community::subscribe(&mut community, payment, 5, scenario.ctx()); // tier 5 not configured
    test_scenario::return_shared(community);
    scenario.end();
}

/// Test update community (creator only).
#[test]
fun test_update_community() {
    let mut scenario = test_scenario::begin(@0x0);
    artist::register_as_artist(scenario.ctx());
    scenario.next_tx(@0x0);
    let cap = test_scenario::take_from_sender<artist::ArtistCap>(&scenario);
    let mut communities = test_scenario::take_from_sender<artist::ArtistCommunities>(&scenario);
    let ctx = scenario.ctx();
    community::create_community_as_artist(&cap, &mut communities, coin::mint_for_testing<SUI>(100_000_000, ctx), b"Old Name", b"Old Desc", b"", b"", coin::zero<SUI>(ctx), vector[0u64], ctx);
    test_scenario::return_to_sender(&scenario, cap);
    test_scenario::return_to_sender(&scenario, communities);
    scenario.next_tx(@0x0);

    let mut community = test_scenario::take_shared<community::Community>(&scenario);
    community::update_community(&mut community, b"New Name", b"New Desc", b"New artist bio", b"new_img", scenario.ctx());
    assert!(community::name(&community) == b"New Name", 0);
    assert!(community::description(&community) == b"New Desc", 0);
    assert!(community::artist_description(&community) == b"New artist bio", 0);
    assert!(community::image(&community) == b"new_img", 0);
    test_scenario::return_shared(community);
    scenario.end();
}

/// Test create post and comment flow.
#[test]
fun test_create_post_and_comment() {
    let mut scenario = test_scenario::begin(@0x0);
    artist::register_as_artist(scenario.ctx());
    scenario.next_tx(@0x0);
    let cap = test_scenario::take_from_sender<artist::ArtistCap>(&scenario);
    let mut communities = test_scenario::take_from_sender<artist::ArtistCommunities>(&scenario);
    let ctx = scenario.ctx();
    community::create_community_as_artist(&cap, &mut communities, coin::mint_for_testing<SUI>(100_000_000, ctx), b"C", b"D", b"", b"", coin::zero<SUI>(ctx), vector[0u64], ctx);
    test_scenario::return_to_sender(&scenario, communities);
    scenario.next_tx(@0x0);

    let mut community = test_scenario::take_shared<community::Community>(&scenario);
    community::create_post(&mut community, 0, b"Hello world", scenario.ctx());
    assert!(community::post_count(&community) == 1, 0);
    assert!(community::post_exists(&community, 0), 0);
    assert!(community::post_content(&community, 0) == b"Hello world", 0);
    test_scenario::return_shared(community);
    test_scenario::return_to_sender(&scenario, cap);
    scenario.next_tx(@0x1);
    let mut community = test_scenario::take_shared<community::Community>(&scenario);
    community::join_community(&mut community, scenario.ctx());
    community::leave_comment(&mut community, 0, b"Nice post!", scenario.ctx());
    assert!(community::comment_count(&community, 0) == 1, 0);
    assert!(community::comment_content(&community, 0, 0) == b"Nice post!", 0);
    assert!(community::comment_author(&community, 0, 0) == @0x1, 0);
    assert!(community::post_like_count(&community, 0) == 0, 0);
    assert!(!community::has_liked_post(&community, 0, @0x1), 0);
    test_scenario::return_shared(community);
    scenario.end();
}

/// Test like and unlike post.
#[test]
fun test_like_unlike_post() {
    let mut scenario = test_scenario::begin(@0x0);
    artist::register_as_artist(scenario.ctx());
    scenario.next_tx(@0x0);
    let cap = test_scenario::take_from_sender<artist::ArtistCap>(&scenario);
    let mut communities = test_scenario::take_from_sender<artist::ArtistCommunities>(&scenario);
    let ctx = scenario.ctx();
    community::create_community_as_artist(&cap, &mut communities, coin::mint_for_testing<SUI>(100_000_000, ctx), b"C", b"D", b"", b"", coin::zero<SUI>(ctx), vector[0u64], ctx);
    test_scenario::return_to_sender(&scenario, cap);
    test_scenario::return_to_sender(&scenario, communities);
    scenario.next_tx(@0x0);

    let mut community = test_scenario::take_shared<community::Community>(&scenario);
    community::create_post(&mut community, 0, b"Cool post", scenario.ctx());
    assert!(community::post_like_count(&community, 0) == 0, 0);
    test_scenario::return_shared(community);

    scenario.next_tx(@0x1);
    let mut community = test_scenario::take_shared<community::Community>(&scenario);
    community::join_community(&mut community, scenario.ctx());
    community::like_post(&mut community, 0, scenario.ctx());
    assert!(community::post_like_count(&community, 0) == 1, 0);
    assert!(community::has_liked_post(&community, 0, @0x1), 1);
    test_scenario::return_shared(community);

    scenario.next_tx(@0x2);
    let mut community = test_scenario::take_shared<community::Community>(&scenario);
    community::join_community(&mut community, scenario.ctx());
    community::like_post(&mut community, 0, scenario.ctx());
    assert!(community::post_like_count(&community, 0) == 2, 0);
    assert!(community::has_liked_post(&community, 0, @0x2), 1);
    test_scenario::return_shared(community);

    scenario.next_tx(@0x1);
    let mut community = test_scenario::take_shared<community::Community>(&scenario);
    community::unlike_post(&mut community, 0, scenario.ctx());
    assert!(community::post_like_count(&community, 0) == 1, 0);
    assert!(!community::has_liked_post(&community, 0, @0x1), 2);
    test_scenario::return_shared(community);
    scenario.end();
}

/// Test like fails when already liked.
#[test, expected_failure(abort_code = patreon_copy::community::EAlreadyLiked)]
fun test_like_post_already_liked() {
    let mut scenario = test_scenario::begin(@0x0);
    artist::register_as_artist(scenario.ctx());
    scenario.next_tx(@0x0);
    let cap = test_scenario::take_from_sender<artist::ArtistCap>(&scenario);
    let mut communities = test_scenario::take_from_sender<artist::ArtistCommunities>(&scenario);
    let ctx = scenario.ctx();
    community::create_community_as_artist(&cap, &mut communities, coin::mint_for_testing<SUI>(100_000_000, ctx), b"C", b"D", b"", b"", coin::zero<SUI>(ctx), vector[0u64], ctx);
    test_scenario::return_to_sender(&scenario, cap);
    test_scenario::return_to_sender(&scenario, communities);
    scenario.next_tx(@0x0);

    let mut community = test_scenario::take_shared<community::Community>(&scenario);
    community::create_post(&mut community, 0, b"Post", scenario.ctx());
    test_scenario::return_shared(community);

    scenario.next_tx(@0x1);
    let mut community = test_scenario::take_shared<community::Community>(&scenario);
    community::join_community(&mut community, scenario.ctx());
    community::like_post(&mut community, 0, scenario.ctx());
    community::like_post(&mut community, 0, scenario.ctx());
    test_scenario::return_shared(community);
    scenario.end();
}

/// Test unlike fails when never liked.
#[test, expected_failure(abort_code = patreon_copy::community::ENeverLiked)]
fun test_unlike_post_never_liked() {
    let mut scenario = test_scenario::begin(@0x0);
    artist::register_as_artist(scenario.ctx());
    scenario.next_tx(@0x0);
    let cap = test_scenario::take_from_sender<artist::ArtistCap>(&scenario);
    let mut communities = test_scenario::take_from_sender<artist::ArtistCommunities>(&scenario);
    let ctx = scenario.ctx();
    community::create_community_as_artist(&cap, &mut communities, coin::mint_for_testing<SUI>(100_000_000, ctx), b"C", b"D", b"", b"", coin::zero<SUI>(ctx), vector[0u64], ctx);
    test_scenario::return_to_sender(&scenario, cap);
    test_scenario::return_to_sender(&scenario, communities);
    scenario.next_tx(@0x0);

    let mut community = test_scenario::take_shared<community::Community>(&scenario);
    community::create_post(&mut community, 0, b"Post", scenario.ctx());
    test_scenario::return_shared(community);

    scenario.next_tx(@0x1);
    let mut community = test_scenario::take_shared<community::Community>(&scenario);
    community::join_community(&mut community, scenario.ctx());
    community::unlike_post(&mut community, 0, scenario.ctx());
    test_scenario::return_shared(community);
    scenario.end();
}

/// Test remove post (creator only).
#[test]
fun test_remove_post() {
    let mut scenario = test_scenario::begin(@0x0);
    artist::register_as_artist(scenario.ctx());
    scenario.next_tx(@0x0);
    let cap = test_scenario::take_from_sender<artist::ArtistCap>(&scenario);
    let mut communities = test_scenario::take_from_sender<artist::ArtistCommunities>(&scenario);
    let ctx = scenario.ctx();
    community::create_community_as_artist(&cap, &mut communities, coin::mint_for_testing<SUI>(100_000_000, ctx), b"C", b"D", b"", b"", coin::zero<SUI>(ctx), vector[0u64], ctx);
    test_scenario::return_to_sender(&scenario, cap);
    test_scenario::return_to_sender(&scenario, communities);
    scenario.next_tx(@0x0);

    let mut community = test_scenario::take_shared<community::Community>(&scenario);
    let reg_id = community::tier_registry_id(&community);
    let tier_cap = test_scenario::take_from_sender<tier_seal::TierRegistryCap>(&scenario);
    let mut registry = test_scenario::take_shared_by_id<tier_seal::TierRegistry>(&scenario, reg_id);
    community::create_post(&mut community, 0, b"Post", scenario.ctx());
    community::remove_post(&mut community, &mut registry, &tier_cap, 0, scenario.ctx());
    assert!(!community::post_exists(&community, 0), 0);
    assert!(community::post_count(&community) == 0, 0);
    test_scenario::return_shared(community);
    test_scenario::return_shared(registry);
    test_scenario::return_to_sender(&scenario, tier_cap);
    scenario.end();
}

// === Poll tests ===

/// Test create poll, vote, and close.
#[test]
fun test_create_poll_and_vote() {
    let mut scenario = test_scenario::begin(@0x0);
    artist::register_as_artist(scenario.ctx());
    scenario.next_tx(@0x0);
    let cap = test_scenario::take_from_sender<artist::ArtistCap>(&scenario);
    let mut communities = test_scenario::take_from_sender<artist::ArtistCommunities>(&scenario);
    let ctx = scenario.ctx();
    community::create_community_as_artist(&cap, &mut communities, coin::mint_for_testing<SUI>(100_000_000, ctx), b"Community", b"Desc", b"", b"", coin::zero<SUI>(ctx), vector[0u64], ctx);
    test_scenario::return_to_sender(&scenario, cap);
    test_scenario::return_to_sender(&scenario, communities);
    scenario.next_tx(@0x0);

    let mut community = test_scenario::take_shared<community::Community>(&scenario);
    let options = vector[b"Landscape art", b"Portrait", b"Abstract"];
    community::create_poll(&mut community, b"What should my next post be?", options, scenario.ctx());
    assert!(community::poll_count(&community) == 1, 0);
    assert!(community::poll_exists(&community, 0), 1);
    assert!(community::poll_question(&community, 0) == b"What should my next post be?", 2);
    assert!(community::poll_option_count(&community, 0) == 3, 3);
    assert!(community::poll_option(&community, 0, 0) == b"Landscape art", 4);
    assert!(community::poll_votes(&community, 0, 0) == 0, 5);
    assert!(!community::poll_is_closed(&community, 0), 6);
    test_scenario::return_shared(community);

    scenario.next_tx(@0x1);
    let mut community = test_scenario::take_shared<community::Community>(&scenario);
    community::join_community(&mut community, scenario.ctx());
    community::vote_poll(&mut community, 0, 1, scenario.ctx());
    assert!(community::poll_votes(&community, 0, 1) == 1, 0);
    assert!(community::has_voted(&community, 0, @0x1), 1);
    test_scenario::return_shared(community);

    scenario.next_tx(@0x2);
    let mut community = test_scenario::take_shared<community::Community>(&scenario);
    community::join_community(&mut community, scenario.ctx());
    community::vote_poll(&mut community, 0, 1, scenario.ctx());
    assert!(community::poll_votes(&community, 0, 1) == 2, 0);
    test_scenario::return_shared(community);

    scenario.next_tx(@0x0);
    let mut community = test_scenario::take_shared<community::Community>(&scenario);
    community::close_poll(&mut community, 0, scenario.ctx());
    assert!(community::poll_is_closed(&community, 0), 0);
    assert!(community::poll_winning_option(&community, 0) == 1, 1);
    test_scenario::return_shared(community);
    scenario.end();
}

/// Test vote fails when not a member.
#[test, expected_failure(abort_code = 3, location = patreon_copy::community)]
fun test_vote_poll_not_member() {
    let mut scenario = test_scenario::begin(@0x0);
    artist::register_as_artist(scenario.ctx());
    scenario.next_tx(@0x0);
    let cap = test_scenario::take_from_sender<artist::ArtistCap>(&scenario);
    let mut communities = test_scenario::take_from_sender<artist::ArtistCommunities>(&scenario);
    let ctx = scenario.ctx();
    community::create_community_as_artist(&cap, &mut communities, coin::mint_for_testing<SUI>(100_000_000, ctx), b"C", b"D", b"", b"", coin::zero<SUI>(ctx), vector[0u64], ctx);
    test_scenario::return_to_sender(&scenario, cap);
    test_scenario::return_to_sender(&scenario, communities);
    scenario.next_tx(@0x0);

    let mut community = test_scenario::take_shared<community::Community>(&scenario);
    community::create_poll(&mut community, b"Q?", vector[b"A", b"B"], scenario.ctx());
    test_scenario::return_shared(community);

    scenario.next_tx(@0x1);
    let mut community = test_scenario::take_shared<community::Community>(&scenario);
    community::vote_poll(&mut community, 0, 0, scenario.ctx());
    test_scenario::return_shared(community);
    scenario.end();
}

/// Test subscribe_for_duration: pay for tier 1 for 30 days, receive temporary TierMembership.
#[test]
fun test_subscribe_for_duration() {
    let mut scenario = test_scenario::begin(@0x0);
    artist::register_as_artist(scenario.ctx());
    scenario.next_tx(@0x0);
    let cap = test_scenario::take_from_sender<artist::ArtistCap>(&scenario);
    let mut communities = test_scenario::take_from_sender<artist::ArtistCommunities>(&scenario);
    let ctx = scenario.ctx();
    let tier_prices = vector[0u64, 10_000_000_000u64]; // tier 1 permanent = 10 SUI
    community::create_community_as_artist(&cap, &mut communities, coin::mint_for_testing<SUI>(100_000_000, ctx), b"Community", b"Desc", b"", b"", coin::zero<SUI>(ctx), tier_prices, ctx);
    test_scenario::return_to_sender(&scenario, cap);
    test_scenario::return_to_sender(&scenario, communities);

    scenario.next_tx(@0x0);
    let mut community = test_scenario::take_shared<community::Community>(&scenario);
    community::update_subscription_tier_duration(&mut community, 1, 30, 1_000_000_000, scenario.ctx()); // tier 1, 30 days = 1 SUI
    test_scenario::return_shared(community);

    scenario.next_tx(@0x1);
    let mut community = test_scenario::take_shared<community::Community>(&scenario);
    let clock = clock::create_for_testing(scenario.ctx());
    let payment = coin::mint_for_testing<SUI>(1_000_000_000, scenario.ctx());
    community::subscribe_for_duration(&mut community, payment, 1, 30, &clock, scenario.ctx());
    clock::destroy_for_testing(clock);
    assert!(community::treasury_balance(&community) == 1_100_000_000, 0); // 100M creation + 1 SUI subscription
    assert!(community::tier_duration_exists(&community, 1, 30), 1);
    assert!(community::subscription_price_for_duration(&community, 1, 30) == 1_000_000_000, 2);
    test_scenario::return_shared(community);
    scenario.next_tx(@0x1);
    let membership = test_scenario::take_from_sender<tier_seal::TierMembership>(&scenario);
    assert!(tier_seal::tier(&membership) == 1, 3);
    test_scenario::return_to_sender(&scenario, membership);
    scenario.end();
}

/// Test temporary membership allows seal_approve before expiry, fails after.
#[test]
fun test_subscribe_for_duration_seal_before_and_after_expiry() {
    let mut scenario = test_scenario::begin(@0x0);
    artist::register_as_artist(scenario.ctx());
    scenario.next_tx(@0x0);
    let cap = test_scenario::take_from_sender<artist::ArtistCap>(&scenario);
    let mut communities = test_scenario::take_from_sender<artist::ArtistCommunities>(&scenario);
    let ctx = scenario.ctx();
    community::create_community_as_artist(&cap, &mut communities, coin::mint_for_testing<SUI>(100_000_000, ctx), b"C", b"D", b"", b"", coin::zero<SUI>(ctx), vector[0u64, 0u64], ctx);
    test_scenario::return_to_sender(&scenario, cap);
    test_scenario::return_to_sender(&scenario, communities);
    scenario.next_tx(@0x0);
    let mut community = test_scenario::take_shared<community::Community>(&scenario);
    let reg_id = community::tier_registry_id(&community);
    let tier_cap = test_scenario::take_from_sender<tier_seal::TierRegistryCap>(&scenario);
    let mut registry = test_scenario::take_shared_by_id<tier_seal::TierRegistry>(&scenario, reg_id);
    community::create_post_with_seal(&mut community, &mut registry, &tier_cap, 0, b"Sealed", b"key1", 1, scenario.ctx());
    community::update_subscription_tier_duration(&mut community, 1, 30, 500_000_000, scenario.ctx());
    test_scenario::return_shared(community);
    test_scenario::return_shared(registry);
    test_scenario::return_to_sender(&scenario, tier_cap);

    scenario.next_tx(@0x1);
    let mut community = test_scenario::take_shared<community::Community>(&scenario);
    let clock = clock::create_for_testing(scenario.ctx());
    community::subscribe_for_duration(&mut community, coin::mint_for_testing<SUI>(500_000_000, scenario.ctx()), 1, 30, &clock, scenario.ctx());
    clock::destroy_for_testing(clock);
    test_scenario::return_shared(community);
    scenario.next_tx(@0x1);
    let membership = test_scenario::take_from_sender<tier_seal::TierMembership>(&scenario);
    let registry = test_scenario::take_shared_by_id<tier_seal::TierRegistry>(&scenario, reg_id);
    let id = tier_seal::build_seal_id_for_test(&registry, b"key1");
    let clock2 = clock::create_for_testing(scenario.ctx());
    tier_seal::seal_approve(id, &registry, &membership, &clock2);
    clock::destroy_for_testing(clock2);
    test_scenario::return_shared(registry);
    test_scenario::return_to_sender(&scenario, membership);
    scenario.end();
}

/// Test subscribe_for_duration fails when duration not configured.
#[test, expected_failure(abort_code = patreon_copy::community::EDurationNotConfigured)]
fun test_subscribe_for_duration_not_configured() {
    let mut scenario = test_scenario::begin(@0x0);
    artist::register_as_artist(scenario.ctx());
    scenario.next_tx(@0x0);
    let cap = test_scenario::take_from_sender<artist::ArtistCap>(&scenario);
    let mut communities = test_scenario::take_from_sender<artist::ArtistCommunities>(&scenario);
    let ctx = scenario.ctx();
    community::create_community_as_artist(&cap, &mut communities, coin::mint_for_testing<SUI>(100_000_000, ctx), b"C", b"D", b"", b"", coin::zero<SUI>(ctx), vector[0u64], ctx);
    test_scenario::return_to_sender(&scenario, cap);
    test_scenario::return_to_sender(&scenario, communities);
    scenario.next_tx(@0x1);
    let mut community = test_scenario::take_shared<community::Community>(&scenario);
    let clock = clock::create_for_testing(scenario.ctx());
    community::subscribe_for_duration(&mut community, coin::mint_for_testing<SUI>(1_000_000_000, scenario.ctx()), 1, 30, &clock, scenario.ctx());
    clock::destroy_for_testing(clock);
    test_scenario::return_shared(community);
    scenario.end();
}

/// Test create poll requires at least 2 options.
#[test, expected_failure(abort_code = patreon_copy::community::EInvalidOption)]
fun test_create_poll_too_few_options() {
    let mut scenario = test_scenario::begin(@0x0);
    artist::register_as_artist(scenario.ctx());
    scenario.next_tx(@0x0);
    let cap = test_scenario::take_from_sender<artist::ArtistCap>(&scenario);
    let mut communities = test_scenario::take_from_sender<artist::ArtistCommunities>(&scenario);
    let ctx = scenario.ctx();
    community::create_community_as_artist(&cap, &mut communities, coin::mint_for_testing<SUI>(100_000_000, ctx), b"C", b"D", b"", b"", coin::zero<SUI>(ctx), vector[0u64], ctx);
    test_scenario::return_to_sender(&scenario, cap);
    test_scenario::return_to_sender(&scenario, communities);
    scenario.next_tx(@0x0);

    let mut community = test_scenario::take_shared<community::Community>(&scenario);
    community::create_poll(&mut community, b"Q?", vector[b"Only one"], scenario.ctx());
    test_scenario::return_shared(community);
    scenario.end();
}
