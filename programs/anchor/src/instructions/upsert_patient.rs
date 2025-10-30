// INSTRUCTION FOR CREATING / UPDATING PATIENT DATA

use crate::errors::PatientError;
use crate::event::PatientUpserted;
use crate::states::*;
use anchor_lang::prelude::*;

pub fn patient_upsert(ctx: Context<UpsertPatient>, did: String) -> Result<()> {
    require!(did.len() <= MAX_DID_LEN, PatientError::DidTooLong);

    let now = Clock::get()?.unix_timestamp;

    let p = &mut ctx.accounts.patient;
    let new_p = p.created_at == 0;

    if new_p {
        p.patient_pubkey = ctx.accounts.authority.key();
        p.did = did;
        p.created_at = now;
        p.bump = ctx.bumps.patient;

        let seq = &mut ctx.accounts.patient_seq;
        seq.patient = p.key();
        seq.value = 0;
        seq.bump = ctx.bumps.patient_seq;
    } else {
        require_keys_eq!(
            p.patient_pubkey,
            ctx.accounts.authority.key(),
            PatientError::Unauthorized
        );
        p.did = did;
    }

    emit!(PatientUpserted {
        patient: p.key(),
        patient_pubkey: p.patient_pubkey,
        created: new_p,
        created_at: p.created_at,
        updated_at: now,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct UpsertPatient<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + Patient::INIT_SPACE,
        seeds = [SEED_PATIENT, authority.key().as_ref()],
        bump
    )]
    pub patient: Account<'info, Patient>,

    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + 32 + 8 + 1,
        seeds = [SEED_PATIENT_SEQ, patient.key().as_ref()],
        bump
    )]
    pub patient_seq: Account<'info, PatientSeq>,

    pub system_program: Program<'info, System>,
}
