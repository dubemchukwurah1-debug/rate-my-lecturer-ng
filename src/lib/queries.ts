import "server-only";
import { db } from "./db";
import { aggregate, type Aggregate } from "./scoring";

export interface StaffSummary {
  id: string;
  fullName: string;
  title: string | null;
  role: "lecturer" | "administrative";
  department: string | null;
  status: "approved" | "left";
}

export async function staffForInstitution(slug: string): Promise<StaffSummary[]> {
  return db()<StaffSummary[]>`
    select s.id, s.full_name as "fullName", s.title, s.role, d.name as department, s.status
    from staff s
    join institutions i on i.id = s.institution_id
    left join departments d on d.id = s.department_id
    where i.slug = ${slug} and s.status in ('approved', 'left')
    order by s.full_name`;
}

export interface FacilityIssueRow {
  id: string;
  category: string;
  title: string;
  description: string;
  location: string | null;
  status: string;
  upvotes: number;
  createdAt: Date;
}

export async function facilityIssuesForInstitution(slug: string): Promise<FacilityIssueRow[]> {
  return db()<FacilityIssueRow[]>`
    select f.id, f.category, f.title, f.description, f.location, f.status, f.upvotes, f.created_at as "createdAt"
    from facility_issues f join institutions i on i.id = f.institution_id
    where i.slug = ${slug}
    order by f.status = 'fixed', f.upvotes desc, f.created_at desc
    limit 50`;
}

export interface ReviewRow {
  id: string;
  courseCode: string | null;
  semester: string;
  overall: number;
  clarity: number | null;
  fairness: number | null;
  availability: number | null;
  respect: number | null;
  wouldTakeAgain: boolean | null;
  tags: string[];
  body: string;
  isAlumni: boolean;
  createdAt: Date;
  reply: string | null;
}

export interface StaffProfile extends StaffSummary {
  institutionSlug: string;
  institutionName: string;
  reviews: ReviewRow[];
  score: Aggregate | null;
}

export async function staffProfile(id: string): Promise<StaffProfile | null> {
  const sql = db();
  const [staff] = await sql`
    select s.id, s.full_name as "fullName", s.title, s.role, d.name as department, s.status,
           i.slug as "institutionSlug", i.name as "institutionName"
    from staff s
    join institutions i on i.id = s.institution_id
    left join departments d on d.id = s.department_id
    where s.id = ${id} and s.status in ('approved', 'left')`;
  if (!staff) return null;
  // Reviews still in their 48-hour wait or held by moderation stay hidden.
  const reviews = await sql<ReviewRow[]>`
    select r.id, r.course_code as "courseCode", r.semester, r.overall, r.clarity, r.fairness, r.availability,
           r.respect, r.would_take_again as "wouldTakeAgain", r.tags, r.body, r.is_alumni as "isAlumni",
           r.created_at as "createdAt", rr.body as reply
    from reviews r left join review_replies rr on rr.review_id = r.id
    where r.staff_id = ${id} and r.hidden_reason is null and r.counts_from <= now()
    order by r.created_at desc`;
  return { ...(staff as StaffSummary & { institutionSlug: string; institutionName: string }), reviews, score: aggregate(reviews) };
}
