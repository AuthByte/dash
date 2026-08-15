import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  avatarCandidates,
  deskInitials,
  localAvatarUrl,
  unavatarUrl,
} from "./avatar";

describe("avatar helpers", () => {
  it("builds unavatar and local paths", () => {
    assert.equal(unavatarUrl("@firstadopter"), "https://unavatar.io/x/firstadopter?fallback=false");
    assert.equal(localAvatarUrl("mr-derivatives"), "/avatars/mr-derivatives.jpg");
  });

  it("prefers explicit avatar_url then local then unavatar", () => {
    assert.deepEqual(
      avatarCandidates({
        slug: "serenity",
        handle: "aleabitoreddit",
        avatar_url: "/avatars/serenity.jpg",
      }),
      [
        "/avatars/serenity.jpg",
        "https://unavatar.io/x/aleabitoreddit?fallback=false",
      ],
    );
  });

  it("uses meaningful initials instead of The/Mr", () => {
    assert.equal(deskInitials("The Prof Investor"), "PI");
    assert.equal(deskInitials("Mr Derivatives"), "DE");
    assert.equal(deskInitials("First Adopter"), "FA");
    assert.equal(deskInitials("Serenity"), "SE");
  });
});
