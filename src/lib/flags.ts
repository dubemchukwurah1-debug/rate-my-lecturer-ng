import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import type postgres from "postgres";
import { checkText, type CheckIssue } from "./content-checks";
import { decrypt, encrypt } from "./crypto-box";
import { spendToken } from "./tokens";

export const FLAG_CATEGORIES = {
  green: ["Goes beyond duty", "Fair and transparent grading", "Supportive and approachable", "Stands up for students"],
  yellow: [
    "Persistent absence or lateness",
    "Forced sale of handouts or textbooks",
    "Unfair or unexplained grading",
    "Demeaning remarks",
    "Lost or missing scripts",
    "Other unprofessional conduct",
  ],
  red: [
    "Sexual harassment",
    "Sex for grades",
    "Demanding money for marks",
    "Assault",
    "Threats or intimidation",
    "Discrimination",
  ],
} as const;

export type FlagColour = keyof typeof FLAG_CATEGORIES;

// Merit rules (see the plan, Layer 4).
export const GREEN_MIN_REPORTS = 3;
export const YELLOW_POINTS_PER_REPORT = 3;
export const YELLOW_THRESHOLD = 10;
export const RED_MIN_CREDIBLE = 2;
export const REPLY_DAYS = 7;
const WINDOW_YEARS = 2;

export const RED_PUBLIC_TEXT = "Multiple credible reports of serious misconduct are under review.";
export const RED_OUTCOME_TEXT = "Serious misconduct has been confirmed by an official outcome.";

export const reportSchema = z
  .object({
    staffId: z.guid(),
    colour: z.enum(["green", "yellow", "red"]),
    category: z.string(),
    details: z.string().trim().min(30).max(4000),
    occurredOn: z.string().trim().max(40).optional(),
    courseCode: z.string().trim().max(12).optional(),
    officialOutcomeUrl: z.url().optional(),
    referralConsent: z.boolean().default(false),
  })
  .refine((r) => (FLAG_CATEGORIES[r.colour] as readonly string[]).includes(r.category), {
    message: "Choose a category",
    path: ["category"],
  });

export type ReportInput = z.infer<typeof reportSchema>;

const hashKey = (k: string) => createHash("sha256").update(k).digest();

// Yellow points halve each year and expire after the window.
export function yellowPoints(reportDates: Date[], now = new Date()): number {
  const YEAR = 365.25 * 86_400_000;
  return reportDates
    .map((d) => (now.getTime() - d.getTime()) / YEAR)
    .filter((age) => age < WINDOW_YEARS)
    .reduce((sum, age) => sum + YELLOW_POINTS_PER_REPORT * 0.5 ** Math.max(0, age), 0);
}

export type FileResult =
  | { status: "filed"; caseNumber: string; caseKey: string }
  | { status: "rejected"; issues: CheckIssue[] };

export async function fileReport(sql: postgres.Sql, input: ReportInput, token: { msg: string; sig: string }): Promise<FileResult> {
  // Red reports may name people and places; they stay private, so only green and
  // yellow reports (which can become public summaries) are checked for personal data.
  if (input.colour !== "red") {
    const issues = checkText(input.details).issues.filter((i) => i !== "crime_allegation");
    if (issues.length) return { status: "rejected", issues };
  }
  const caseKey = randomBytes(9).toString("base64url");
  const details = JSON.stringify({ details: input.details, occurredOn: input.occurredOn, courseCode: input.courseCode });

  return sql.begin(async (tx) => {
    const [staff] = await tx`select id from staff where id = ${input.staffId} and status in ('approved', 'left')`;
    if (!staff) throw new Error("Unknown staff member");
    await spendToken(tx, token);
    const [row] = await tx`
      insert into flag_reports (staff_id, colour, category, details_encrypted, merit_points, case_key_hash,
                                official_outcome_url, referral_consent)
      values (${input.staffId}, ${input.colour}, ${input.category}, ${encrypt(details)},
              ${input.colour === "yellow" ? YELLOW_POINTS_PER_REPORT : 0}, ${hashKey(caseKey)},
              ${input.officialOutcomeUrl ?? null}, ${input.referralConsent})
      returning id, case_number`;

    if (input.colour === "red") {
      await tx`insert into moderation_queue (item_type, item_id, reason) values ('flag', ${row.id}, 'red_report')`;
    } else if (input.colour === "green") {
      await refreshGreen(tx, input.staffId);
    } else {
      await checkYellowThreshold(tx, input.staffId, row.id);
    }
    return { status: "filed" as const, caseNumber: row.case_number as string, caseKey };
  });
}

type Tx = postgres.TransactionSql | postgres.Sql;

async function refreshGreen(tx: Tx, staffId: string) {
  const [{ n }] = await tx`
    select count(*)::int as n from flag_reports
    where staff_id = ${staffId} and colour = 'green' and created_at > current_date - interval '2 years'`;
  if (n >= GREEN_MIN_REPORTS) {
    await tx`
      insert into published_flags (staff_id, colour, public_text, report_count, published_at)
      values (${staffId}, 'green', 'Commended by students', ${n}, now())
      on conflict (staff_id, colour) do update set report_count = excluded.report_count`;
  }
}

