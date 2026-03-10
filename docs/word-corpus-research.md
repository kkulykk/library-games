# Word Corpus Research

Research into making word lists more extensive and diverse across all games that use them.

## Current State

| Game        | File                                        | Words                                    | Description                             |
| ----------- | ------------------------------------------- | ---------------------------------------- | --------------------------------------- |
| **Wordle**  | `src/games/wordle/logic.ts` (lines 84–804)  | **719** 5-letter words                   | Daily word selection + guess validation |
| **Hangman** | `src/games/hangman/logic.ts` (lines 5–343)  | **337** words (8–11 letters)             | Random word per game                    |
| **Skribbl** | `src/games/skribbl/logic.ts` (lines 78–363) | **283** (122 single words + 161 phrases) | 3 random choices offered to the drawer  |

All lists are hardcoded as TypeScript arrays inside `logic.ts` files.

### Problems

- **Wordle (719 words):** The cycle repeats in ~2 years. The original Wordle had 2,309 answer words + ~10,657 valid guesses. Our game also accepts invalid English words as guesses with no rejection feedback.
- **Hangman (337 words):** Players encounter repeats quickly. No difficulty tiers — all words are roughly the same length/complexity.
- **Skribbl (283 words):** Very limited for a multiplayer game. No category organization.

---

## Recommended Datasets

### Wordle

