# Product decisions

Decided by Seun on 2026-10-22. The full plan, risk register and roadmap live in the
[layered plan](https://claude.ai/artifact/UkpaS3i2jDnBRg2BGz1eWq).

| Topic | Decision |
| --- | --- |
| Red flags before review | Never public. Reports go to a private review queue. |
| Reviewer anonymity | Fully unlinkable. Accounts prove eligibility; reviews carry no account reference. |
| Review panel | In-house moderators until the platform scales. |
| Verification | School email where available, ID card + selfie fallback (deleted within 7 days). Phone OTP deferred (2026-10-22): launch with email sign-in only. |
| Legal backing | None yet. Red flags still publish after in-house review, with safeguards below. |
| Stack | Next.js on Vercel, Supabase (EU region). |
| Staff profiles | Students propose, moderators approve. |
| Referrals to police / school | Only with the student's consent. |
| Institution money | Never. |
| Launch | List every institution; promote 5 to 10 pilot campuses first. |

## Red-flag safeguards

- Publish only on 2+ independent, verified, first-hand reports, or an official outcome (court, school sanction, news).
- Fixed neutral wording: "Multiple credible reports of serious misconduct are under review".
- Staff member notified with 7 days to respond before publication.
- Takedown and appeal form; legal demands answered within 48 hours.
- Every decision logged with reasons (`case_decisions`).

## Anonymous tokens

After verification an account receives a fixed number of blind-signed tokens per
semester (`token_issuance` records only the count). Posting spends a token; the server
stores only its hash (`spent_tokens`), so it can stop double spending without knowing
who spent it. Timestamps on student content are kept to the day.

Accepted trade-off (Seun, 2026-10-22): with unlinkable tokens the server cannot
strictly enforce "one review per student per lecturer". Full anonymity stays; the
per-semester token cap, the 48-hour delay and burst detection limit duplicates instead.

## Flag rules as built (Phase 2)

- Green: published automatically at 3 commendations in 2 years ("Commended by students").
- Yellow: each report is worth 3 points, halving each year and expiring after 2 years. At 10 points the
  case goes to a moderator, who confirms before the flag is published with its top categories.
- Red: always private first. The panel marks each report kept on file or dismissed, with reasons. With 2
  credible reports (or 1 with an official outcome) the panel starts a 7-day reply window. A claimed profile is
  told through the staff portal; an unclaimed one shows a neutral notice on its page for the window ("A case
  about this profile is open. If you are this staff member, claim the profile to respond.") (Seun, 2026-10-22). Publication is only possible after the window ends; the staff response is shown
  beside the flag.
- Report details are encrypted (AES-256-GCM). Reporters follow their case with a case number and a key shown
  once; only the key's hash is stored.
- Known limit: under full anonymity the server cannot prove that the 3 green or 4 yellow reports come from
  different students. The per-semester token cap and moderator check for yellow are the safeguards.
