# OLEFOOT wordlist — EN

The 2048 words the OLEFOOT wallet builds recovery phrases from.

**This list is published on purpose.** A custom wordlist means the phrase does
not import into Phantom, Solflare or any other wallet. If the list lived only
inside our code, "your wallet is yours" would be false — whoever holds the
phrase could not recover the funds without us. It is here so that any developer
can rebuild the wallet from the phrase, with or without OLEFOOT.

## The rules, and why each one exists

| Rule | Why |
|---|---|
| Exactly **2048** words | BIP39 maps 11 bits per word; any other count breaks the scheme |
| **First 4 letters are unique** | lets a wallet recover a word from its beginning |
| **4 to 8 letters, `a-z` only** | no accents to mistype, no length that tires the hand |
| **No two words differ by one letter** | the rule the 4-letter prefix does NOT catch. Someone writes `bar`, reads back `ban`, loses the money. Before this rule the list had 300 such pairs (`bag/ban/bar`, `area/arena`) |
| **Sorted alphabetically** | binary search on recovery |

## What is in it

1.104 words are football itself: actions, positions, the pitch, kit, match
events, competitions, tactics, terrace culture, the transfer market, club
nicknames, kit colours, the laws of the game, and terms football borrowed from
other languages (`libero`, `volante`, `rabona`, `golazo`).

The remaining 944 are plain, widely spelled English. That is deliberate: a
recovery phrase is written by hand, often by someone who does not speak
English. `erdenet` and `petrolul` were in an earlier draft and were cut for
exactly that reason.

## Rebuilding it

```bash
node gerar.mjs vocabulario.txt olefoot-wordlist-en.txt   # builds
node conferir.mjs olefoot-wordlist-en.txt                # checks, from scratch
```

`gerar.mjs` applies the rules and, when the vocabulary yields more than 2048,
cuts by the priority each category declares (`#! alta | media | baixa`) — the
football lexicon is never what gets dropped. `conferir.mjs` re-checks the
finished file without trusting the generator.

## Changing it

Don't, once a single wallet exists. Every phrase already written down depends
on this exact list, in this exact order. A new list is a new wallet.
