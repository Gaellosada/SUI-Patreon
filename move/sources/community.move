/// Community module: artists create communities, users join them.
/// Communities contain posts (images, text, etc.), subscriptions (SUI-paid tiers for Seal content), and a treasury.
module patreon_copy::community {

    use patreon_copy::artist;
    use patreon_copy::tier_seal;
    use sui::balance::{Self, Balance};
    use sui::clock;
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::object::{Self, UID};
    use sui::object_table::{Self, ObjectTable};
    use sui::table::{Self, Table};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    // === Errors ===
    const EInsufficientPayment: u64 = 10;
    const EInvalidTier: u64 = 11;
    const EInsufficientCreationFee: u64 = 12;
    const EWrongRegistry: u64 = 13;
    const ENotSealPost: u64 = 14;
    const EPollNotFound: u64 = 15;
    const EPollClosed: u64 = 16;
    const EInvalidOption: u64 = 17;
    const EAlreadyVoted: u64 = 18;
    const EAlreadyLiked: u64 = 20;
    const ENeverLiked: u64 = 21;
    const EDurationNotConfigured: u64 = 22;

    const MIN_CREATION_FEE_MIST: u64 = 1_000_000; // 0.001 SUI
    const MS_PER_DAY: u64 = 24 * 60 * 60 * 1000;
    /// Default price for tier 1 when no tiers are configured (0.001 SUI).
    const DEFAULT_TIER1_PRICE_MIST: u64 = 1_000_000;

    // === Structs ===

    /// Key for duration-based tier pricing: (tier, duration_days).
    public struct TierDurationKey has copy, drop, store {
        tier: u8,
        duration_days: u64,
    }

    /// A community. Shared so anyone can interact.
    public struct Community has key {
        id: UID,
        creator: address,
        name: vector<u8>,
        description: vector<u8>,
        artist_description: vector<u8>,
        image: vector<u8>,
        members: Table<address, bool>,
        post_counter: u64,
        posts: ObjectTable<u64, Post>,
        poll_counter: u64,
        polls: ObjectTable<u64, Poll>,
        treasury: Balance<SUI>,
        tier_registry_id: object::ID,
        subscription_tiers: Table<u8, u64>,
        /// (tier, duration_days) -> price in MIST. Duration 0 = permanent (use subscription_tiers).
        subscription_tier_durations: Table<TierDurationKey, u64>,
    }

    /// A post. Content can be inline or tier-gated on Seal (content_key non-empty).
    public struct Post has key, store {
        id: UID,
        author: address,
        content_type: u8,
        content: vector<u8>,
        /// Seal content key. Non-empty = tier-gated content on Seal.
        content_key: vector<u8>,
        timestamp_ms: u64,
        comment_counter: u64,
        comments: ObjectTable<u64, Comment>,
        liked_by: vector<address>,
    }

    /// A comment on a post by any user.
    public struct Comment has key, store {
        id: UID,
        author: address,
        content: vector<u8>,
        timestamp_ms: u64,
    }

    /// A poll where community members vote for the next post content. Created by the artist.
    public struct Poll has key, store {
        id: UID,
        creator: address,
        question: vector<u8>,
        options: Table<u64, vector<u8>>,
        option_count: u64,
        votes: Table<u64, u64>,
        voted: Table<address, u64>,
        is_closed: bool,
    }

    // === Community ===

