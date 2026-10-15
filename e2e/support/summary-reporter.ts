import type {
  FullResult,
  Reporter,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";

interface Entry {
  title: string;
  finding?: string;
}

/** Resumen: aprobadas, falladas, fallos conocidos, conocidos que ya pasan e inestables. */
export default class SummaryReporter implements Reporter {
  private passed: Entry[] = [];
  private failed: Entry[] = [];
  private known: Entry[] = [];
  private knownPassing: Entry[] = [];
  private flaky: Entry[] = [];
  private skipped = 0;

  printsToStdio(): boolean {
    return false;
  }

  private finding(test: TestCase): string | undefined {
    return test.annotations.find((a) => a.type === "known-failure")?.description;
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    // Solo el intento final de cada prueba.
    if (result.status === "skipped") {
      this.skipped += 1;
      return;
    }
    if (result.retry < test.retries && result.status !== "passed" && result.status !== test.expectedStatus) {
      return;
    }
    const entry: Entry = { title: test.titlePath().slice(1).join(" > "), finding: this.finding(test) };
    const outcome = test.outcome();
    if (outcome === "flaky") {
      this.flaky.push(entry);
    } else if (entry.finding) {
      // test.fail(): outcome "expected" = sigue fallando; "unexpected" = ya pasa.
      if (outcome === "expected") this.known.push(entry);
      else this.knownPassing.push(entry);
    } else if (outcome === "expected") {
      this.passed.push(entry);
    } else if (outcome === "unexpected") {
      this.failed.push(entry);
    }
  }

  onEnd(result: FullResult): void {
    const line = (label: string, list: Entry[]) => {
      const detail = list.filter((e) => e.finding).map((e) => e.finding);
      return `  ${label}: ${list.length}${detail.length ? ` (${detail.join(", ")})` : ""}`;
    };
    const out = [
      "",
      "Resumen e2e",
      line("Aprobadas", this.passed),
      line("Falladas", this.failed),
      line("Fallos conocidos", this.known),
      line("Conocidos que ya pasan (quitar knownFailure)", this.knownPassing),
      line("Inestables", this.flaky),
      `  Omitidas: ${this.skipped}`,
      `  Estado: ${result.status}`,
    ];
    for (const e of this.failed) out.push(`  FALLA: ${e.title}`);
    for (const e of this.knownPassing) out.push(`  YA PASA: ${e.title} [${e.finding}]`);
    console.log(out.join("\n"));
  }
}
