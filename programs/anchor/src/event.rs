use anchor_lang::prelude::*;

#[event]
pub struct ConfigInitialized {
    pub authority: Pubkey,
    pub kms_namespace: String,
    pub created_at: i64,
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
    pub hospital_authority: Pubkey,
    pub name: String,
    pub kms_ref: String,
    pub registered_by: Pubkey,
    pub created_at: i64,
}

#[event]
pub struct PatientUpserted {
    pub patient: Pubkey,
    pub patient_pubkey: Pubkey,
    pub created: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

#[event]
pub struct ProgramPauseUpdated {
    pub paused: bool,
    pub set_by: Pubkey,
    pub at: i64,
}

#[event]
pub struct RecordCreated {
    pub record: Pubkey,
    pub patient: Pubkey,
    pub hospital: Pubkey,
    pub uploader: Pubkey,
    pub seq: u64,
    pub enc_version: u16,
    pub created_at: i64,
}

#[event]
pub struct RecordRead {
    pub record: Pubkey,
    pub patient: Pubkey,
    pub hospital: Pubkey,
    pub reader: Pubkey,
    pub seq: u64,
    // pub ts: i64,
}

#[event]
pub struct GrantCreated {
    pub grant: Pubkey,
    pub patient: Pubkey,
    pub grantee: Pubkey,
    pub scope: u8,
    pub expires_at: Option<i64>,
    pub created_by: Pubkey,
    pub created_at: i64,
}

#[event]
pub struct GrantRevoked {
    pub grant: Pubkey,
    pub patient: Pubkey,
    pub grantee: Pubkey,
    pub scope: u8,
    pub revoked_by: Pubkey,
    pub revoked_at: i64,
}
