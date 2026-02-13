// Seal integration: tier-based access control for encrypted content.
//
// - Content is encrypted off-chain with the Seal SDK using an identity id.
// - Id format for this policy: [registry_object_id_as_bytes][content_key]
//   (Seal prepends package id; content_key is used to look up required tier).
// - Only callers who prove they have TierMembership with tier >= required_tier can decrypt.
//
// Flow:
// 1. Create TierRegistry (shared), register content_key -> min_tier with set_required_tier.
// 2. Encrypt content (e.g. TierContent bytes) with Seal using id = [registry_id_bytes][content_key].
// 3. To decrypt, user builds a tx calling seal_approve(id, registry, membership, clock); they must pass
//    their TierMembership and Clock (0x6); we check membership.tier >= registry.required_tier(content_key)
//    and that temporary memberships have not expired.

module patreon_copy::tier_seal;

use sui::clock::Clock;
use sui::table::{Self, Table};
use std::bcs;

const ENoAccess: u64 = 1;
const EMembershipExpired: u64 = 5;
const EInvalidCap: u64 = 2;
const EWrongVersion: u64 = 3;
const EContentKeyNotFound: u64 = 4;
const VERSION: u64 = 1;

/// Shared registry: maps content_key (used in Seal id) to minimum tier required to decrypt.
public struct TierRegistry has key {
    id: UID,
    version: u64,
    /// content_key -> minimum tier level (0 = open, higher = more exclusive).
    content_tiers: Table<vector<u8>, u8>,
}

/// Capability to add/update tier requirements for content. Hold this to call set_required_tier.
public struct TierRegistryCap has key, store {
    id: UID,
    registry_id: object::ID,
}

/// User's tier level. Pass this in the Seal decrypt tx to prove access.
/// Created by issuing logic (e.g. community or payment); holder can use it for seal_approve.
/// expires_at_ms: 0 = never expires (permanent); else Unix timestamp in ms when access ends.
public struct TierMembership has key, store {
    id: UID,
    tier: u8,
    expires_at_ms: u64,
}

/// Create a tier registry and a cap for the creator. Share the registry; keep or transfer the cap.
public fun create_registry(ctx: &mut TxContext): (TierRegistryCap, TierRegistry) {
    let registry = TierRegistry {
        id: object::new(ctx),
        version: VERSION,
        content_tiers: table::new(ctx),
    };
    let cap = TierRegistryCap {
        id: object::new(ctx),
        registry_id: object::id(&registry),
    };
    (cap, registry)
}

/// Share the registry so Seal key servers can read it during dry_run.
public entry fun share_registry(registry: TierRegistry) {
    transfer::share_object(registry);
}

/// Create a registry, share it, and send the cap to the sender. One-shot for setup.
entry fun create_and_share_registry(ctx: &mut TxContext) {
    let (cap, registry) = create_registry(ctx);
    share_registry(registry);
    transfer::public_transfer(cap, ctx.sender());
}

/// Set the minimum tier required to decrypt content identified by `content_key`.
/// The Seal id used when encrypting must be [registry_object_id_bytes][content_key].
public entry fun set_required_tier(registry: &mut TierRegistry, cap: &TierRegistryCap, content_key: vector<u8>, min_tier: u8) {
    assert!(cap.registry_id == object::id(registry), EInvalidCap);
    assert!(registry.version == VERSION, EWrongVersion);
    if (table::contains(&registry.content_tiers, content_key)) {
        *table::borrow_mut(&mut registry.content_tiers, content_key) = min_tier;
    } else {
        table::add(&mut registry.content_tiers, content_key, min_tier);
    };
}

/// Remove a content key from the registry (effectively "deleting" the content from Seal access control).
/// After this, no one can decrypt via seal_approve for this content_key.
public entry fun remove_content_key(registry: &mut TierRegistry, cap: &TierRegistryCap, content_key: vector<u8>) {
    assert!(cap.registry_id == object::id(registry), EInvalidCap);
    assert!(registry.version == VERSION, EWrongVersion);
    assert!(table::contains(&registry.content_tiers, content_key), EContentKeyNotFound);
    table::remove(&mut registry.content_tiers, content_key);
}

