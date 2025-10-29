use crate::errors::RecordError;
use crate::event::RecordRead;
use crate::states::*;
use anchor_lang::prelude::*;

pub fn records_read(ctx: Context<ReadRecords>, seq: u64) -> Result<()> {
    require!(!ctx.accounts.config.paused, RecordError::Paused);

    // let now = Clock::get()?.unix_timestamp;
    require!(!ctx.accounts.grant_read.revoked, RecordError::GrantRevoked);
    // require!(
    //     ctx.accounts.grant_read.expires_at == Some(0)
    //         || ctx.accounts.grant_read.expires_at > Some(now),
    //     RecordError::GrantExpired
    // );

    require_keys_eq!(
        ctx.accounts.record.patient,
        ctx.accounts.patient.key(),
        RecordError::RecordMismatch
    );
    // require_keys_eq!(
    //     ctx.accounts.record.hospital,
    //     ctx.accounts.hospital.key(),
    //     RecordError::RecordMismatch
    // );

    require_keys_eq!(
        ctx.accounts.patient_seq.patient,
        ctx.accounts.patient.key(),
        RecordError::BadSeq
    );

    require_keys_eq!(
        ctx.accounts.grant_read.patient,
        ctx.accounts.patient.key(),
        RecordError::GrantMismatch
    );
    require_keys_eq!(
        ctx.accounts.grant_read.grantee,
        ctx.accounts.reader.key(),
        RecordError::GrantMismatch
    );

    emit!(RecordRead {
        record: ctx.accounts.record.key(),
        patient: ctx.accounts.patient.key(),
        hospital: ctx.accounts.hospital.key(),
        reader: ctx.accounts.reader.key(),
        seq,
        // ts: now,
    });

    Ok(())
}

#[derive(Accounts)]
#[instruction(seq: u64)]
pub struct ReadRecords<'info> {
    #[account(
        seeds = [SEED_CONFIG],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    pub reader: Signer<'info>,

    #[account(
        seeds = [SEED_PATIENT, patient.patient_pubkey.as_ref()],
        bump = patient.bump,
    )]
    pub patient: Account<'info, Patient>,

    #[account(
        seeds = [SEED_HOSPITAL, hospital.authority.as_ref()],
        bump = hospital.bump,
    )]
    pub hospital: Account<'info, Hospital>,

    #[account(
        seeds = [SEED_PATIENT_SEQ, patient.key().as_ref()],
        bump = patient_seq.bump,
        constraint = patient_seq.patient == patient.key() @ RecordError::BadSeq,
    )]
    pub patient_seq: Account<'info, PatientSeq>,

    #[account(
        seeds = [SEED_GRANT, patient.key().as_ref(), reader.key().as_ref(), &[SCOPE_READ]],
        bump = grant_read.bump,
        constraint = grant_read.patient == patient.key()         @ RecordError::GrantMismatch,
        constraint = grant_read.grantee == reader.key()          @ RecordError::GrantMismatch,
        constraint = !grant_read.revoked                         @ RecordError::GrantRevoked,
    )]
    pub grant_read: Account<'info, Grant>,

    #[account(
        seeds = [SEED_RECORD, patient.key().as_ref(), &seq.to_le_bytes()],
        bump = record.bump
    )]
    pub record: Account<'info, Record>,

    pub system_program: Program<'info, System>,
}
