#[test_only]
module patreon_copy::tier_content_tests;

use patreon_copy::tier_content;

/// Test creating tier content and reading via content_ref.
#[test]
fun test_create_and_read_content_ref() {
    let content = b"Hello, tiered world!";
    let tc = tier_content::create_tier_content(content);
    let read = tier_content::content_ref(&tc);
    assert!(*read == content, 0);
    let _ = tier_content::into_content(tc);
}

/// Test into_content consumes and returns the bytes.
#[test]
fun test_into_content() {
    let content = b"Secret data";
    let tc = tier_content::create_tier_content(content);
    let extracted = tier_content::into_content(tc);
    assert!(extracted == content, 0);
}
