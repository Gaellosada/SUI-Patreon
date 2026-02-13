module patreon_copy::tier_content;

/// Content that can be embedded in other objects and holds arbitrary byte data.
/// For very large payloads, consider storing the blob in a dynamic field on the parent object
public struct TierContent has store {
    content: vector<u8>, // Raw byte content
}

/// Create tier content from raw bytes.
public fun create_tier_content(content: vector<u8>): TierContent {
    TierContent { content }
}

/// Read the byte content by reference (for embedded TierContent in other objects).
public fun content_ref(tc: &TierContent): &vector<u8> {
    &tc.content
}

/// Read the byte content (consumes the struct).
public fun into_content(tc: TierContent): vector<u8> {
    let TierContent { content } = tc;
    content
}