    /// Create a new community. Anyone can call. Requires a creation fee (minimum MIN_CREATION_FEE_MIST).
    /// Creator receives TierRegistryCap to call tier_seal::set_required_tier for Seal content.
    public entry fun create_community(
        creation_fee: Coin<SUI>,
        name: vector<u8>,
        description: vector<u8>,
        artist_description: vector<u8>,
        image: vector<u8>,
        initial_treasury: Coin<SUI>,
        tier_prices: vector<u64>,
        ctx: &mut TxContext,
    ) {
        assert!(coin::value(&creation_fee) >= MIN_CREATION_FEE_MIST, EInsufficientCreationFee);
        let sender = tx_context::sender(ctx);
        let mut members = table::new<address, bool>(ctx);
        table::add(&mut members, sender, true);

        let (cap, registry) = tier_seal::create_registry(ctx);
        let tier_registry_id = object::id(&registry);
        tier_seal::share_registry(registry);
        transfer::public_transfer(cap, sender);

        let mut subscription_tiers = table::new<u8, u64>(ctx);
        let mut i = 0u64;
        while (i < vector::length(&tier_prices)) {
            table::add(&mut subscription_tiers, (i as u8), *vector::borrow(&tier_prices, i));
            i = i + 1;
        };
        // Default: if no tiers, add tier 1 at 0.001 SUI
        if (table::length(&subscription_tiers) == 0) {
            table::add(&mut subscription_tiers, 1, DEFAULT_TIER1_PRICE_MIST);
        };

        let mut treasury = coin::into_balance(creation_fee);
        balance::join(&mut treasury, coin::into_balance(initial_treasury));

        let community = Community {
            id: object::new(ctx),
            creator: sender,
            name,
            description,
            artist_description,
            image,
            members,
            post_counter: 0,
            posts: object_table::new<u64, Post>(ctx),
            poll_counter: 0,
            polls: object_table::new<u64, Poll>(ctx),
            treasury,
            tier_registry_id,
            subscription_tiers,
            subscription_tier_durations: table::new<TierDurationKey, u64>(ctx),
        };
        transfer::share_object(community);
    }

    /// Create a community as a registered artist. Same as create_community but also adds to ArtistCommunities index.
    public entry fun create_community_as_artist(
        _artist_cap: &artist::ArtistCap,
        communities: &mut artist::ArtistCommunities,
        creation_fee: Coin<SUI>,
        name: vector<u8>,
        description: vector<u8>,
        artist_description: vector<u8>,
        image: vector<u8>,
        initial_treasury: Coin<SUI>,
        tier_prices: vector<u64>,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        assert!(coin::value(&creation_fee) >= MIN_CREATION_FEE_MIST, EInsufficientCreationFee);
        let mut members = table::new<address, bool>(ctx);
        table::add(&mut members, sender, true);

        let (cap, registry) = tier_seal::create_registry(ctx);
        let tier_registry_id = object::id(&registry);
        tier_seal::share_registry(registry);
        transfer::public_transfer(cap, sender);

        let mut subscription_tiers = table::new<u8, u64>(ctx);
        let mut i = 0u64;
        while (i < vector::length(&tier_prices)) {
            table::add(&mut subscription_tiers, (i as u8), *vector::borrow(&tier_prices, i));
            i = i + 1;
        };
        // Default: if no tiers, add tier 1 at 0.001 SUI
        if (table::length(&subscription_tiers) == 0) {
            table::add(&mut subscription_tiers, 1, DEFAULT_TIER1_PRICE_MIST);
        };

        let mut treasury = coin::into_balance(creation_fee);
        balance::join(&mut treasury, coin::into_balance(initial_treasury));

        let community = Community {
            id: object::new(ctx),
            creator: sender,
            name,
            description,
            artist_description,
            image,
            members,
            post_counter: 0,
            posts: object_table::new<u64, Post>(ctx),
            poll_counter: 0,
            polls: object_table::new<u64, Poll>(ctx),
            treasury,
            tier_registry_id,
            subscription_tiers,
            subscription_tier_durations: table::new<TierDurationKey, u64>(ctx),
        };
        let community_id = object::id(&community);
        transfer::share_object(community);
        artist::add_community(communities, community_id);
    }

    /// Add a community to an artist's index (e.g. after creating via create_community).
    public entry fun add_community_to_artist_index(
        community: &Community,
        _cap: &artist::ArtistCap,
        communities: &mut artist::ArtistCommunities,
    ) {
        artist::add_community(communities, object::id(community));
    }

    /// Join a community. Any user can join.
    public entry fun join_community(community: &mut Community, ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        assert!(!table::contains(&community.members, sender), 0); // EAlreadyMember
        table::add(&mut community.members, sender, true);
    }

    /// Leave a community. Members can leave (creator can leave too, but remains as creator).
    public entry fun leave_community(community: &mut Community, ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        assert!(table::contains(&community.members, sender), 3); // ENotMember
        table::remove(&mut community.members, sender);
    }

