# Curated state law URLs

`CuratedStateLawUrls.json` holds official .gov URLs used to fetch late-fee and security-deposit law text before the AI summarizes it. When a state has a URL, the job fetches that page and asks the AI to extract only from that text (no guessing).

## Starter set (included)

- **NC** – ncleg.gov Chapter 42 (late fee & security deposit)
- **CA** – leginfo.legislature.ca.gov (Civil Code 1947.3 late fee, 1950.5 security deposit)
- **TX** – statutes.capitol.texas.gov Property Code Chapter 92
- **FL** – leg.state.fl.us Chapter 83
- **KS** – kslegislature.gov (58-816a late fee, Ch 58 Art 8 deposit)

## Adding or fixing URLs

1. Search for official state sources, e.g.  
   `"[State name] late fee grace period landlord tenant statute site:.gov"`  
   `"[State name] security deposit landlord tenant statute site:.gov"`
2. Prefer **statute pages** (state legislature) over summary/handbook pages; they change less often.
3. Add an entry under `sources` with the 2-letter state code and `lateFeeUrl` and/or `securityDepositUrl`. Use `null` if you don’t have a URL (the job will fall back to AI-only for that state).
4. If a URL breaks (404, moved), update or remove it and re-run the job for that state.

## File location

The file is read from `Config/CuratedStateLawUrls.json` (content root). It is copied to the output directory so it works when running or publishing the API.
