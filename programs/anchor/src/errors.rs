use anchor_lang::prelude::*;

#[error_code]
pub enum ConfigError {
    #[msg("Config already initialized")]
    AlreadyInitialized,
    #[msg("KMS namespace is empty")]
    EmptyKmsNamespace,
    #[msg("KMS namespace too long")]
    KmsNamespaceTooLong,
    #[msg("Program is paused; action not allowed")]
    Paused,
    #[msg("Only config authority may pause/unpause the program")]
    UnauthorizedPauseAction,
}

#[error_code]
pub enum HospitalError {
    #[msg("Program is paused; action not allowed")]
    Paused,
    #[msg("Only config authority may register hospitals")]
    UnauthorizedRegistrar,
    #[msg("Hospital name is empty")]
    EmptyName,
    #[msg("Hospital name too long")]
    NameTooLong,
    #[msg("KMS reference is empty")]
    EmptyKmsRef,
    #[msg("KMS reference too long")]
    KmsRefTooLong,
}

#[error_code]
pub enum PatientError {
    #[msg("Unauthorized: only the patient wallet may update this account")]
    Unauthorized,
    #[msg("DID too long")]
    DidTooLong,
}

#[error_code]
pub enum RecordError {
    #[msg("Program is paused")]
    Paused,
    #[msg("Uploader must be the hospital authority")]
    UploaderNotHospitalAuthority,
    #[msg("WRITE grant is revoked")]
    GrantRevoked,
    #[msg("WRITE grant is expired")]
    GrantExpired,
    #[msg("WRITE grant does not match patient/hospital")]
    GrantMismatch,
    #[msg("Bad sequence number")]
    BadSeq,
    #[msg("Sequence overflow")]
    SeqOverflow,
    #[msg("cid_enc is empty")]
    EmptyCidEnc,
    #[msg("meta_mime is empty")]
    EmptyMime,
    #[msg("size_bytes must be > 0")]
    SizeZero,
    #[msg("kms_ref must be non-empty when edek_root_algo=Kms")]
    KmsRefRequired,
    #[msg("edek_for_patient is empty")]
    EdekPatientMissing,
    #[msg("edek_for_hospital is empty")]
    EdekHospitalMissing,
    #[msg("cid_enc too long")]
    CidTooLong,
    #[msg("meta_mime too long")]
    MimeTooLong,
    #[msg("meta_cid too long")]
    MetaCidTooLong,
    #[msg("note too long")]
    NoteTooLong,
    #[msg("kms_ref too long")]
    KmsRefTooLong,
}

#[error_code]
pub enum AccessError {
    #[msg("Program is paused")]
    Paused,
    #[msg("Only the patient (owner) may create a grant")]
    UnauthorizedGrant,
    #[msg("Scope must only include READ/WRITE/ADMIN bits and not be zero")]
    InvalidScope,
    #[msg("Expiry must be in the future")]
    BadExpiry,
    #[msg("Grant already revoked")]
    AlreadyRevoked,
    #[msg("Only the patient (owner) may revoke this grant")]
    UnauthorizedRevoke,
}