/// Create a permanent tier membership (never expires). Transfer to recipient.
public fun create_membership(tier: u8, ctx: &mut TxContext): TierMembership {
    create_membership_with_expiry(tier, 0, ctx)
}

/// Create a tier membership that expires at the given Unix timestamp (ms). expires_at_ms = 0 means permanent.
public fun create_membership_with_expiry(tier: u8, expires_at_ms: u64, ctx: &mut TxContext): TierMembership {
    TierMembership {
        id: object::new(ctx),
        tier,
        expires_at_ms,
    }
}

/// Get the tier level of a membership (for tests or off-chain).
public fun tier(m: &TierMembership): u8 {
    m.tier
}

/// Cancel a subscription by destroying the TierMembership. Only the owner can call; they pass the membership.
/// No refund. Call this to revoke your own access.
public entry fun cancel_membership(membership: TierMembership) {
    let TierMembership { id, tier: _, expires_at_ms: _ } = membership;
    object::delete(id);
}

// ---------------------------------------------------------------------------
// Seal access policy: seal_approve* (side-effect free, first arg = id)
// Id format: [registry_id_bytes][content_key]. Registry id bytes = bcs::to_bytes(&object::id(registry)).
// ---------------------------------------------------------------------------

fun id_prefix(registry: &TierRegistry): vector<u8> {
    bcs::to_bytes(&object::id(registry))
}

/// Returns the required tier for this id (content_key suffix). None if prefix/content_key invalid.
fun required_tier_for_id(registry: &TierRegistry, id: vector<u8>): (bool, u8) {
    let prefix = id_prefix(registry);
    if (prefix.length() > id.length()) {
        return (false, 0)
    };
    let mut i = 0;
    while (i < prefix.length()) {
        if (prefix[i] != id[i]) {
            return (false, 0)
        };
        i = i + 1;
    };
    let mut content_key = vector::empty<u8>();
    while (i < id.length()) {
        vector::push_back(&mut content_key, id[i]);
        i = i + 1;
    };
    if (!table::contains(&registry.content_tiers, content_key)) {
        return (false, 0)
    };
    (true, *table::borrow(&registry.content_tiers, content_key))
}

fun check_policy(caller_tier: u8, id: vector<u8>, registry: &TierRegistry): bool {
    assert!(registry.version == VERSION, EWrongVersion);
    let (valid, required) = required_tier_for_id(registry, id);
    if (!valid) {
        return false
    };
    caller_tier >= required
}

/// Seal policy: grant decryption only if the passed TierMembership has tier >= required tier for this id
/// and has not expired. Pass Clock (0x6) for expiration checks. TxContext::sender() must own membership.
entry fun seal_approve(id: vector<u8>, registry: &TierRegistry, membership: &TierMembership, clock: &Clock) {
    if (membership.expires_at_ms > 0 && sui::clock::timestamp_ms(clock) >= membership.expires_at_ms) {
        abort EMembershipExpired
    };
    assert!(check_policy(membership.tier, id, registry), ENoAccess);
}

#[test_only]
/// Destroy registry, cap, and membership for test cleanup.
public fun destroy_for_testing(
    registry: TierRegistry,
    cap: TierRegistryCap,
    membership: TierMembership,
) {
    let TierRegistry { id, version: _, content_tiers } = registry;
    table::drop(content_tiers);
    object::delete(id);
    let TierRegistryCap { id, registry_id: _ } = cap;
    object::delete(id);
    let TierMembership { id, tier: _, expires_at_ms: _ } = membership;
    object::delete(id);
}

#[test_only]
/// Build the Seal id for testing: [registry_id_bytes][content_key].
public fun build_seal_id_for_test(registry: &TierRegistry, content_key: vector<u8>): vector<u8> {
    let mut id = id_prefix(registry);
    let mut i = 0;
    while (i < vector::length(&content_key)) {
        vector::push_back(&mut id, *vector::borrow(&content_key, i));
        i = i + 1;
    };
    id
}
