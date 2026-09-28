import { describe, expect, it } from "vitest";
import { sessionsFromConversation } from "../src/suites/locomo.js";

describe("sessionsFromConversation", () => {
  it("accepts img_url as a string array (locomo10.json shape)", () => {
    const sessions = sessionsFromConversation({
      speaker_a: "Caroline",
      speaker_b: "Melanie",
      session_1_date_time: "1:56 pm on 8 May, 2023",
      session_1: [
        {
          speaker: "Caroline",
          dia_id: "D1:5",
          text: "The transgender stories were so inspiring!",
          img_url: ["https://i.redd.it/l7hozpetnhlb1.jpg"],
          blip_caption: "a photo of a dog walking past a wall",
        },
        {
          speaker: "Melanie",
          dia_id: "D1:6",
          text: "Wow, love that painting!",
        },
      ],
    });

    expect(sessions).toHaveLength(1);
    expect(sessions[0].messages).toHaveLength(2);
    expect(sessions[0].messages[0].content).toContain("inspiring");
    expect(sessions[0].messages[0].content).toContain("[image:");
  });
});