async function checkYellowThreshold(tx: Tx, staffId: string, reportId: string) {
  const rows = await tx`
    select created_at from flag_reports
    where staff_id = ${staffId} and colour = 'yellow' and status <> 'dismissed'`;
  const points = yellowPoints(rows.map((r) => new Date(r.created_at)));
  const [published] = await tx`select 1 from published_flags where staff_id = ${staffId} and colour = 'yellow'`;
  if (points >= YELLOW_THRESHOLD && !published) {
    await tx`insert into moderation_queue (item_type, item_id, reason) values ('flag', ${reportId}, 'yellow_threshold')`;
  }
}

// A moderator confirms that the yellow reports hold up before the flag goes public.
export async function publishYellow(tx: Tx, staffId: string) {
  const rows = await tx`
    select category, count(*)::int as n from flag_reports
    where staff_id = ${staffId} and colour = 'yellow' and status <> 'dismissed'
      and created_at > current_date - interval '2 years'
    group by category order by n desc`;
  const total = rows.reduce((s, r) => s + r.n, 0);
  const text = `Students report repeated unprofessional conduct: ${rows.slice(0, 3).map((r) => r.category.toLowerCase()).join(", ")}.`;
  await tx`
    insert into published_flags (staff_id, colour, public_text, report_count, published_at)
    values (${staffId}, 'yellow', ${text}, ${total}, now())
    on conflict (staff_id, colour) do update set public_text = excluded.public_text, report_count = excluded.report_count,
      published_at = coalesce(published_flags.published_at, now())`;
}

const STATUS_WORDS: Record<string, string> = {
  received: "Received. A moderator will look at it within 72 hours.",
  triage: "Being checked by a moderator.",
  panel_review: "With the review panel.",
  awaiting_reply: "The panel found it credible. The staff member has 7 days to respond before anything is published.",
  published: "Published as part of a pattern of credible reports.",
  kept_on_file: "Kept on file. It counts toward a pattern if others report the same person.",
  dismissed: "Closed. The panel could not take it further.",
};

export async function caseStatus(sql: postgres.Sql, caseNumber: string, caseKey: string): Promise<string | null> {
  const [row] = await sql`
    select status from flag_reports where case_number = ${caseNumber.trim().toUpperCase()} and case_key_hash = ${hashKey(caseKey.trim())}`;
  return row ? STATUS_WORDS[row.status] : null;
}

// ---- Review panel ---------------------------------------------------------

export interface RedCase {
  id: string;
  caseNumber: string;
  category: string;
  status: string;
  details: { details: string; occurredOn?: string; courseCode?: string };
  officialOutcomeUrl: string | null;
  referralConsent: boolean;
  createdAt: Date;
}

export interface StaffCases {
  staffId: string;
  staffName: string;
  institution: string;
  cases: RedCase[];
  flag: { replyDeadline: Date | null; publishedAt: Date | null; noticeSentAt: Date | null } | null;
  response: string | null;
}

export async function openRedCases(sql: postgres.Sql): Promise<StaffCases[]> {
  const rows = await sql`
    select r.id, r.case_number, r.category, r.status, r.details_encrypted, r.official_outcome_url,
           r.referral_consent, r.created_at, s.id as staff_id, s.full_name, i.name as institution
    from flag_reports r join staff s on s.id = r.staff_id join institutions i on i.id = s.institution_id
    where r.colour = 'red' and r.status not in ('dismissed', 'published')
    order by s.full_name, r.created_at`;
  const byStaff = new Map<string, StaffCases>();
  for (const r of rows) {
    let group = byStaff.get(r.staff_id);
    if (!group) {
      const [flag] = await sql`
        select reply_deadline, published_at, notice_sent_at from published_flags where staff_id = ${r.staff_id} and colour = 'red'`;
      const [resp] = await sql`select body from flag_responses where staff_id = ${r.staff_id}`;
      group = {
        staffId: r.staff_id,
        staffName: r.full_name,
        institution: r.institution,
        cases: [],
        flag: flag ? { replyDeadline: flag.reply_deadline, publishedAt: flag.published_at, noticeSentAt: flag.notice_sent_at } : null,
        response: resp?.body ?? null,
      };
      byStaff.set(r.staff_id, group);
    }
    group.cases.push({
      id: r.id,
      caseNumber: r.case_number,
      category: r.category,
      status: r.status,
      details: JSON.parse(decrypt(r.details_encrypted)),
      officialOutcomeUrl: r.official_outcome_url,
      referralConsent: r.referral_consent,
      createdAt: r.created_at,
    });
  }
  return [...byStaff.values()];
}

export class PanelError extends Error {}

const logDecision = (tx: Tx, reportId: string, by: string, decision: string, reasons: string) =>
  tx`insert into case_decisions (report_id, decided_by, decision, reasons) values (${reportId}, ${by}, ${decision}, ${reasons})`;

