// Remembers who bred whom for the last few generations, so a leader's pedigree can be drawn.

export class Lineage {
  constructor(keepGens = 4) {
    this.keepGens = keepGens;
    this.byId = new Map();
    this.gens = [];
  }

  record(gen, entries) {
    const ids = [];
    for (const e of entries) {
      this.byId.set(e.id, { ...e, gen });
      ids.push(e.id);
    }
    this.gens.push(ids);
    while (this.gens.length > this.keepGens) {
      for (const id of this.gens.shift()) this.byId.delete(id);
    }
  }

  get(id) {
    return this.byId.get(id);
  }

  ancestry(id, depth) {
    const node = this.get(id);
    if (!node) return null;
    const parents = depth > 1 ? node.parents.map(p => this.ancestry(p, depth - 1)).filter(Boolean) : [];
    return { node, parents };
  }

  clear() {
    this.byId.clear();
    this.gens = [];
  }
}
