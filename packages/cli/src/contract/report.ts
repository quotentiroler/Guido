export interface ContractProblem {
  scope: string;
  message: string;
  file?: string;
  line?: number;
}

export interface ContractReport {
  problems: ContractProblem[];
  notes: string[];
}

const escapeData = (text: string): string => text.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
const escapeProperty = (text: string): string => escapeData(text).replace(/:/g, '%3A').replace(/,/g, '%2C');

/** A GitHub Actions workflow command that annotates the problem, on its file and line when known. */
export function githubAnnotation(problem: ContractProblem): string {
  const properties = [
    problem.file && `file=${escapeProperty(problem.file)}`,
    problem.line && `line=${problem.line}`,
    `title=${escapeProperty(problem.scope)}`,
  ].filter(Boolean);
  return `::error ${properties.join(',')}::${escapeData(problem.message)}`;
}

export function formatProblem(problem: ContractProblem): string {
  const location = problem.file ? ` (${problem.file}${problem.line ? `:${problem.line}` : ''})` : '';
  return `❌ ${problem.scope}: ${problem.message}${location}`;
}

export interface ReportOutput {
  github: boolean;
  note: (line: string) => void;
  problem: (line: string) => void;
}

export function printReport(report: ContractReport, output: ReportOutput): void {
  report.notes.forEach((note) => output.note(note));
  if (report.problems.length === 0) return;
  output.note('');
  report.problems.forEach((problem) => output.problem(output.github ? githubAnnotation(problem) : formatProblem(problem)));
  output.note(`\n${report.problems.length} problem${report.problems.length === 1 ? '' : 's'}`);
}
