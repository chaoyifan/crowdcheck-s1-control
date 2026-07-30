(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const qs = new URLSearchParams(window.location.search);
  const repo = window.location.pathname.split("/").filter(Boolean)[0] || "";
  const condition = repo === "crowdcheck-s1-public-note" ? "public_note" : "control";
  const participantId = (qs.get("pid") || "anonymous").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "anonymous";
  const returnUrl = qs.get("returnUrl");
  const startedAt = Date.now();
  const declarationLabels = { none: "内容声明", original: "自主创作", repost: "内容转载", ai: "内容由AI生成", fictional: "虚构演绎" };
  const postLabelTexts = { original: "内容为自主创作", repost: "内容为转载", ai: "内容使用AI生成", fictional: "内容为虚构演绎" };
  const outcome = { version: "2026-07-30-post-publication-editing", participantId, condition, initialDeclaration: null, eligibleForRandomization: null, postEditOpened: false, postEditOpenCount: 0, postEditSaved: false, postEditSaveCount: 0, postPublicationAiDeclarationEver: false, correctiveDisclosure: false, correctiveDisclosureLatencyMs: null, finalDeclaration: null, finalTextLength: null, events: [] };
  let currentDeclaration = "none";
  let postRenderedAt = null;

  function logEvent(name, detail = {}) { outcome.events.push({ name, at: new Date().toISOString(), elapsedMs: Date.now() - startedAt, ...detail }); }
  function persist(reason) {
    outcome.correctiveDisclosure = Boolean(outcome.eligibleForRandomization && currentDeclaration === "ai");
    outcome.finalDeclaration = currentDeclaration;
    outcome.finalTextLength = $("published-content")?.textContent?.length || 0;
    outcome.lastPersistReason = reason;
    try { localStorage.setItem(`crowdchecking-post-edit-${participantId}`, JSON.stringify(outcome)); } catch (_) {}
    window.parent?.postMessage({ type: "crowdchecking-post-edit-outcome", payload: outcome }, "*");
  }

  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `[hidden]{display:none!important}.post-menu-wrap{position:relative;justify-self:end}.post-action-menu{position:absolute;top:calc(100% + 4px);right:8px;z-index:35;width:150px;padding:6px;border:1px solid #e3e6ea;border-radius:8px;background:#fff;box-shadow:0 10px 28px rgba(25,35,48,.16)}.post-action-menu button{width:100%;display:flex;align-items:center;gap:10px;padding:10px 12px;border:0;border-radius:6px;background:transparent;color:#343b45;text-align:left}.post-action-menu button:hover{background:#f5f6f7}body.post-edit-modal-open{overflow:hidden}.post-edit-backdrop{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:20px;background:rgba(20,25,32,.42)}.post-edit-dialog{width:min(620px,100%);max-height:calc(100vh - 40px);overflow:visible;border-radius:12px;background:#fff;box-shadow:0 24px 60px rgba(16,23,32,.24)}.post-edit-header{display:grid;grid-template-columns:72px 1fr 72px;align-items:center;min-height:58px;padding:0 18px;border-bottom:1px solid #eef0f2}.post-edit-header h2{margin:0;font-size:18px;text-align:center}.post-edit-text-button{border:0;background:transparent;color:#646c77;padding:8px 0;text-align:left}.post-edit-body{padding:22px 24px 12px}.post-edit-author{display:flex;align-items:center;gap:12px;margin-bottom:14px}.post-edit-compose{position:relative;border-radius:8px;background:#f2f3f5}.post-edit-compose textarea{width:100%;min-height:180px;padding:14px 16px 48px;border:0;border-radius:8px;background:transparent;resize:vertical}.post-edit-compose textarea:focus{border:0;outline:2px solid rgba(255,130,0,.18)}.post-edit-declaration{position:absolute;right:10px;bottom:8px;z-index:3}.post-edit-declaration .declaration-menu{right:0;bottom:calc(100% + 8px)}.post-edit-meta{display:flex;justify-content:space-between;margin-top:7px;color:#9299a3;font-size:12px}.post-edit-footer{display:flex;justify-content:flex-end;gap:12px;padding:14px 24px 20px}.post-edit-secondary{min-height:42px;padding:8px 22px;border:1px solid #dfe3e8;border-radius:22px;background:#fff;color:#4d5560;font-weight:700}.post-edit-footer .primary-btn{min-height:42px;padding:8px 27px;border-radius:22px;box-shadow:none}.community-note.post-note-resolved{border-color:#cfe7d5;background:#f3fbf5;color:#355c40}.community-note.post-note-resolved .note-heading{color:#2d6d40}.community-note.post-note-resolved .note-icon{background:#3b8b53}@media(max-width:620px){.post-edit-backdrop{padding:0;align-items:end}.post-edit-dialog{max-height:92vh;border-radius:14px 14px 0 0}.post-edit-body{padding:18px 16px 10px}.post-edit-footer{padding:12px 16px 18px}.post-edit-declaration .declaration-menu{width:min(330px,calc(100vw - 44px))}}`;
    document.head.appendChild(style);
  }

  function buildEditor() {
    const moreButton = document.querySelector("#post-screen .post-author .icon-btn");
    if (!moreButton) return false;
    const wrap = document.createElement("div"); wrap.className = "post-menu-wrap";
    moreButton.parentNode.insertBefore(wrap, moreButton); wrap.appendChild(moreButton);
    moreButton.id = "post-more-button"; moreButton.setAttribute("aria-haspopup", "true"); moreButton.setAttribute("aria-expanded", "false"); moreButton.setAttribute("aria-controls", "post-action-menu");
    wrap.insertAdjacentHTML("beforeend", `<div id="post-action-menu" class="post-action-menu" role="menu" hidden><button id="edit-post-button" type="button" role="menuitem"><span aria-hidden="true">✎</span>编辑动态</button></div>`);
    document.body.insertAdjacentHTML("beforeend", `<div id="post-edit-modal" class="post-edit-backdrop" hidden><section class="post-edit-dialog" role="dialog" aria-modal="true" aria-labelledby="post-edit-title"><header class="post-edit-header"><button id="post-edit-cancel-top" class="post-edit-text-button" type="button">取消</button><h2 id="post-edit-title">编辑动态</h2><span aria-hidden="true"></span></header><div class="post-edit-body"><div class="post-edit-author"><div class="avatar" aria-hidden="true">创</div><strong>社区创作者</strong></div><div class="post-edit-compose"><textarea id="post-edit-text" rows="8" maxlength="1500" aria-label="编辑帖子正文"></textarea><div class="post-edit-declaration"><button id="post-edit-declaration-toggle" class="declaration-toggle" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="post-edit-declaration-menu"><span id="post-edit-declaration-label">内容声明</span><span aria-hidden="true">⌄</span></button><div id="post-edit-declaration-menu" class="declaration-menu" aria-label="编辑内容声明选项" hidden><div class="declaration-menu-heading"><strong>内容声明</strong><span aria-hidden="true">?</span></div><div class="declaration-options-grid"><label class="declaration-menu-option"><input type="radio" name="post-edit-declaration" value="none"><span>无</span></label><label class="declaration-menu-option"><input type="radio" name="post-edit-declaration" value="original"><span>内容为自主创作</span></label><label class="declaration-menu-option"><input type="radio" name="post-edit-declaration" value="repost"><span>内容为转载</span></label><label class="declaration-menu-option"><input type="radio" name="post-edit-declaration" value="ai"><span>内容由AI生成</span></label><label class="declaration-menu-option"><input type="radio" name="post-edit-declaration" value="fictional"><span>内容为虚构演绎</span></label></div></div></div></div><div class="post-edit-meta"><span>可修改正文及内容声明</span><span id="post-edit-count">0 / 1500</span></div></div><footer class="post-edit-footer"><button id="post-edit-cancel" class="post-edit-secondary" type="button">取消</button><button id="post-edit-save" class="primary-btn" type="button">保存</button></footer></section></div>`);
    return true;
  }

  function closePostMenu() { $("post-action-menu").hidden = true; $("post-more-button").setAttribute("aria-expanded", "false"); }
  function closeDeclarationMenu() { $("post-edit-declaration-menu").hidden = true; $("post-edit-declaration-toggle").setAttribute("aria-expanded", "false"); }
  function updateDeclarationSummary() { const value = document.querySelector('input[name="post-edit-declaration"]:checked')?.value || "none"; $("post-edit-declaration-label").textContent = declarationLabels[value]; $("post-edit-declaration-toggle").classList.toggle("selected", value !== "none"); }

  function renderPostState() {
    const label = $("ai-label"); label.hidden = currentDeclaration === "none"; if (!label.hidden) label.textContent = postLabelTexts[currentDeclaration] || "内容声明已更新";
    const note = $("community-note"); if (!note || note.hidden) return;
    const resolved = currentDeclaration === "ai"; note.classList.toggle("post-note-resolved", resolved);
    const heading = note.querySelector(".note-heading strong"); const paragraphs = Array.from(note.children).filter((node) => node.tagName === "P");
    let repaired = $("note-repaired"); if (!repaired) { repaired = document.createElement("div"); repaired.id = "note-repaired"; repaired.className = "note-repaired"; repaired.textContent = "作者已补充AI内容声明。"; note.appendChild(repaired); }
    if (heading) heading.textContent = resolved ? "社区附注 · 已处理" : "社区附注 · 公开";
    paragraphs.forEach((p) => { p.hidden = resolved; }); repaired.hidden = !resolved;
  }

  function openEditor() {
    closePostMenu(); outcome.postEditOpened = true; outcome.postEditOpenCount += 1;
    $("post-edit-text").value = $("published-content").textContent; $("post-edit-count").textContent = `${$("post-edit-text").value.length} / 1500`;
    const radio = document.querySelector(`input[name="post-edit-declaration"][value="${currentDeclaration}"]`) || document.querySelector('input[name="post-edit-declaration"][value="none"]');
    radio.checked = true; updateDeclarationSummary(); closeDeclarationMenu(); $("post-edit-modal").hidden = false; document.body.classList.add("post-edit-modal-open");
    logEvent("post_edit_opened", { currentDeclaration }); persist("edit_opened"); setTimeout(() => $("post-edit-text").focus(), 0);
  }
  function closeEditor(reason) { if ($("post-edit-modal").hidden) return; $("post-edit-modal").hidden = true; document.body.classList.remove("post-edit-modal-open"); closeDeclarationMenu(); if (reason !== "saved") logEvent("post_edit_closed", { reason }); }
  function saveEditor() {
    const text = $("post-edit-text").value.trim(); if (text.length < 20) { $("post-edit-text").setCustomValidity("帖子正文请至少保留20个字。"); $("post-edit-text").reportValidity(); return; }
    $("post-edit-text").setCustomValidity(""); const previousDeclaration = currentDeclaration; const nextDeclaration = document.querySelector('input[name="post-edit-declaration"]:checked')?.value || "none";
    currentDeclaration = nextDeclaration; $("published-content").textContent = text; outcome.postEditSaved = true; outcome.postEditSaveCount += 1;
    if (outcome.eligibleForRandomization && previousDeclaration !== "ai" && nextDeclaration === "ai") { outcome.postPublicationAiDeclarationEver = true; if (outcome.correctiveDisclosureLatencyMs === null && postRenderedAt) outcome.correctiveDisclosureLatencyMs = Date.now() - postRenderedAt; }
    renderPostState(); logEvent("post_edit_saved", { previousDeclaration, nextDeclaration, aiDeclarationAdded: previousDeclaration !== "ai" && nextDeclaration === "ai", finalLength: text.length }); closeEditor("saved"); persist("edit_saved");
  }
  function captureInitialPublication() {
    const value = document.querySelector('input[name="content-declaration"]:checked')?.value || "none"; currentDeclaration = value; outcome.initialDeclaration = value; outcome.eligibleForRandomization = value !== "ai"; postRenderedAt = Date.now(); renderPostState(); logEvent("post_rendered", { initialDeclaration: value, eligibleForRandomization: outcome.eligibleForRandomization }); persist("post_rendered");
  }

  function bindEvents() {
    $("post-more-button").addEventListener("click", (event) => { event.stopPropagation(); const open = $("post-action-menu").hidden; $("post-action-menu").hidden = !open; $("post-more-button").setAttribute("aria-expanded", String(open)); });
    $("post-action-menu").addEventListener("click", (event) => event.stopPropagation()); $("edit-post-button").addEventListener("click", openEditor);
    $("post-edit-declaration-toggle").addEventListener("click", (event) => { event.stopPropagation(); const open = $("post-edit-declaration-menu").hidden; $("post-edit-declaration-menu").hidden = !open; $("post-edit-declaration-toggle").setAttribute("aria-expanded", String(open)); });
    $("post-edit-declaration-menu").addEventListener("click", (event) => event.stopPropagation()); document.querySelectorAll('input[name="post-edit-declaration"]').forEach((input) => input.addEventListener("change", () => { updateDeclarationSummary(); closeDeclarationMenu(); }));
    $("post-edit-text").addEventListener("input", () => { $("post-edit-count").textContent = `${$("post-edit-text").value.length} / 1500`; }); $("post-edit-save").addEventListener("click", saveEditor); $("post-edit-cancel").addEventListener("click", () => closeEditor("cancel_button")); $("post-edit-cancel-top").addEventListener("click", () => closeEditor("cancel_top")); $("post-edit-modal").addEventListener("click", (event) => { if (event.target === $("post-edit-modal")) closeEditor("backdrop"); });
    document.addEventListener("click", closePostMenu); document.addEventListener("keydown", (event) => { if (event.key === "Escape") { closePostMenu(); closeEditor("escape"); } });
    $("publish-btn").addEventListener("click", () => setTimeout(() => { if ($("post-screen").classList.contains("active")) captureInitialPublication(); }, 0));
    [$("initial-finish-btn"), $("finish-experiment-btn")].filter(Boolean).forEach((button) => button.addEventListener("click", () => persist("experiment_finished"), true));
    const returnButton = $("return-btn"); if (returnButton && returnUrl) { returnButton.onclick = () => { persist("return_to_questionnaire"); const target = new URL(returnUrl); const completionCode = ($("completion-code")?.textContent || "").replace(/^完成码：/, ""); if (completionCode) target.searchParams.set("completionCode", completionCode); target.searchParams.set("pid", participantId); target.searchParams.set("postEditOpened", outcome.postEditOpened ? "1" : "0"); target.searchParams.set("postPublicationAiDeclaration", outcome.correctiveDisclosure ? "1" : "0"); window.location.href = target.toString(); }; }
  }

  injectStyles();
  if (buildEditor()) { bindEvents(); logEvent("post_edit_feature_loaded", { condition }); persist("feature_loaded"); }
})();
