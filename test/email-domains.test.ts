import { describe, expect, it } from "vitest";
import { domainMatches, emailDomain, isPersonalEmailDomain } from "@/lib/email-domains";

describe("email domains", () => {
  it("extracts the domain", () => {
    expect(emailDomain("Ada.Obi@Student.UNILAG.edu.ng")).toBe("student.unilag.edu.ng");
    expect(emailDomain("not-an-email")).toBeNull();
  });

  it("matches subdomains but not lookalikes", () => {
    expect(domainMatches("cs.student.unilag.edu.ng", "student.unilag.edu.ng")).toBe(true);
    expect(domainMatches("student.unilag.edu.ng", "student.unilag.edu.ng")).toBe(true);
    expect(domainMatches("fakestudent.unilag.edu.ng", "student.unilag.edu.ng")).toBe(false);
  });

  it("recognises webmail", () => {
    expect(isPersonalEmailDomain("gmail.com")).toBe(true);
    expect(isPersonalEmailDomain("unn.edu.ng")).toBe(false);
  });
});
