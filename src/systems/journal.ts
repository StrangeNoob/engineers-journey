const KEY = "ej.visited";
export class Journal {
  private visited = new Set<string>();
  constructor(private readonly all: string[]) {
    try { JSON.parse(localStorage.getItem(KEY) ?? "[]").forEach((id: string) => this.visited.add(id)); } catch { /* ignore */ }
  }
  recall(id: string): void { this.visited.add(id); this.save(); }
  isVisited(id: string): boolean { return this.visited.has(id); }
  get count(): number { return this.visited.size; }
  get total(): number { return this.all.length; }
  private save(): void { try { localStorage.setItem(KEY, JSON.stringify([...this.visited])); } catch { /* ignore */ } }
}
