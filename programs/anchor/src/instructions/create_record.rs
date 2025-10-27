use crate::errors::RecordError;
use crate::event::RecordCreated;
use crate::states::*;
use anchor_lang::prelude::*;

#[allow(clippy::too_many_arguments)]
pub fn record_create(
    ctx: Context<CreateRecord>,
    seq: u64,
    cid_enc: String,
    meta_mime: String,
    meta_cid: String,
    size_bytes: u64,
    blake2b_256: [u8; 32],
    edek_root: Vec<u8>,
    edek_for_patient: Vec<u8>,
    edek_for_hospital: Vec<u8>,
    edek_root_algo: WrapAlgo,
    edek_patient_algo: WrapAlgo,
    edek_hospital_algo: WrapAlgo,
    kms_ref: String,
    enc_version: u16,
    enc_algo: EncAlgo,
    // --- START: NEW ARGUMENTS ---
    hospital_id: String,
    hospital_name: String,
    doctor_name: String,
    doctor_id: String,
    diagnosis: String,
    keywords: String,
    description: String,
    // --- END: NEW ARGUMENTS ---
) -> Result<()> {
    require!(!ctx.accounts.config.paused, RecordError::Paused);
    require_keys_eq!(
        ctx.accounts.hospital.authority,
        ctx.accounts.uploader.key(),
        RecordError::UploaderNotHospitalAuthority
    );

    let now = Clock::get()?.unix_timestamp;
    if let Some(exp) = ctx.accounts.grant_write.expires_at {
        require!(exp > now, RecordError::GrantExpired);
    }

    let cid_trim = cid_enc.trim();
    let mime_trim = meta_mime.trim();
    let meta_trim = meta_cid.trim();
    let kms_trim = kms_ref.trim();

    // --- START: TRIM NEW STRINGS ---
    let hospital_id_trim = hospital_id.trim();
    let hospital_name_trim = hospital_name.trim();
    let doctor_name_trim = doctor_name.trim();
    let doctor_id_trim = doctor_id.trim();
    let diagnosis_trim = diagnosis.trim();
    let keywords_trim = keywords.trim();
    let description_trim = description.trim();
    // --- END: TRIM NEW STRINGS ---

    require!(!cid_trim.is_empty(), RecordError::EmptyCidEnc);
    require!(cid_trim.len() <= MAX_CID_LEN, RecordError::CidTooLong);

    require!(!mime_trim.is_empty(), RecordError::EmptyMime);
    require!(
        mime_trim.len() <= MAX_META_MIME_LEN,
        RecordError::MimeTooLong
    );

    require!(meta_trim.len() <= MAX_CID_LEN, RecordError::MetaCidTooLong);
    require!(
        kms_trim.len() <= MAX_KMS_REF_LEN,
        RecordError::KmsRefTooLong
    );

    require!(
        hospital_id_trim.len() <= MAX_HOSPITAL_ID_LEN,
        RecordError::HospitalIdTooLong
    );
    require!(
        hospital_name_trim.len() <= MAX_HOSPITAL_NAME_LEN,
        RecordError::HospitalNameTooLong
    );
    require!(
        doctor_name_trim.len() <= MAX_DOCTOR_NAME_LEN,
        RecordError::DoctorNameTooLong
    );
    require!(
        doctor_id_trim.len() <= MAX_DOCTOR_ID_LEN,
        RecordError::DoctorIdTooLong
    );
    require!(
        diagnosis_trim.len() <= MAX_DIAGNOSIS_LEN,
        RecordError::DiagnosisTooLong
    );
    require!(
        keywords_trim.len() <= MAX_KEYWORDS_LEN,
        RecordError::KeywordsTooLong
    );
    require!(
        description_trim.len() <= MAX_DESCRIPTION_LEN,
        RecordError::DescriptionTooLong
    );

    require!(size_bytes > 0, RecordError::SizeZero);

    require!(
        !edek_for_patient.is_empty(),
        RecordError::EdekPatientMissing
    );
    require!(
        !edek_for_hospital.is_empty(),
        RecordError::EdekHospitalMissing
    );

    if matches!(edek_root_algo, WrapAlgo::Kms) {
        require!(!kms_trim.is_empty(), RecordError::KmsRefRequired);
    }

    let ps = &mut ctx.accounts.patient_seq;
    require!(seq == ps.value, RecordError::BadSeq);
    ps.value = ps.value.checked_add(1).ok_or(RecordError::SeqOverflow)?;

    let rec = &mut ctx.accounts.record;
    rec.patient = ctx.accounts.patient.key();
    rec.hospital = ctx.accounts.hospital.key();
    rec.uploader = ctx.accounts.uploader.key();
    rec.cid_enc = cid_trim.to_string();
    rec.meta_mime = mime_trim.to_string();
    rec.meta_cid = meta_trim.to_string();
    rec.size_bytes = size_bytes;
    rec.blake2b_256 = blake2b_256;
    rec.edek_root = edek_root;
    rec.edek_for_patient = edek_for_patient;
    rec.edek_for_hospital = edek_for_hospital;
    rec.edek_root_algo = edek_root_algo;
    rec.edek_patient_algo = edek_patient_algo;
    rec.edek_hospital_algo = edek_hospital_algo;
    rec.kms_ref = kms_trim.to_string();
    rec.seq = seq;
    rec.enc_version = enc_version;
    rec.enc_algo = enc_algo;
    rec.created_at = now;
    rec.updated_at = now;
    rec.bump = ctx.bumps.record;

    // --- START: ASSIGN NEW FIELDS ---
    
    // Assign fields from context (denormalization)
    rec.patient_pubkey = ctx.accounts.patient.patient_pubkey;
    rec.hospital_pubkey = ctx.accounts.hospital.authority; // This is the uploader
    
    // Assign fields from new arguments
    rec.hospital_id = hospital_id_trim.to_string();
    rec.hospital_name = hospital_name_trim.to_string();
    rec.doctor_name = doctor_name_trim.to_string();
    rec.doctor_id = doctor_id_trim.to_string();
    rec.diagnosis = diagnosis_trim.to_string();
    rec.keywords = keywords_trim.to_string();
    rec.description = description_trim.to_string();
    
    // --- END: ASSIGN NEW FIELDS ---

    emit!(RecordCreated {
        record: rec.key(),
        patient: rec.patient,
        hospital: rec.hospital,
        uploader: rec.uploader,
        seq,
        enc_version,
        created_at: now,
    });

    Ok(())
}

