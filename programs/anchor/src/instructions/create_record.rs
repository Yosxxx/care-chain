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
    // --- NEW ARGS ---
    hospital_name: String,
    doctor_name: String,
) -> Result<()> {
    // 1) Global pause
    require!(!ctx.accounts.config.paused, RecordError::Paused);

    // 2) Hospital authority must match uploader (hospital wallet)
    require_keys_eq!(
        ctx.accounts.hospital.authority,
        ctx.accounts.uploader.key(),
        RecordError::UploaderNotHospitalAuthority
    );

    // 3) Payer must be the patient (patient funds the init/rent)
    require_keys_eq!(
        ctx.accounts.payer.key(),
        ctx.accounts.patient.patient_pubkey,
        RecordError::PayerMustBePatient
    );

    let now = Clock::get()?.unix_timestamp;

    // 5) Trim inputs
    let cid_trim = cid_enc.trim();
    let mime_trim = meta_mime.trim();
    let meta_trim = meta_cid.trim();
    let kms_trim = kms_ref.trim();

    let hospital_name_trim = hospital_name.trim();
    let doctor_name_trim = doctor_name.trim();

    // 6) Validate lengths & requireds
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
        hospital_name_trim.len() <= MAX_HOSPITAL_NAME_LEN,
        RecordError::HospitalNameTooLong
    );
    require!(
        doctor_name_trim.len() <= MAX_DOCTOR_NAME_LEN,
        RecordError::DoctorNameTooLong
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

    // 7) Sequence
    let ps = &mut ctx.accounts.patient_seq;
    require!(seq == ps.value, RecordError::BadSeq);
    ps.value = ps.value.checked_add(1).ok_or(RecordError::SeqOverflow)?;

    // 8) Fill record
    let rec = &mut ctx.accounts.record;
    rec.patient = ctx.accounts.patient.key();
    rec.hospital = ctx.accounts.hospital.key();
    rec.uploader = ctx.accounts.uploader.key(); // hospital as uploader

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

    // Denorm & extra fields
    rec.patient_pubkey = ctx.accounts.patient.patient_pubkey;
    rec.hospital_pubkey = ctx.accounts.hospital.authority;

    rec.hospital_name = hospital_name_trim.to_string();
    rec.doctor_name = doctor_name_trim.to_string();

    // 9) Emit
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
    /// Hospital signer (initiator / fee payer on the client)
    #[account(mut)]
    pub uploader: Signer<'info>,

    /// Patient must co-sign as payer (rent payer)
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(seeds = [SEED_CONFIG], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(seeds = [SEED_PATIENT, patient.patient_pubkey.as_ref()], bump = patient.bump)]
    pub patient: Account<'info, Patient>,

    #[account(
        mut,
        seeds = [SEED_PATIENT_SEQ, patient.key().as_ref()],
        bump = patient_seq.bump,
        constraint = patient_seq.patient == patient.key() @ RecordError::BadSeq
    )]
    pub patient_seq: Account<'info, PatientSeq>,

    #[account(seeds = [SEED_HOSPITAL, hospital.authority.as_ref()], bump = hospital.bump)]
    pub hospital: Account<'info, Hospital>,

    #[account(
        seeds = [SEED_GRANT, patient.key().as_ref(), hospital.authority.as_ref(), &[SCOPE_WRITE]],
        bump = grant_write.bump,
        constraint = grant_write.patient == patient.key()      @ RecordError::GrantMismatch,
        constraint = grant_write.grantee == hospital.authority @ RecordError::GrantMismatch,
        constraint = !grant_write.revoked                      @ RecordError::GrantRevoked,
    )]
    pub grant_write: Account<'info, Grant>,

    #[account(
        init,
        payer = payer, // rent from patient
        space = 8 + Record::INIT_SPACE,
        seeds = [SEED_RECORD, patient.key().as_ref(), &seq.to_le_bytes()],
        bump
    )]
    pub record: Account<'info, Record>,

    pub system_program: Program<'info, System>,
}
