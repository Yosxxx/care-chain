use anchor_lang::prelude::*;

#[event]
pub struct RecordCreated {
    pub patient: Pubkey,
    pub record: Pubkey,
    pub seq: u64,
    pub hospital: Pubkey,
}

#[event]
pub struct GrantUpdated {
    pub patient: Pubkey,
    pub grantee: Pubkey,
    pub revoked: bool,
}

#[event]
pub struct HospitalRegistered {
    pub hospital: Pubkey,
    pub authority: Pubkey,
    pub name: String,
    pub kms_ref: String,
    pub registered_by: Pubkey,
    pub timestamp: i64,
}