    /// Subscribe to a tier by paying SUI. Payment goes to the community treasury.
    /// Receives permanent TierMembership which can be used with tier_seal::seal_approve to decrypt Seal content.
    /// Pass the community's tier_registry_id to find the TierRegistry when calling seal_approve.
    public entry fun subscribe(
        community: &mut Community,
        payment: Coin<SUI>,
        tier: u8,
        ctx: &mut TxContext,
    ) {
        let required = if (table::contains(&community.subscription_tiers, tier)) {
            *table::borrow(&community.subscription_tiers, tier)
        } else if (table::length(&community.subscription_tiers) == 0 && tier == 1) {
            // Default: when no tiers configured, allow tier 1 at 0.001 SUI
            DEFAULT_TIER1_PRICE_MIST
        } else {
            abort EInvalidTier
        };
        assert!(coin::value(&payment) >= required, EInsufficientPayment);
        balance::join(&mut community.treasury, coin::into_balance(payment));
        let membership = tier_seal::create_membership(tier, ctx);
        transfer::public_transfer(membership, tx_context::sender(ctx));
    }

    /// Subscribe to a tier for a limited duration (e.g. 30 days). Payment goes to the community treasury.
    /// Requires the owner to have set a price via update_subscription_tier_duration. Pass Clock (0x6).
    public entry fun subscribe_for_duration(
        community: &mut Community,
        payment: Coin<SUI>,
        tier: u8,
        duration_days: u64,
        clock: &clock::Clock,
        ctx: &mut TxContext,
    ) {
        let key = TierDurationKey { tier, duration_days };
        assert!(table::contains(&community.subscription_tier_durations, key), EDurationNotConfigured);
        let required = *table::borrow(&community.subscription_tier_durations, key);
        assert!(coin::value(&payment) >= required, EInsufficientPayment);
        balance::join(&mut community.treasury, coin::into_balance(payment));
        let now_ms = clock::timestamp_ms(clock);
        let expires_at_ms = now_ms + (duration_days * MS_PER_DAY);
        let membership = tier_seal::create_membership_with_expiry(tier, expires_at_ms, ctx);
        transfer::public_transfer(membership, tx_context::sender(ctx));
    }

    /// Update subscription price for a tier + duration. Owner only.
    public entry fun update_subscription_tier_duration(
        community: &mut Community,
        tier: u8,
        duration_days: u64,
        price_mist: u64,
        ctx: &mut TxContext,
    ) {
        assert!(community.creator == tx_context::sender(ctx), 1); // ENotCreator
        let key = TierDurationKey { tier, duration_days };
        if (table::contains(&community.subscription_tier_durations, key)) {
            *table::borrow_mut(&mut community.subscription_tier_durations, key) = price_mist;
        } else {
            table::add(&mut community.subscription_tier_durations, key, price_mist);
        };
    }

    /// Update community fields. Only the creator (owner) can update.
    public entry fun update_community(
        community: &mut Community,
        name: vector<u8>,
        description: vector<u8>,
        artist_description: vector<u8>,
        image: vector<u8>,
        ctx: &mut TxContext,
    ) {
        assert!(community.creator == tx_context::sender(ctx), 1); // ENotCreator
        community.name = name;
        community.description = description;
        community.artist_description = artist_description;
        community.image = image;
    }

    /// Update subscription tier price. Owner only.
    public entry fun update_subscription_tier(
        community: &mut Community,
        tier: u8,
        price_mist: u64,
        ctx: &mut TxContext,
    ) {
        assert!(community.creator == tx_context::sender(ctx), 1); // ENotCreator
        if (table::contains(&community.subscription_tiers, tier)) {
            *table::borrow_mut(&mut community.subscription_tiers, tier) = price_mist;
        } else {
            table::add(&mut community.subscription_tiers, tier, price_mist);
        };
    }

    // === Posts ===

    /// Create a simple post (inline content only).
    public entry fun create_post(
        community: &mut Community,
        content_type: u8,
        content: vector<u8>,
        ctx: &mut TxContext,
    ) {
        create_post_internal(community, content_type, content, vector::empty<u8>(), 0, ctx)
    }

