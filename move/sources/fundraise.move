/// Fundraise module: users can create fundraisers for artists.
/// Anyone can contribute SUI; the artist (beneficiary) can claim funds when the goal is reached or when closed.
module patreon_copy::fundraise {

    use sui::balance::{Self, Balance};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::object::{Self, UID};
    use sui::table::{Self, Table};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    // === Errors ===
    const ENotCreator: u64 = 1;
    const ENotArtist: u64 = 2;
    const EGoalNotReached: u64 = 3;
    const EAlreadyClosed: u64 = 4;
    const ENoFunds: u64 = 6;
    const EDeadlineNotReached: u64 = 7;

    /// A fundraiser for an artist. Shared so anyone can contribute.
    /// Funds are held until the artist claims them (after goal reached or closed).
    public struct Fundraise has key {
        id: UID,
        creator: address,
        artist: address,
        description: vector<u8>,
        goal_mist: u64,
        balance: Balance<SUI>,
        is_closed: bool,
        /// Optional: 0 = no deadline. Otherwise epoch timestamp ms.
        deadline_ms: u64,
        /// Track total contributed per address (for potential refund logic; not used for claim).
        contributions: Table<address, u64>,
    }

    /// Create a fundraiser for an artist. Any user can create.
    /// goal_mist: target amount in MIST (1 SUI = 1_000_000_000 MIST).
    /// deadline_ms: 0 = no deadline; otherwise epoch timestamp in ms when fundraiser closes.
    public entry fun create_fundraise(
        artist: address,
        description: vector<u8>,
        goal_mist: u64,
        deadline_ms: u64,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        let fundraise = Fundraise {
            id: object::new(ctx),
            creator: sender,
            artist,
            description,
            goal_mist,
            balance: balance::zero<SUI>(),
            is_closed: false,
            deadline_ms,
            contributions: table::new<address, u64>(ctx),
        };
        transfer::share_object(fundraise);
    }

    /// Contribute SUI to a fundraiser.
    public entry fun contribute(fundraise: &mut Fundraise, payment: Coin<SUI>, ctx: &mut TxContext) {
        assert!(!fundraise.is_closed, EAlreadyClosed);
        let now = tx_context::epoch_timestamp_ms(ctx);
        assert!(fundraise.deadline_ms == 0 || now < fundraise.deadline_ms, EDeadlineNotReached);

        let sender = tx_context::sender(ctx);
        let amt = coin::value(&payment);
        balance::join(&mut fundraise.balance, coin::into_balance(payment));

        if (table::contains(&fundraise.contributions, sender)) {
            *table::borrow_mut(&mut fundraise.contributions, sender) =
                *table::borrow(&fundraise.contributions, sender) + amt;
        } else {
            table::add(&mut fundraise.contributions, sender, amt);
        };
    }

    /// Close the fundraiser early. Only the creator can close.
    /// After closing, the artist can claim regardless of goal.
    public entry fun close_fundraise(fundraise: &mut Fundraise, ctx: &mut TxContext) {
        assert!(fundraise.creator == tx_context::sender(ctx), ENotCreator);
        assert!(!fundraise.is_closed, EAlreadyClosed);
        fundraise.is_closed = true;
    }

    /// Artist claims funds. Can claim when: (1) goal reached, or (2) fundraiser is closed.
    /// If deadline passed without goal reached, artist can also claim (treat deadline as auto-close).
    public entry fun claim_fundraise(fundraise: &mut Fundraise, ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        assert!(fundraise.artist == sender, ENotArtist);

        let raised = balance::value(&fundraise.balance);
        assert!(raised > 0, ENoFunds);

        let now = tx_context::epoch_timestamp_ms(ctx);
        let deadline_passed = fundraise.deadline_ms > 0 && now >= fundraise.deadline_ms;
        let goal_reached = raised >= fundraise.goal_mist;

        assert!(fundraise.is_closed || goal_reached || deadline_passed, EGoalNotReached);

        let bal = balance::withdraw_all(&mut fundraise.balance);
        let coins = coin::from_balance(bal, ctx);
        transfer::public_transfer(coins, sender);
    }

    // === Getters ===

    public fun creator(f: &Fundraise): address {
        f.creator
    }

    public fun artist(f: &Fundraise): address {
        f.artist
    }

    public fun description(f: &Fundraise): vector<u8> {
        f.description
    }

    public fun goal_mist(f: &Fundraise): u64 {
        f.goal_mist
    }

    public fun raised(f: &Fundraise): u64 {
        balance::value(&f.balance)
    }

    public fun is_closed(f: &Fundraise): bool {
        f.is_closed
    }

    public fun deadline_ms(f: &Fundraise): u64 {
        f.deadline_ms
    }

    public fun goal_reached(f: &Fundraise): bool {
        balance::value(&f.balance) >= f.goal_mist
    }

    public fun contribution_amount(f: &Fundraise, addr: address): u64 {
        if (table::contains(&f.contributions, addr)) {
            *table::borrow(&f.contributions, addr)
        } else {
            0
        }
    }
}
