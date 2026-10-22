"use strict";

const byId = (id) => document.getElementById(id);
const checks = [...document.querySelectorAll('#review-checks input[type="checkbox"]')];
const announce = (message) => { byId("announcement").textContent = message; };

byId("load-sample").addEventListener("click", () => {
  byId("load-panel").hidden = true;
  byId("review-panel").hidden = false;
  byId("flight-count").textContent = "1";
  byId("step-load").className = "done";
  byId("step-review").className = "current";
  byId("check-times").focus({ preventScroll: true });
  announce("Fictional flight loaded. Review the three checks to apply the sample signature.");
});
checks.forEach((check) => check.addEventListener("change", () => {
  byId("sign-sample").disabled = !checks.every((item) => item.checked);
}));
byId("sign-sample").addEventListener("click", () => {
  if (!checks.every((item) => item.checked)) return;
  checks.forEach((check) => { check.disabled = true; });
  byId("flight-status").textContent = "Signed sample";
  byId("flight-status").classList.add("signed");
  byId("signature").textContent = "SAMPLE PILOT";
  byId("signature").classList.add("signed");
  byId("sign-sample").textContent = "Sample signature applied ✓";
  byId("sign-sample").disabled = true;
  byId("step-review").className = "done";
  byId("step-export").className = "current";
  byId("export-panel").hidden = false;
  byId("export-panel").querySelector("a").focus({ preventScroll: true });
  byId("export-panel").scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "nearest" });
  announce("Sample signed. Download the fictional PDF or Excel logbook.");
});
byId("reset").addEventListener("click", () => {
  byId("load-panel").hidden = false;
  byId("review-panel").hidden = true;
  byId("export-panel").hidden = true;
  byId("flight-count").textContent = "0";
  checks.forEach((check) => { check.checked = false; check.disabled = false; });
  byId("sign-sample").disabled = true;
  byId("sign-sample").textContent = "Apply sample signature ✓";
  byId("signature").textContent = "Sample signature appears here";
  byId("signature").classList.remove("signed");
  byId("flight-status").textContent = "Needs review";
  byId("flight-status").classList.remove("signed");
  byId("step-load").className = "current";
  byId("step-review").className = "";
  byId("step-export").className = "";
  byId("load-sample").focus({ preventScroll: true });
  announce("Demo reset. No data was stored.");
});
