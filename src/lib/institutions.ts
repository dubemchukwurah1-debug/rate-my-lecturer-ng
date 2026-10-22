import data from "@/data/institutions.json";

export type InstitutionType = "university" | "polytechnic" | "college_of_education";
export type Ownership = "federal" | "state" | "private";

export interface Institution {
  slug: string;
  name: string;
  type: InstitutionType;
  ownership: Ownership;
  state: string;
  source: string;
}

export const institutions = data as Institution[];

export const TYPE_LABELS: Record<InstitutionType, string> = {
  university: "University",
  polytechnic: "Polytechnic",
  college_of_education: "College of education",
};

export function getInstitution(slug: string): Institution | undefined {
  return institutions.find((i) => i.slug === slug);
}
