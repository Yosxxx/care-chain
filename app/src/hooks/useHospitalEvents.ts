"use client";
import { useEffect, useRef } from "react";
import * as anchor from "@coral-xyz/anchor";

export function useHospitalEvents(program: anchor.Program | null | undefined, onEvent: (e: any)=>void) {
  const subRef = useRef<number|null>(null);
  useEffect(() => {
    if (!program) return;
    (async () => {
      subRef.current = await program.addEventListener("HospitalRegistered", (e) => onEvent(e));
    })();
    return () => {
      if (subRef.current !== null) program.removeEventListener(subRef.current).catch(()=>{});
      subRef.current = null;
    };
  }, [program, onEvent]);
}