    /// Create a post with tier-gated Seal content. content_key identifies the content on Seal;
    /// min_tier is set in the TierRegistry. Use Seal id = [registry_id_bytes][content_key].
    public entry fun create_post_with_seal(
        community: &mut Community,
        registry: &mut tier_seal::TierRegistry,
        cap: &tier_seal::TierRegistryCap,
        content_type: u8,
        content: vector<u8>,
        content_key: vector<u8>,
        min_tier: u8,
        ctx: &mut TxContext,
    ) {
        assert!(object::id(registry) == community.tier_registry_id, 13); // EWrongRegistry
        tier_seal::set_required_tier(registry, cap, content_key, min_tier);
        create_post_internal(community, content_type, content, content_key, min_tier, ctx)
    }

    fun create_post_internal(
        community: &mut Community,
        content_type: u8,
        content: vector<u8>,
        content_key: vector<u8>,
        _min_tier: u8,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        assert!(community.creator == sender, 1); // ENotCreator
        let post_id = community.post_counter;
        community.post_counter = community.post_counter + 1;
        let post = Post {
            id: object::new(ctx),
            author: sender,
            content_type,
            content,
            content_key,
            timestamp_ms: tx_context::epoch_timestamp_ms(ctx),
            comment_counter: 0,
            comments: object_table::new<u64, Comment>(ctx),
            liked_by: vector::empty<address>(),
        };
        object_table::add(&mut community.posts, post_id, post);
    }

    /// Remove a post. When the post has Seal content (content_key), pass registry and cap to unregister it.
    public entry fun remove_post(
        community: &mut Community,
        registry: &mut tier_seal::TierRegistry,
        cap: &tier_seal::TierRegistryCap,
        post_id: u64,
        ctx: &mut TxContext,
    ) {
        assert!(community.creator == tx_context::sender(ctx), 1); // ENotCreator
        assert!(object_table::contains(&community.posts, post_id), 2); // EPostNotFound
        let Post { id, author: _, content_type: _, content: _, content_key, timestamp_ms: _, comment_counter, mut comments, liked_by: _ } =
            object_table::remove(&mut community.posts, post_id);
        if (vector::length(&content_key) > 0) {
            assert!(object::id(registry) == community.tier_registry_id, EWrongRegistry);
            tier_seal::remove_content_key(registry, cap, content_key);
        };
        let mut i = 0u64;
        while (i < comment_counter) {
            let Comment { id: comment_id, author: _, content: _, timestamp_ms: _ } =
                object_table::remove(&mut comments, i);
            comment_id.delete();
            i = i + 1;
        };
        object_table::destroy_empty(comments);
        id.delete();
    }

    /// Update a post's inline content. For Seal content, use tier_seal::set_required_tier to change tier.
    public entry fun update_post(
        community: &mut Community,
        post_id: u64,
        content_type: u8,
        content: vector<u8>,
        ctx: &mut TxContext,
    ) {
        assert!(community.creator == tx_context::sender(ctx), 1); // ENotCreator
        assert!(object_table::contains(&community.posts, post_id), 2); // EPostNotFound
        let post = object_table::borrow_mut(&mut community.posts, post_id);
        post.content_type = content_type;
        post.content = content;
    }

    /// Update Seal content tier for a post. Owner only.
    public entry fun update_post_seal_tier(
        community: &mut Community,
        registry: &mut tier_seal::TierRegistry,
        cap: &tier_seal::TierRegistryCap,
        post_id: u64,
        min_tier: u8,
        ctx: &mut TxContext,
    ) {
        assert!(community.creator == tx_context::sender(ctx), 1); // ENotCreator
        assert!(object_table::contains(&community.posts, post_id), 2); // EPostNotFound
        let content_key = object_table::borrow(&community.posts, post_id).content_key;
        assert!(vector::length(&content_key) > 0, ENotSealPost);
        assert!(object::id(registry) == community.tier_registry_id, EWrongRegistry);
        tier_seal::set_required_tier(registry, cap, content_key, min_tier);
    }

    // === Comments ===

