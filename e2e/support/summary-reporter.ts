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

/**
 * Resumen: aprobadas, falladas, fallos conocidos, conocidos que ya pasan, conocidos que agotan el tiempo e inestables.
 *
 * Con test.fail() Playwright solo espera el estado "failed": un fallo conocido que agota el tiempo sale "unexpected"
 * igual que uno que ya pasa. Aquí se separan por el estado del último intento, para no pedir quitar la marca de una
 * prueba que sigue sin pasar (spec 060).
 */
export default class SummaryReporter implements Reporter {
  private passed: Entry[] = [];
  private failed: Entry[] = [];
  private known: Entry[] = [];
  private knownPassing: Entry[] = [];
  private knownTimedOut: Entry[] = [];
  private flaky: Entry[] = [];
  private skipped = 0;
  // Último intento de cada prueba: un reintento reemplaza al anterior, así ninguna se cuenta dos veces.
  private last = new Map<string, { test: TestCase; result: TestResult }>();

  printsToStdio(): boolean {
    return false;
  }

  private finding(test: TestCase): string | undefined {
    return test.annotations.find((a) => a.type === "known-failure")?.description;
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    this.last.set(test.id, { test, result });
  }

  private classify(test: TestCase, result: TestResult): void {
    if (result.status === "skipped") {
      this.skipped += 1;
      return;
    }
    const entry: Entry = { title: test.titlePath().slice(1).join(" > "), finding: this.finding(test) };
    const outcome = test.outcome();
    if (outcome === "flaky") {
      this.flaky.push(entry);
    } else if (entry.finding) {
      // test.fail(): outcome "expected" = sigue fallando; "unexpected" = ya pasa o se quedó esperando.
      if (outcome === "expected") this.known.push(entry);
      else if (result.status === "passed") this.knownPassing.push(entry);
      else this.knownTimedOut.push(entry);
    } else if (outcome === "expected") {
      this.passed.push(entry);
    } else if (outcome === "unexpected") {
      this.failed.push(entry);
    }
  }

  onEnd(result: FullResult): void {
    for (const { test, result: last } of this.last.values()) this.classify(test, last);
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
      line("Conocidos que agotan el tiempo (deben fallar, no esperar)", this.knownTimedOut),
      line("Inestables", this.flaky),
      `  Omitidas: ${this.skipped}`,
      `  Estado: ${result.status}`,
    ];
    for (const e of this.failed) out.push(`  FALLA: ${e.title}`);
    for (const e of this.knownPassing) out.push(`  YA PASA: ${e.title} [${e.finding}]`);
    for (const e of this.knownTimedOut) out.push(`  AGOTA EL TIEMPO: ${e.title} [${e.finding}]`);
    console.log(out.join("\n"));
  }
}
