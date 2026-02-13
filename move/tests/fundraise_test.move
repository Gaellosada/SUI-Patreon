#[test_only]
module patreon_copy::fundraise_tests;

use patreon_copy::fundraise;
use sui::coin;
use sui::sui::SUI;
use sui::test_scenario;

const ARTIST: address = @0x0;
const CREATOR: address = @0x1;
const CONTRIBUTOR_A: address = @0x2;
const CONTRIBUTOR_B: address = @0x3;

/// Test create fundraise, contribute, and claim.
#[test]
fun test_create_contribute_claim() {
    let mut scenario = test_scenario::begin(CREATOR);
    fundraise::create_fundraise(ARTIST, b"Support my new art project!", 10_000_000_000, 0, scenario.ctx());
    scenario.next_tx(CREATOR);

    let mut fr = test_scenario::take_shared<fundraise::Fundraise>(&scenario);
    assert!(fundraise::creator(&fr) == CREATOR, 0);
    assert!(fundraise::artist(&fr) == ARTIST, 1);
    assert!(fundraise::goal_mist(&fr) == 10_000_000_000, 2);
    assert!(fundraise::raised(&fr) == 0, 3);
    assert!(!fundraise::goal_reached(&fr), 4);
    test_scenario::return_shared(fr);

    scenario.next_tx(CONTRIBUTOR_A);
    let mut fr = test_scenario::take_shared<fundraise::Fundraise>(&scenario);
    let payment = coin::mint_for_testing<SUI>(3_000_000_000, scenario.ctx());
    fundraise::contribute(&mut fr, payment, scenario.ctx());
    assert!(fundraise::raised(&fr) == 3_000_000_000, 0);
    assert!(fundraise::contribution_amount(&fr, CONTRIBUTOR_A) == 3_000_000_000, 1);
    test_scenario::return_shared(fr);

    scenario.next_tx(CONTRIBUTOR_B);
    let mut fr = test_scenario::take_shared<fundraise::Fundraise>(&scenario);
    let payment = coin::mint_for_testing<SUI>(7_000_000_000, scenario.ctx());
    fundraise::contribute(&mut fr, payment, scenario.ctx());
    assert!(fundraise::raised(&fr) == 10_000_000_000, 0);
    assert!(fundraise::goal_reached(&fr), 1);
    test_scenario::return_shared(fr);

    scenario.next_tx(ARTIST);
    let mut fr = test_scenario::take_shared<fundraise::Fundraise>(&scenario);
    fundraise::claim_fundraise(&mut fr, scenario.ctx());
    scenario.next_tx(ARTIST);
    let coins = test_scenario::take_from_sender<coin::Coin<SUI>>(&scenario);
    assert!(coin::value(&coins) == 10_000_000_000, 0);
    test_scenario::return_to_sender(&scenario, coins);
    test_scenario::return_shared(fr);
    scenario.end();
}

/// Test close fundraise early and artist claims.
#[test]
fun test_close_fundraise_and_claim() {
    let mut scenario = test_scenario::begin(CREATOR);
    fundraise::create_fundraise(ARTIST, b"Partial goal OK", 20_000_000_000, 0, scenario.ctx());
    scenario.next_tx(CREATOR);

    scenario.next_tx(CONTRIBUTOR_A);
    let mut fr = test_scenario::take_shared<fundraise::Fundraise>(&scenario);
    fundraise::contribute(&mut fr, coin::mint_for_testing<SUI>(5_000_000_000, scenario.ctx()), scenario.ctx());
    test_scenario::return_shared(fr);

    scenario.next_tx(CREATOR);
    let mut fr = test_scenario::take_shared<fundraise::Fundraise>(&scenario);
    fundraise::close_fundraise(&mut fr, scenario.ctx());
    assert!(fundraise::is_closed(&fr), 0);
    test_scenario::return_shared(fr);

    scenario.next_tx(ARTIST);
    let mut fr = test_scenario::take_shared<fundraise::Fundraise>(&scenario);
    fundraise::claim_fundraise(&mut fr, scenario.ctx());
    scenario.next_tx(ARTIST);
    let coins = test_scenario::take_from_sender<coin::Coin<SUI>>(&scenario);
    assert!(coin::value(&coins) == 5_000_000_000, 0);
    test_scenario::return_to_sender(&scenario, coins);
    test_scenario::return_shared(fr);
    scenario.end();
}

/// Test only artist can claim.
#[test, expected_failure(abort_code = patreon_copy::fundraise::ENotArtist)]
fun test_claim_not_artist() {
    let mut scenario = test_scenario::begin(CREATOR);
    fundraise::create_fundraise(ARTIST, b"Fund", 1_000_000_000, 0, scenario.ctx());
    scenario.next_tx(CREATOR);

    scenario.next_tx(CONTRIBUTOR_A);
    let mut fr = test_scenario::take_shared<fundraise::Fundraise>(&scenario);
    fundraise::contribute(&mut fr, coin::mint_for_testing<SUI>(1_000_000_000, scenario.ctx()), scenario.ctx());
    test_scenario::return_shared(fr);

    scenario.next_tx(CREATOR);
    let mut fr = test_scenario::take_shared<fundraise::Fundraise>(&scenario);
    fundraise::claim_fundraise(&mut fr, scenario.ctx());
    test_scenario::return_shared(fr);
    scenario.end();
}
