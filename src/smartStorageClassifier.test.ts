import { describe, expect, test } from "vitest";
import { predictSmartStorageEntries } from "./smartStorageClassifier";

describe("Smart Storage classifier", () => {
  test("classifies lesson-plan shaped sources as Lesson entries", () => {
    const prediction = predictSmartStorageEntries({
      sourceKind: "pastedText",
      text: [
        "Lesson: Courage in Joshua 1:6-9",
        "Objective: Students will distinguish courage from presumption.",
        "Materials: Bibles, board notes, discussion questions.",
        "Activity: Compare Joshua 1:6-9 with classroom examples.",
      ].join("\n"),
    });

    expect(prediction.primaryEntry?.knowledgeType).toBe("lesson");
    expect(prediction.detectedContextTags.map((tag) => tag.label)).toContain(
      "Joshua 1:6-9",
    );
  });

  test("classifies direct prayer language as a Prayer Request", () => {
    const prediction = predictSmartStorageEntries({
      sourceKind: "pastedText",
      text: "Please pray for Anna's surgery on Friday morning and for peace for her family.",
    });

    expect(prediction.primaryEntry?.knowledgeType).toBe("prayerRequest");
    expect(prediction.primaryEntry?.title).toContain("Prayer Request");
  });

  test("surfaces quote candidates from quoted text", () => {
    const prediction = predictSmartStorageEntries({
      sourceKind: "uploadedFile",
      fileName: "augustine-excerpt.txt",
      text: '"You have made us for yourself, O Lord, and our heart is restless until it rests in you." - Augustine',
    });

    expect(prediction.entries.map((entry) => entry.knowledgeType)).toContain(
      "quote",
    );
  });
});
