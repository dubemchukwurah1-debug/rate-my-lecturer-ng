# Product decisions

Decided by Seun on 2026-10-22. The full plan, risk register and roadmap live in the
[layered plan](https://claude.ai/artifact/UkpaS3i2jDnBRg2BGz1eWq).

| Topic | Decision |
| --- | --- |
| Red flags before review | Never public. Reports go to a private review queue. |
| Reviewer anonymity | Fully unlinkable. Accounts prove eligibility; reviews carry no account reference. |
| Review panel | In-house moderators until the platform scales. |
| Verification | School email where available, ID card + selfie fallback (deleted within 7 days), phone OTP for all. |
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

Known trade-off: with unlinkable tokens the server cannot enforce "one review per
student per lecturer". The per-semester token cap, the 48-hour delay and burst
detection limit the damage instead.
