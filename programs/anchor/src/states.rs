use anchor_lang::prelude::*;

pub const SEED_CONFIG: &[u8] = b"config";
pub const SEED_HOSPITAL: &[u8] = b"hospital";
pub const SEED_PATIENT: &[u8] = b"patient";
pub const SEED_RECORD: &[u8] = b"record";
pub const SEED_GRANT: &[u8] = b"grant";
pub const SEED_PATIENT_SEQ: &[u8] = b"patient_seq";
pub const SEED_CONSENT: &[u8] = b"consent";
pub const SEED_ACCESS: &[u8] = b"access";
pub const SEED_TRUSTEE: &[u8] = b"trustee";

pub const MAX_NAME_LEN: usize = 100;
pub const MAX_CID_LEN: usize = 100;
pub const MAX_NOTE_LEN: usize = 150;
pub const MAX_KMS_REF_LEN: usize = 64;
pub const MAX_META_MIME_LEN: usize = 40;
pub const MAX_DID_LEN: usize = 128;
pub const MAX_WRAP_DEK_LEN: usize = 256;

pub const SCOPE_READ: u8 = 0b0000_0001;
pub const SCOPE_WRITE: u8 = 0b0000_0010;
pub const SCOPE_ADMIN: u8 = 0b0000_0100;

pub const MAX_HOSPITAL_NAME_LEN: usize = 128;
pub const MAX_DOCTOR_NAME_LEN: usize = 128;

pub const MAX_DIAGNOSIS_LEN: usize = 256;
pub const MAX_KEYWORDS_LEN: usize = 256;
pub const MAX_DESCRIPTION_LEN: usize = 1024;

#[derive(AnchorSerialize, AnchorDeserialize, InitSpace, Clone, Copy, PartialEq, Eq)]
pub enum WrapAlgo {
    Kms,
    SealedBox,
    Other,
}

#[derive(AnchorSerialize, AnchorDeserialize, InitSpace, Clone, Copy, PartialEq, Eq)]
pub enum EncAlgo {
    XChaCha20,
    AesGcm,
    Other,
}

/// Program Config
/// PDA: [SEED_CONFIG]
#[account]
#[derive(InitSpace)]
pub struct Config {
    pub authority: Pubkey,
    pub paused: bool,

    #[max_len(MAX_KMS_REF_LEN)]
    pub kms_namespace: String,

    pub bump: u8,
}

/// Hospital
/// PDA: [SEED_HOSPITAL, hospital_authority]
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

/// Patient
/// PDA: [SEED_PATIENT, patient_pubkey]
#[account]
#[derive(InitSpace)]
pub struct Patient {
    pub patient_pubkey: Pubkey,

    #[max_len(MAX_DID_LEN)]
    pub did: String,

    pub created_at: i64,

    pub bump: u8,
}

/// PDA: [SEED_PATIENT_SEQ, patient]
#[account]
pub struct PatientSeq {
    pub patient: Pubkey,
    pub value: u64,
    pub bump: u8,
}

/// Record
/// PDA: [SEED_RECORD, patient, seq_le_bytes]
#[account]
#[derive(InitSpace)]
pub struct Record {
    pub patient: Pubkey,
    pub hospital: Pubkey,
    pub uploader: Pubkey,

    #[max_len(MAX_CID_LEN)]
    pub cid_enc: String,

    #[max_len(MAX_META_MIME_LEN)]
    pub meta_mime: String, // file type

    #[max_len(MAX_CID_LEN)]
    pub meta_cid: String, // metadata json (record_seq, created_at, ...)

    pub size_bytes: u64,

    pub blake2b_256: [u8; 32],

    #[max_len(MAX_WRAP_DEK_LEN)]
    pub edek_root: Vec<u8>, // ini kalau mau ada centralized authority, pake root kalo gak hapus

    #[max_len(MAX_WRAP_DEK_LEN)]
    pub edek_for_patient: Vec<u8>,

    #[max_len(MAX_WRAP_DEK_LEN)]
    pub edek_for_hospital: Vec<u8>,

    pub edek_root_algo: WrapAlgo,
    pub edek_patient_algo: WrapAlgo,
    pub edek_hospital_algo: WrapAlgo,

    #[max_len(MAX_KMS_REF_LEN)]
    pub kms_ref: String,

    pub seq: u64,

    pub enc_version: u16,
    pub enc_algo: EncAlgo,

    pub created_at: i64,
    pub updated_at: i64,

    pub bump: u8,

    // --- START: NEW ON-CHAIN ATTRIBUTES ---
    /// The patient's main wallet pubkey (denormalized from Patient account)
    pub patient_pubkey: Pubkey,

    /// The hospital's authority pubkey (denormalized from Hospital account)
    pub hospital_pubkey: Pubkey,

    #[max_len(MAX_HOSPITAL_NAME_LEN)]
    pub hospital_name: String,

    #[max_len(MAX_DOCTOR_NAME_LEN)]
    pub doctor_name: String,
}

/// PDA: [SEED_ACCESS, patient, record, grantee]
#[account]
#[derive(InitSpace)]
pub struct AccessEnvelope {
    pub patient: Pubkey,
    pub record: Pubkey,
    pub grantee: Pubkey,

    #[max_len(MAX_WRAP_DEK_LEN)]
    pub edek_for_grantee: Vec<u8>,
    pub edek_grantee_algo: WrapAlgo,

    #[max_len(MAX_KMS_REF_LEN)]
    pub grantee_kms_ref: String,

    pub created_at: i64,
    pub bump: u8,
}

/// Grant (Per-Grantee)
/// PDA: [SEED_GRANT, patient, grantee, scope_byte]
#[account]
#[derive(InitSpace)]
pub struct Grant {
    pub patient: Pubkey,
    pub grantee: Pubkey,
    pub scope: u8,

    pub created_by: Pubkey,
    pub created_at: i64,
    pub via_trustee: bool,

    pub revoked: bool,
    pub revoked_at: Option<i64>,

    pub bump: u8,
}

/// PDA: [b"consent", patient, record, grantee, nonce16]
/// Urgent only
#[account]
#[derive(InitSpace)]
pub struct Consent {
    pub patient: Pubkey,
    pub record: Pubkey,

    pub grantee: Pubkey,

    pub scope: u8,

    #[max_len(MAX_KMS_REF_LEN)]
    pub kms_ref: String,

    pub edek_root_digest: [u8; 32],

    pub nonce16: [u8; 16],
    pub expires_at: i64,

    pub used: bool, //default = false, kalo sudah dec, used = true.

    pub created_at: i64,
    pub bump: u8,
}

/// PDA: [b"trustee", patient, trustee]
#[account]
#[derive(InitSpace)]
pub struct Trustee {
    pub patient: Pubkey,
    pub trustee: Pubkey,
    pub added_by: Pubkey,
    pub created_at: i64,
    pub revoked: bool,
    pub revoked_at: Option<i64>,
    pub bump: u8,
}
