import MCR from "monocart-coverage-reports";
import { coverageOptions, E2E_COVERAGE } from "./coverage";

export default async function globalTeardown(): Promise<void> {
  if (E2E_COVERAGE) await MCR(coverageOptions).generate();
}
