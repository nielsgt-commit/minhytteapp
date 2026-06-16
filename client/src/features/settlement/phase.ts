// Phase order and gating live in the shared module so server and client
// can never disagree about which phases a settlement needs.
export {
  SETTLEMENT_PHASES,
  type SettlementPhase,
  nextPhaseIn,
  phaseAtLeast,
  prevPhaseIn,
  requiredPhases,
} from "@server/shared/splitPolicy.ts"
