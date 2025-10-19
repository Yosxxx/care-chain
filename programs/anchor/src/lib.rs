use anchor_lang::prelude::*;

pub mod errors;
pub mod event;
pub mod instructions;
pub mod states;

use instructions::*;
use states::*;

declare_id!("CNnNnMmhqyTgK3xJ8WWEYSErdGnw5nGZ9mDCyHjyVnzh");

#[program]
pub mod anchor {
    use super::*;

    pub fn init_config(ctx: Context<InitConfig>, kms_namespace: String) -> Result<()> {
        config_init(ctx, kms_namespace)
    }

    pub fn register_hospitals(
        ctx: Context<RegisterHospitals>,
        name: String,
        kms_ref: String,
    ) -> Result<()> {
        hospitals_register(ctx, name, kms_ref)
    }

    pub fn create_record(
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
        note: String,
        enc_version: u16,
        enc_algo: EncAlgo,
    ) -> Result<()> {
        record_create(
            ctx,
            seq,
            cid_enc,
            meta_mime,
            meta_cid,
            size_bytes,
            blake2b_256,
            edek_root,
            edek_for_patient,
            edek_for_hospital,
            edek_root_algo,
            edek_patient_algo,
            edek_hospital_algo,
            kms_ref,
            note,
            enc_version,
            enc_algo,
        )
    }

    pub fn upsert_patient(
        ctx: Context<UpsertPatient>,
        id_hash: [u8; 32],
        did: String,
    ) -> Result<()> {
        patient_upsert(ctx, id_hash, did)
    }

    pub fn grant_access(
        ctx: Context<GrantAccess>,
        scope: u8,
        expires_at: Option<i64>,
    ) -> Result<()> {
        access_grant(ctx, scope, expires_at)
    }

    pub fn revoke_grant(ctx: Context<RevokeGrant>) -> Result<()> {
        grant_revoke(ctx)
    }

    pub fn set_paused(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
        paused_set(ctx, paused)
    }
}
