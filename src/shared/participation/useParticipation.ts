import { useContext } from "react";
import { ParticipationContext } from "./ParticipationProvider";

export function useParticipation() {
  return useContext(ParticipationContext);
}
