/// Artist registration module: users can register to become artists.
/// Artists receive an ArtistCap and ArtistCommunities which grants them rights to create communities and post content.
module patreon_copy::artist {

    use sui::coin::{Self, Coin};
    use sui::object::{Self, UID};
    use sui::sui::SUI;
    use sui::table::{Self, Table};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    const EInsufficientPayment: u64 = 1;
    const MIN_ARTIST_REGISTRATION_FEE_MIST: u64 = 1_000_000; // 0.001 SUI

    /// Capability proving the holder is a registered artist.
    /// Required to create communities and post content.
    public struct ArtistCap has key, store {
        id: UID,
    }

    /// Index of communities created by this artist. Owned by the artist, updated when they create communities.
    /// Use community_count and community_id_at to enumerate an artist's communities.
    public struct ArtistCommunities has key {
        id: UID,
        community_ids: Table<u64, object::ID>,
        next_index: u64,
    }

    /// Register as an artist with payment. Fee goes to fee_recipient.
    /// Requires payment >= MIN_ARTIST_REGISTRATION_FEE_MIST (0.001 SUI).
    public entry fun register_as_artist_with_fee(
        payment: Coin<SUI>,
        fee_recipient: address,
        ctx: &mut TxContext,
    ) {
        assert!(coin::value(&payment) >= MIN_ARTIST_REGISTRATION_FEE_MIST, EInsufficientPayment);
        transfer::public_transfer(payment, fee_recipient);
        register_as_artist(ctx);
    }

    /// Register as an artist (free). Callable by any user. For paid registration use register_as_artist_with_fee.
    /// Transfers an ArtistCap and ArtistCommunities to the sender. Each address can only have one of each
    /// (caller must not already have one - typically guarded by UX).
    public entry fun register_as_artist(ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        let cap = ArtistCap {
            id: object::new(ctx),
        };
        let communities = ArtistCommunities {
            id: object::new(ctx),
            community_ids: table::new(ctx),
            next_index: 0,
        };
        transfer::transfer(cap, sender);
        transfer::transfer(communities, sender);
    }

    /// Add a community ID to the artist's index. Called by community module when an artist creates a community.
    public entry fun add_community(communities: &mut ArtistCommunities, community_id: object::ID) {
        let index = communities.next_index;
        table::add(&mut communities.community_ids, index, community_id);
        communities.next_index = index + 1;
    }

    /// Number of communities created by this artist.
    public fun community_count(communities: &ArtistCommunities): u64 {
        communities.next_index
    }

    /// Get the community object ID at the given index (0..community_count - 1).
    public fun community_id_at(communities: &ArtistCommunities, index: u64): object::ID {
        assert!(index < communities.next_index, 0); // EIndexOutOfBounds
        *table::borrow(&communities.community_ids, index)
    }
}