    /// Leave a comment on a post. Any user can comment.
    public entry fun leave_comment(
        community: &mut Community,
        post_id: u64,
        content: vector<u8>,
        ctx: &mut TxContext,
    ) {
        assert!(object_table::contains(&community.posts, post_id), 2); // EPostNotFound
        let post = object_table::borrow_mut(&mut community.posts, post_id);
        let comment_id = post.comment_counter;
        post.comment_counter = post.comment_counter + 1;
        let comment = Comment {
            id: object::new(ctx),
            author: tx_context::sender(ctx),
            content,
            timestamp_ms: tx_context::epoch_timestamp_ms(ctx),
        };
        object_table::add(&mut post.comments, comment_id, comment);
    }

    /// Remove a comment. Only the comment author or the post author (community creator) can remove.
    public entry fun remove_comment(
        community: &mut Community,
        post_id: u64,
        comment_id: u64,
        ctx: &mut TxContext,
    ) {
        assert!(object_table::contains(&community.posts, post_id), 2); // EPostNotFound
        let post = object_table::borrow_mut(&mut community.posts, post_id);
        assert!(object_table::contains(&post.comments, comment_id), 4); // ECommentNotFound
        let sender = tx_context::sender(ctx);
        let comment_author = *&object_table::borrow(&post.comments, comment_id).author;
        assert!(sender == comment_author || sender == community.creator, 5); // ENotAuthorized
        let Comment { id, author: _, content: _, timestamp_ms: _ } =
            object_table::remove(&mut post.comments, comment_id);
        id.delete();
    }

    /// Update a comment's content. Only the comment author can update.
    public entry fun update_comment(
        community: &mut Community,
        post_id: u64,
        comment_id: u64,
        content: vector<u8>,
        ctx: &mut TxContext,
    ) {
        assert!(object_table::contains(&community.posts, post_id), 2); // EPostNotFound
        let post = object_table::borrow_mut(&mut community.posts, post_id);
        assert!(object_table::contains(&post.comments, comment_id), 4); // ECommentNotFound
        assert!(object_table::borrow(&post.comments, comment_id).author == tx_context::sender(ctx), 5); // ENotAuthorized
        object_table::borrow_mut(&mut post.comments, comment_id).content = content;
    }

    // === Likes ===

    /// Like a post. Any user can like; one like per user per post. Fails if already liked.
    public entry fun like_post(
        community: &mut Community,
        post_id: u64,
        ctx: &mut TxContext,
    ) {
        assert!(object_table::contains(&community.posts, post_id), 2); // EPostNotFound
        let post = object_table::borrow_mut(&mut community.posts, post_id);
        let sender = tx_context::sender(ctx);
        assert!(!contains_address(&post.liked_by, sender), EAlreadyLiked);
        vector::push_back(&mut post.liked_by, sender);
    }

    /// Unlike a post. Fails if the user has not liked the post.
    public entry fun unlike_post(
        community: &mut Community,
        post_id: u64,
        ctx: &mut TxContext,
    ) {
        assert!(object_table::contains(&community.posts, post_id), 2); // EPostNotFound
        let post = object_table::borrow_mut(&mut community.posts, post_id);
        let sender = tx_context::sender(ctx);
        let (found, idx) = index_of_address(&post.liked_by, sender);
        assert!(found, ENeverLiked);
        vector::remove(&mut post.liked_by, idx);
    }

    fun contains_address(v: &vector<address>, addr: address): bool {
        let len = vector::length(v);
        let mut i = 0u64;
        while (i < len) {
            if (*vector::borrow(v, i) == addr) {
                return true
            };
            i = i + 1;
        };
        false
    }

    fun index_of_address(v: &vector<address>, addr: address): (bool, u64) {
        let len = vector::length(v);
        let mut i = 0u64;
        while (i < len) {
            if (*vector::borrow(v, i) == addr) {
                return (true, i)
            };
            i = i + 1;
        };
        (false, 0)
    }

    // === Polls ===

