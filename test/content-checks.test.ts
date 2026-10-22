import { describe, expect, it } from "vitest";
import { checkText } from "@/lib/content-checks";

describe("checkText", () => {
  it("passes an ordinary review", () => {
    expect(checkText("Explains recursion clearly and always comes to class on time. Tough but fair exams.")).toEqual({
      ok: true,
      issues: [],
      redirectToReport: false,
    });
  });

  it("blocks Nigerian phone numbers, with or without spacing", () => {
    expect(checkText("Call him on 0803 123 4567 if you need marks").issues).toContain("phone_number");
    expect(checkText("whatsapp +2348031234567").issues).toContain("phone_number");
  });

  it("blocks email addresses and insults", () => {
    expect(checkText("mail lecturer.name@unilag.edu.ng").issues).toContain("email_address");
    expect(checkText("He is a complete idiot in class").issues).toContain("abusive_language");
  });

  it("redirects crime allegations to the report flow", () => {
    for (const text of [
      "He demands money for marks from every student",
      "Known for sex for grades in 300 level",
      "She collected cash before releasing results",
      "He sexually harassed my classmate",
    ]) {
      const result = checkText(text);
      expect(result.redirectToReport, text).toBe(true);
      expect(result.ok).toBe(false);
    }
  });

  it("does not treat ordinary words as allegations", () => {
    expect(checkText("Asks for assignments every week and gives handouts for free").redirectToReport).toBe(false);
  });
});
