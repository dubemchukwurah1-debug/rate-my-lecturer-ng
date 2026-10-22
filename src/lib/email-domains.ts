// Matches a student's email to an institution by its student email domains.
// Subdomains count: "cs.student.unilag.edu.ng" matches "student.unilag.edu.ng".

export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  return email.slice(at + 1).trim().toLowerCase() || null;
}

export function domainMatches(domain: string, schoolDomain: string): boolean {
  const d = domain.toLowerCase();
  const s = schoolDomain.toLowerCase();
  return d === s || d.endsWith(`.${s}`);
}

// Webmail is never accepted as proof of studentship.
const PERSONAL = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "ymail.com", "proton.me"];

export function isPersonalEmailDomain(domain: string): boolean {
  return PERSONAL.some((p) => domainMatches(domain, p));
}