    /// Create a poll for the next post. Only the community creator (artist) can create.
    /// options: vector of option descriptions (what the next post could be about).
    public entry fun create_poll(
        community: &mut Community,
        question: vector<u8>,
        options: vector<vector<u8>>,
        ctx: &mut TxContext,
    ) {
        assert!(community.creator == tx_context::sender(ctx), 1); // ENotCreator
        assert!(vector::length(&options) >= 2, EInvalidOption);
        let poll_id = community.poll_counter;
        community.poll_counter = community.poll_counter + 1;

        let mut options_table = table::new<u64, vector<u8>>(ctx);
        let mut votes_table = table::new<u64, u64>(ctx);
        let mut i = 0u64;
        while (i < vector::length(&options)) {
            let opt = *vector::borrow(&options, i);
            table::add(&mut options_table, i, opt);
            table::add(&mut votes_table, i, 0);
            i = i + 1;
        };

        let poll = Poll {
            id: object::new(ctx),
            creator: tx_context::sender(ctx),
            question,
            options: options_table,
            option_count: vector::length(&options),
            votes: votes_table,
            voted: table::new<address, u64>(ctx),
            is_closed: false,
        };
        object_table::add(&mut community.polls, poll_id, poll);
    }

    /// Vote on a poll. Only community members can vote; one vote per user.
    public entry fun vote_poll(
        community: &mut Community,
        poll_id: u64,
        option_index: u64,
        ctx: &mut TxContext,
    ) {
        assert!(table::contains(&community.members, tx_context::sender(ctx)), 3); // ENotMember
        assert!(object_table::contains(&community.polls, poll_id), EPollNotFound);
        let poll = object_table::borrow_mut(&mut community.polls, poll_id);
        assert!(!poll.is_closed, EPollClosed);
        assert!(option_index < poll.option_count, EInvalidOption);
        let sender = tx_context::sender(ctx);
        assert!(!table::contains(&poll.voted, sender), EAlreadyVoted);

        table::add(&mut poll.voted, sender, option_index);
        let vote_count = *table::borrow(&poll.votes, option_index);
        *table::borrow_mut(&mut poll.votes, option_index) = vote_count + 1;
    }

    /// Close a poll. Only the creator (artist) can close. After closing, the artist posts based on the winning option.
    public entry fun close_poll(community: &mut Community, poll_id: u64, ctx: &mut TxContext) {
        assert!(community.creator == tx_context::sender(ctx), 1); // ENotCreator
        assert!(object_table::contains(&community.polls, poll_id), EPollNotFound);
        let poll = object_table::borrow_mut(&mut community.polls, poll_id);
        assert!(!poll.is_closed, EPollClosed);
        poll.is_closed = true;
    }

    // === View / getter functions for frontend ===

    public fun creator(community: &Community): address {
        community.creator
    }

    public fun name(community: &Community): vector<u8> {
        community.name
    }

    public fun description(community: &Community): vector<u8> {
        community.description
    }

    public fun artist_description(community: &Community): vector<u8> {
        community.artist_description
    }

    public fun image(community: &Community): vector<u8> {
        community.image
    }

    public fun post_count(community: &Community): u64 {
        object_table::length(&community.posts)
    }

    public fun is_member(community: &Community, addr: address): bool {
        table::contains(&community.members, addr)
    }

    public fun member_count(community: &Community): u64 {
        table::length(&community.members)
    }

    public fun post_exists(community: &Community, post_id: u64): bool {
        object_table::contains(&community.posts, post_id)
    }

    public fun post_author(community: &Community, post_id: u64): address {
        *&object_table::borrow(&community.posts, post_id).author
    }

    public fun post_content_type(community: &Community, post_id: u64): u8 {
        *&object_table::borrow(&community.posts, post_id).content_type
    }

    public fun post_content(community: &Community, post_id: u64): vector<u8> {
        *&object_table::borrow(&community.posts, post_id).content
    }

    /// Seal content key if post has tier-gated content; empty otherwise.
    public fun post_content_key(community: &Community, post_id: u64): vector<u8> {
        *&object_table::borrow(&community.posts, post_id).content_key
    }

    public fun post_timestamp_ms(community: &Community, post_id: u64): u64 {
        *&object_table::borrow(&community.posts, post_id).timestamp_ms
    }

    public fun post_like_count(community: &Community, post_id: u64): u64 {
        vector::length(&object_table::borrow(&community.posts, post_id).liked_by)
    }

    public fun has_liked_post(community: &Community, post_id: u64, addr: address): bool {
        contains_address(&object_table::borrow(&community.posts, post_id).liked_by, addr)
    }

    public fun comment_count(community: &Community, post_id: u64): u64 {
        object_table::borrow(&community.posts, post_id).comment_counter
    }

