import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  isSiteNavItemActive,
  ROCKET_BETA_PATH,
} from "./site-navigation";

const navLinksSource = readFileSync(
  new URL("../components/NavLinks.tsx", import.meta.url),
  "utf8",
);
const mobileMenuSource = readFileSync(
  new URL("../components/MobileMenu.tsx", import.meta.url),
  "utf8",
);
const notificationBellSource = readFileSync(
  new URL("../app/NotificationBell.tsx", import.meta.url),
  "utf8",
);

test("Rocket has one active top-level navigation item", () => {
  assert.equal(
    isSiteNavItemActive(ROCKET_BETA_PATH, ROCKET_BETA_PATH),
    true,
  );
  assert.equal(
    isSiteNavItemActive(ROCKET_BETA_PATH, "/tournaments"),
    false,
  );
  assert.equal(
    isSiteNavItemActive(`${ROCKET_BETA_PATH}/enter`, ROCKET_BETA_PATH),
    true,
  );
  assert.equal(
    isSiteNavItemActive(`${ROCKET_BETA_PATH}/enter`, "/tournaments"),
    false,
  );
});

test("other tournament routes keep Tournaments active", () => {
  assert.equal(isSiteNavItemActive("/tournaments", "/tournaments"), true);
  assert.equal(
    isSiteNavItemActive("/tournaments/other-event", "/tournaments"),
    true,
  );
  assert.equal(
    isSiteNavItemActive("/players/123", "/players"),
    true,
  );
});

test("the full desktop menu waits for a wide layout", () => {
  assert.match(navLinksSource, /xl:flex/);
  assert.doesNotMatch(navLinksSource, /sm:flex/);
  assert.match(mobileMenuSource, /xl:hidden/);
  assert.match(navLinksSource, /aria-current=\{active \? "page"/);
  assert.match(mobileMenuSource, /aria-current=\{active \? "page"/);
});

test("the phone notification panel stays inside the viewport", () => {
  assert.match(
    notificationBellSource,
    /fixed left-4 right-4 top-\[calc\(3\.25rem\+env\(safe-area-inset-top\)\)\]/,
  );
  assert.match(
    notificationBellSource,
    /sm:absolute sm:left-auto sm:right-0/,
  );
});
