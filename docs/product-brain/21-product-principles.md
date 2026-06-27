# 21 — Product Principles

Core engineering and product principles. **Every future feature must align with these.** Where
DNA (doc 19) is immutable identity and the North Star (doc 20) is felt experience, these
principles are the working trade-off rules used when designing and building.

---

## The principles (each is a "X over Y" trade-off bias)

1. **Clarity over Complexity** — prefer the simplest model that tells the truth. Complexity must
   earn its place.
2. **Knowledge over Data** — raw data is not the product; structured, linked, explainable
   knowledge is.
3. **Prediction over Reporting** — tell users what *will* happen and what to do, not just what
   happened.
4. **Execution over Administration** — reduce the work of updating the tool; increase the work of
   moving the project.
5. **Understanding over Documentation** — the goal is comprehension; documents are a means.
6. **Relationships over Lists** — model and surface how things connect before enumerating them.
7. **Intelligence over Automation** — understand and explain before automating; never automate a
   black box.
8. **Determinism over Guesswork** — computed truth + evidence over heuristic vibes for any
   status/health/risk shown to users.
9. **Honesty over Optimism** — show "Unknown," "Watch," and "no verified answer" rather than
   overstate.
10. **One source of truth over convenient copies** — centralize engines and knowledge; do not
    re-derive status/knowledge per surface.

## How to use them
- In design reviews, name which principles a proposal advances and which it strains.
- When two principles conflict, record the trade-off (in a spec or ADR) rather than deciding
  silently.
- A feature that aligns with none of these needs an ADR justifying its existence.

---

> Principles are how we decide *how* to build; DNA is *who we are*; the North Star is *what the
> user should feel*; ADRs are *what we decided*; registries are *what exists*.
