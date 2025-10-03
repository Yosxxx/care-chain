use anchor_lang::prelude::*;

#[account]
pub struct AuthorityBadge {
    pub authority: Pubkey, // Kemenkes || Hospital
}

#[account]
pub struct RecordData {
    pub patient: Pubkey,   // 32
    pub authority: Pubkey, // 32
    pub cid: String,       // 4 + MAX_CID
    pub timestamp: i64,    // 8
}

impl RecordData {
    pub const MAX_CID: usize = 128; // tune as you like
    pub const MAX_SIZE: usize = 32 + 32 + 8 + 4 + Self::MAX_CID;
}