    public fun comment_author(community: &Community, post_id: u64, comment_id: u64): address {
        *&object_table::borrow(&object_table::borrow(&community.posts, post_id).comments, comment_id).author
    }

    public fun comment_content(community: &Community, post_id: u64, comment_id: u64): vector<u8> {
        *&object_table::borrow(&object_table::borrow(&community.posts, post_id).comments, comment_id).content
    }

    public fun comment_timestamp_ms(community: &Community, post_id: u64, comment_id: u64): u64 {
        *&object_table::borrow(&object_table::borrow(&community.posts, post_id).comments, comment_id).timestamp_ms
    }

    public fun comment_exists(community: &Community, post_id: u64, comment_id: u64): bool {
        object_table::contains(&community.posts, post_id) &&
        object_table::contains(&object_table::borrow(&community.posts, post_id).comments, comment_id)
    }

    // === Poll getters ===

    public fun poll_count(community: &Community): u64 {
        object_table::length(&community.polls)
    }

    public fun poll_exists(community: &Community, poll_id: u64): bool {
        object_table::contains(&community.polls, poll_id)
    }

    public fun poll_question(community: &Community, poll_id: u64): vector<u8> {
        *&object_table::borrow(&community.polls, poll_id).question
    }

    public fun poll_option_count(community: &Community, poll_id: u64): u64 {
        object_table::borrow(&community.polls, poll_id).option_count
    }

    public fun poll_option(community: &Community, poll_id: u64, option_index: u64): vector<u8> {
        *table::borrow(&object_table::borrow(&community.polls, poll_id).options, option_index)
    }

    public fun poll_votes(community: &Community, poll_id: u64, option_index: u64): u64 {
        *table::borrow(&object_table::borrow(&community.polls, poll_id).votes, option_index)
    }

    public fun poll_is_closed(community: &Community, poll_id: u64): bool {
        object_table::borrow(&community.polls, poll_id).is_closed
    }

    public fun poll_creator(community: &Community, poll_id: u64): address {
        object_table::borrow(&community.polls, poll_id).creator
    }

    /// Returns the option index with the most votes, or option_count if tie/empty. Only valid when poll is closed.
    public fun poll_winning_option(community: &Community, poll_id: u64): u64 {
        let poll = object_table::borrow(&community.polls, poll_id);
        let mut best = 0u64;
        let mut best_count = 0u64;
        let mut i = 0u64;
        while (i < poll.option_count) {
            let count = *table::borrow(&poll.votes, i);
            if (count > best_count) {
                best = i;
                best_count = count;
            };
            i = i + 1;
        };
        best
    }

    public fun has_voted(community: &Community, poll_id: u64, addr: address): bool {
        object_table::contains(&community.polls, poll_id) &&
        table::contains(&object_table::borrow(&community.polls, poll_id).voted, addr)
    }

    // === Subscription / Treasury / Seal ===

    /// Treasury balance in MIST.
    public fun treasury_balance(community: &Community): u64 {
        balance::value(&community.treasury)
    }

    /// TierRegistry object ID. Use this to load the TierRegistry for seal_approve.
    public fun tier_registry_id(community: &Community): object::ID {
        community.tier_registry_id
    }

    /// Subscription price for a tier in MIST. Aborts if tier not configured.
    public fun subscription_price(community: &Community, tier: u8): u64 {
        assert!(table::contains(&community.subscription_tiers, tier), EInvalidTier);
        *table::borrow(&community.subscription_tiers, tier)
    }

    /// Whether a tier is configured.
    public fun tier_exists(community: &Community, tier: u8): bool {
        table::contains(&community.subscription_tiers, tier)
    }

    /// Subscription price for a tier + duration in MIST. Aborts if not configured.
    public fun subscription_price_for_duration(community: &Community, tier: u8, duration_days: u64): u64 {
        let key = TierDurationKey { tier, duration_days };
        assert!(table::contains(&community.subscription_tier_durations, key), EDurationNotConfigured);
        *table::borrow(&community.subscription_tier_durations, key)
    }

    /// Whether a tier + duration price is configured.
    public fun tier_duration_exists(community: &Community, tier: u8, duration_days: u64): bool {
        table::contains(&community.subscription_tier_durations, TierDurationKey { tier, duration_days })
    }
}