| Source                                                                                        | Size              | License       | Notes                                                                     |
| --------------------------------------------------------------------------------------------- | ----------------- | ------------- | ------------------------------------------------------------------------- |
| [Original Wordle answers](https://gist.github.com/cfreshman/a03ef2cba789d8cf00c08f767e0fad7b) | **2,309** words   | Public domain | The canonical curated answer set — common, recognizable 5-letter words    |
| [Valid Wordle guesses](https://gist.github.com/dracos/dd0668f281e685bad51479e5acaadb93)       | **~12,972** words | Public domain | Full dictionary of accepted 5-letter guesses (includes less common words) |
| [steve-kasica/wordle-words](https://github.com/steve-kasica/wordle-words)                     | 2,309 + metadata  | MIT           | Includes word frequency data for difficulty ordering                      |
| [ENABLE word list](https://github.com/BartMassey/wordlists) (filtered to 5 letters)           | ~8,600 words      | Public domain | Scrabble-quality dictionary, more exhaustive                              |
| [LaurentLessard/wordlesolver](https://github.com/LaurentLessard/wordlesolver)                 | 2,309 + 10,638    | Public domain | Clean split of solutions vs. non-solution valid guesses                   |

**Recommendation:** Use the **2,309 answer words** as the answer pool (3.2x increase) and **~12,972 valid guesses** as the validation dictionary. This mirrors the real Wordle's two-list architecture — one curated list for answers, one broader list for accepted guesses.

### Hangman

| Source                                                                                    | Size                                | License          | Notes                                                      |
| ----------------------------------------------------------------------------------------- | ----------------------------------- | ---------------- | ---------------------------------------------------------- |
| [Peter Norvig's count_1w.txt](https://norvig.com/ngrams/)                                 | 333,000 words with frequency counts | MIT              | Frequency counts enable difficulty tiers                   |
| [colinscape/norvig-frequencies](https://github.com/colinscape/norvig-frequencies)         | 97,565 words                        | MIT              | Pre-sorted by frequency                                    |
| [first20hours/google-10000-english](https://github.com/first20hours/google-10000-english) | 10,000 words                        | Derived from MIT | Frequency-ordered, includes no-swears variant              |
| [wordlist-english](https://www.npmjs.com/package/wordlist-english) npm                    | ~100K+ words                        | MIT              | Frequency-banded (10–70), SCOWL-derived                    |
| [wordnik/wordlist](https://github.com/wordnik/wordlist)                                   | 198,422 words                       | MIT              | Purpose-built for games, offensive words labeled           |
| [TheBiemGamer/The-Hangman-Wordlist](https://github.com/TheBiemGamer/The-Hangman-Wordlist) | Varies                              | Unknown          | Built-in easy/medium/hard tiers, purpose-built for hangman |

**Recommendation:** Use **Norvig's count_1w.txt** (MIT), filter to 4–12 letter words, cross-reference with ENABLE for dictionary validity, and bucket into difficulty tiers by frequency rank:

- **Easy:** Top 3,000 by frequency, 4–6 letters (~500–800 words after filtering)
- **Medium:** Rank 3,000–15,000, 6–9 letters (~1,000–2,000 words)
- **Hard:** Rank 15,000+, 8–12 letters, less common (~1,000–2,000 words)

This gives **~3,000–5,000 total words** with meaningful difficulty selection vs. 337 today.

### Skribbl (Drawable Words)

| Source                                                                                                 | Size           | License   | Notes                                                         |
| ------------------------------------------------------------------------------------------------------ | -------------- | --------- | ------------------------------------------------------------- |
| [skribbliohints (skribbl.io default list)](https://github.com/skribbliohints/skribbliohints.github.io) | ~800+ words    | Public    | Actual skribbl.io word bank with difficulty/popularity data   |
| [shrugify/skribbl-wordlists](https://github.com/shrugify/skribbl-wordlists)                            | Multiple lists | Public    | Community-curated drawable words for skribbl.io               |
| [lists4skribbl.com](https://lists4skribbl.com/)                                                        | 15+ categories | Community | Categorized drawable words (animals, food, objects, etc.)     |
| [david47k/top-english-wordlists](https://github.com/david47k/top-english-wordlists)                    | Various        | Public    | Separate noun/verb/adjective lists — filter to drawable nouns |
| [scribblio-word-generator](https://github.com/mwagnurr/scribblio-word-generator)                       | Generator      | MIT       | Uses Datamuse API to expand word lists from seed words        |

**Recommendation:** Pull the **skribbl.io default word bank** (~800 words) as a base, supplement with community lists from shrugify and lists4skribbl, and organize by category (animals, food, objects, places, actions, etc.). Target **~800–1,200 words** (3–4x increase) with category metadata for potential themed rounds.

---

## Implementation Plan

### Approach: Static JSON files with dynamic import

```
src/data/words/
  wordle-answers.json         # 2,309 words — answer pool
  wordle-valid-guesses.json   # ~12,972 words — validation dictionary
  hangman-easy.json           # frequency band easy, 4–6 letters
  hangman-medium.json         # frequency band medium, 6–9 letters
  hangman-hard.json           # frequency band hard, 8–12 letters
  skribbl-words.json          # categorized drawable words/phrases
```

**Why this approach:**

- JSON files work with Next.js static export (no server needed)
- Can be dynamically imported (`import()`) per game — only loads what's needed
- Keeps `logic.ts` files clean — pure functions, word lists imported separately
- Easy to update/expand independently of game logic

### Bundle Size Estimates

| Dataset              | Words              | Approx. size (gzipped) |
| -------------------- | ------------------ | ---------------------- |
| Wordle answers       | 2,309              | ~8 KB                  |
| Wordle valid guesses | 12,972             | ~45 KB                 |
| Hangman (all tiers)  | ~3,000–5,000       | ~15–25 KB              |
| Skribbl (expanded)   | ~800–1,200         | ~5–8 KB                |
| **Total**            | **~19,000–21,000** | **~73–86 KB**          |

Negligible impact on page load — well within budget for a static site.

### Migration Steps

1. Create `src/data/words/` directory with JSON word files
2. Add a build-time script (`scripts/build-word-lists.ts`) that:
   - Downloads/reads source datasets
   - Filters, deduplicates, and validates words
   - Outputs the JSON files
3. Update `src/games/wordle/logic.ts`:
   - Import answers from `wordle-answers.json`
   - Add separate validation against `wordle-valid-guesses.json`
   - Add "not a valid word" feedback for invalid guesses
4. Update `src/games/hangman/logic.ts`:
   - Accept difficulty parameter in `getRandomWord()`
   - Import from appropriate difficulty JSON
5. Update `src/games/skribbl/logic.ts`:
   - Import categorized words from `skribbl-words.json`
   - Optionally support category-based word picking
6. Update tests to cover new word list loading
7. Remove hardcoded word arrays from `logic.ts` files

---

## Key Sources

- [cfreshman Wordle answers](https://gist.github.com/cfreshman/a03ef2cba789d8cf00c08f767e0fad7b)
- [LaurentLessard/wordlesolver](https://github.com/LaurentLessard/wordlesolver) (clean solution/non-solution split)
- [Peter Norvig's ngrams](https://norvig.com/ngrams/)
- [colinscape/norvig-frequencies](https://github.com/colinscape/norvig-frequencies)
- [first20hours/google-10000-english](https://github.com/first20hours/google-10000-english)
- [ENABLE word list](https://github.com/BartMassey/wordlists)
- [wordnik/wordlist](https://github.com/wordnik/wordlist)
- [wordlist-english npm](https://www.npmjs.com/package/wordlist-english)
- [skribbliohints](https://github.com/skribbliohints/skribbliohints.github.io)
- [shrugify/skribbl-wordlists](https://github.com/shrugify/skribbl-wordlists)
- [lists4skribbl.com](https://lists4skribbl.com/)
- [an-array-of-english-words npm](https://www.npmjs.com/package/an-array-of-english-words)
- [sindresorhus/word-list](https://github.com/sindresorhus/word-list)