// Every panel step records who decided and why.
export async function decideCase(
  sql: postgres.Sql,
  reportId: string,
  moderatorId: string,
  decision: "panel_review" | "kept_on_file" | "dismissed",
  reasons: string,
) {
  if (reasons.trim().length < 10) throw new PanelError("Write down the reasons for this decision");
  await sql.begin(async (tx) => {
    const [r] = await tx`update flag_reports set status = ${decision} where id = ${reportId} and colour = 'red' returning id`;
    if (!r) throw new PanelError("Unknown case");
    await logDecision(tx, reportId, moderatorId, decision, reasons);
    await tx`update moderation_queue set resolved_at = now() where item_id = ${reportId} and resolved_at is null`;
  });
}

export const CASE_NOTICE_TEXT =
  "A case about this profile is open. If you are this staff member, claim the profile to respond.";

// Starts the right-of-reply window. Needs two credible reports, or one with an
// official outcome. A claimed profile is told through the staff portal; an
// unclaimed one shows CASE_NOTICE_TEXT on its page for the window (Seun, 2026-10-22).
export async function proposeRedFlag(sql: postgres.Sql, staffId: string, moderatorId: string, reasons: string, extraNotice = "") {
  if (reasons.trim().length < 10) throw new PanelError("Write down the reasons for this decision");
  await sql.begin(async (tx) => {
    const credible = await tx`
      select id, official_outcome_url from flag_reports
      where staff_id = ${staffId} and colour = 'red' and status = 'kept_on_file'`;
    const hasOutcome = credible.some((c) => c.official_outcome_url);
    if (credible.length < RED_MIN_CREDIBLE && !hasOutcome) {
      throw new PanelError(`Needs ${RED_MIN_CREDIBLE} independent credible reports, or an official outcome`);
    }
    const [staff] = await tx`select claimed_by from staff where id = ${staffId}`;
    const notice = [staff?.claimed_by ? "staff portal" : "profile page notice", extraNotice.trim()].filter(Boolean).join("; ");
    await tx`
      insert into published_flags (staff_id, colour, public_text, official_outcome_url, report_count, reply_deadline, notice_sent_at)
      values (${staffId}, 'red', ${hasOutcome ? RED_OUTCOME_TEXT : RED_PUBLIC_TEXT},
              ${credible.find((c) => c.official_outcome_url)?.official_outcome_url ?? null}, ${credible.length},
              current_date + ${REPLY_DAYS}::int, now())
      on conflict (staff_id, colour) do update set report_count = excluded.report_count,
        reply_deadline = coalesce(published_flags.reply_deadline, excluded.reply_deadline),
        notice_sent_at = coalesce(published_flags.notice_sent_at, excluded.notice_sent_at)`;
    for (const c of credible) {
      await tx`update flag_reports set status = 'awaiting_reply' where id = ${c.id}`;
      await logDecision(tx, c.id, moderatorId, "awaiting_reply", `${reasons} (notice: ${notice})`);
    }
  });
}

export async function publishRedFlag(sql: postgres.Sql, staffId: string, moderatorId: string, reasons: string, today = new Date()) {
  if (reasons.trim().length < 10) throw new PanelError("Write down the reasons for this decision");
  await sql.begin(async (tx) => {
    const [flag] = await tx`select reply_deadline, notice_sent_at from published_flags where staff_id = ${staffId} and colour = 'red'`;
    if (!flag?.notice_sent_at) throw new PanelError("Start the reply window first");
    if (new Date(flag.reply_deadline) > today) throw new PanelError("The 7-day reply window has not ended");
    await tx`update published_flags set published_at = now() where staff_id = ${staffId} and colour = 'red'`;
    const reports = await tx`
      update flag_reports set status = 'published' where staff_id = ${staffId} and colour = 'red' and status = 'awaiting_reply'
      returning id`;
    for (const r of reports) await logDecision(tx, r.id, moderatorId, "published", reasons);
  });
}

// The reply deadline while a red case is in its reply window, for the profile notice.
export async function openCaseDeadline(sql: postgres.Sql, staffId: string): Promise<Date | null> {
  const [row] = await sql`
    select reply_deadline from published_flags
    where staff_id = ${staffId} and colour = 'red' and published_at is null and reply_deadline is not null`;
  return row ? new Date(row.reply_deadline) : null;
}

export interface PublicFlag {
  colour: FlagColour;
  text: string;
  reportCount: number;
  officialOutcomeUrl: string | null;
  response: string | null;
}

export async function publicFlags(sql: postgres.Sql, staffId: string): Promise<PublicFlag[]> {
  return sql<PublicFlag[]>`
    select f.colour, f.public_text as text, f.report_count as "reportCount", f.official_outcome_url as "officialOutcomeUrl",
           case when f.colour = 'red' then r.body end as response
    from published_flags f left join flag_responses r on r.staff_id = f.staff_id
    where f.staff_id = ${staffId} and f.published_at is not null
    order by array_position(array['red', 'yellow', 'green'], f.colour::text)`;
}