#[derive(Accounts)]
#[instruction(seq: u64)]
pub struct CreateRecord<'info> {
    #[account(mut)]
    pub uploader: Signer<'info>,

    #[account(
        seeds = [SEED_CONFIG],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    #[account(
        seeds = [SEED_PATIENT, patient.patient_pubkey.as_ref()],
        bump = patient.bump,
    )]
    pub patient: Account<'info, Patient>,

    #[account(
        mut,
        seeds = [SEED_PATIENT_SEQ, patient.key().as_ref()],
        bump = patient_seq.bump,
        constraint = patient_seq.patient == patient.key() @ RecordError::BadSeq
    )]
    pub patient_seq: Account<'info, PatientSeq>,

    #[account(
        seeds = [SEED_HOSPITAL, hospital.authority.as_ref()],
        bump = hospital.bump,
    )]
    pub hospital: Account<'info, Hospital>,

    #[account(
        seeds = [
            SEED_GRANT,
            patient.key().as_ref(),
            hospital.authority.as_ref(),    
            &[SCOPE_WRITE]
        ],
        bump = grant_write.bump,
        constraint = grant_write.patient == patient.key()                @ RecordError::GrantMismatch,
        constraint = grant_write.grantee == hospital.authority           @ RecordError::GrantMismatch, // <-- compare to authority
        constraint = !grant_write.revoked                                @ RecordError::GrantRevoked,
    )]
    pub grant_write: Account<'info, Grant>,

    #[account(
        init,
        payer = uploader,
        space = 8 + Record::INIT_SPACE,
        seeds = [SEED_RECORD, patient.key().as_ref(), &seq.to_le_bytes()],
        bump
    )]
    pub record: Account<'info, Record>,

    pub system_program: Program<'info, System>,
}
