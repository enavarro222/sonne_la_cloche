import MCR from "monocart-coverage-reports";
import { coverageOptions, E2E_COVERAGE } from "./coverage";

export default function globalSetup(): void {
  if (E2E_COVERAGE) MCR(coverageOptions).cleanCache();
}
