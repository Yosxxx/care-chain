use anchor_lang::prelude::*;

pub const SEED_CONFIG: &[u8] = b"config";
pub const SEED_HOSPITAL: &[u8] = b"hospital";
pub const SEED_PATIENT: &[u8] = b"patient";
pub const SEED_RECORD: &[u8] = b"record";
pub const SEED_GRANT: &[u8] = b"grant";
pub const SEED_PATIENT_SEQ: &[u8] = b"patient_seq";

pub const MAX_NAME_LEN: usize = 100;
pub const MAX_CID_LEN: usize = 100;
pub const MAX_NOTE_LEN: usize = 150;
pub const MAX_KMS_REF_LEN: usize = 64;
pub const MAX_META_MIME_LEN: usize = 40;
pub const MAX_DID_LEN: usize = 96;
pub const MAX_EMAIL_HASH_LEN: usize = 64;
pub const MAX_WRAP_DEK_LEN: usize = 128;
pub const MAX_META_EXTRA_LEN: usize = 160;

pub const SCOPE_READ: u8 = 0b0000_0001;
pub const SCOPE_WRITE: u8 = 0b0000_0010;
pub const SCOPE_ADMIN: u8 = 0b0000_0100;

#[derive(AnchorSerialize, AnchorDeserialize, InitSpace, Clone, Copy, PartialEq, Eq)]
pub enum RecordStatus {
    Active,
    Revoked,
}

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub authority: Pubkey,
    pub paused: bool,

    #[max_len(MAX_KMS_REF_LEN)]
    pub kms_namespace: String,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Hospital {
    pub authority: Pubkey,

    #[max_len(MAX_NAME_LEN)]
    pub name: String,

    #[max_len(MAX_KMS_REF_LEN)]
    pub kms_ref: String,

    pub registered_by: Pubkey,
    pub created_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Patient {
    pub owner_moh: Pubkey,
    pub patient_pubkey: Pubkey,

    pub id_hash: [u8; 32],

    #[max_len(MAX_EMAIL_HASH_LEN)]
    pub email_hash_hex: String,

    #[max_len(MAX_DID_LEN)]
    pub did: String,

    pub next_record_seq: u64,
    pub created_at: i64,
    pub bump: u8,
}

#[account]
pub struct PatientSeq {
    pub patient: Pubkey,
    pub value: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Record {
    pub patient: Pubkey,
    pub hospital: Pubkey,
    pub uploader: Pubkey,

    #[max_len(MAX_CID_LEN)]
    pub cid_enc: String,

    #[max_len(MAX_META_MIME_LEN)]
    pub meta_mime: String,

    #[max_len(MAX_CID_LEN)]
    pub meta_cid: String,

    #[max_len(MAX_META_EXTRA_LEN)]
    pub meta_extra: String,

    pub size_bytes: u64,

    pub blake2b_256: [u8; 32],

    #[max_len(MAX_WRAP_DEK_LEN)]
    pub dek_for_patient: Vec<u8>,

    #[max_len(MAX_WRAP_DEK_LEN)]
    pub dek_for_hospital: Vec<u8>,

    #[max_len(MAX_KMS_REF_LEN)]
    pub kms_ref: String,

    #[max_len(MAX_NOTE_LEN)]
    pub note: String,

    pub status: RecordStatus,

    pub seq: u64,

    pub enc_version: u16,

    pub created_at: i64,
    pub updated_at: i64,

    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Grant {
    pub patient: Pubkey,
    pub grantee: Pubkey,

    pub scope: u8,

    pub expires_at: Option<i64>,

    #[max_len(MAX_WRAP_DEK_LEN)]
    pub dek_wrapped: Vec<u8>,

    pub created_by: Pubkey,
    pub created_at: i64,

    pub revoked: bool,
    pub revoked_at: i64,

    pub bump: u8,
}
