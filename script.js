(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const qs = new URLSearchParams(window.location.search);
  const repo = window.location.pathname.split("/").filter(Boolean)[0] || "";
  const fixedCondition = repo === "crowdcheck-s1-public-note" ? "public_note" : "control";
  const returnUrl = qs.get("returnUrl");
  const participantId = sanitizeId(qs.get("pid")) || createId("P");
  const sessionId = createId("S");
  const state = { participantId, sessionId, study: 1, condition: null, eligibleForRandomization: null, initialDisclosure: null, prompt: "", aiDraft: "", finalDraft: "", aiCalls: 0, startedAt: new Date().toISOString(), events: [] };
  const generatedText = "周末想放慢脚步，可以试试这条城市散步路线：从老街口出发，沿着河边步道慢慢走，途中在街角咖啡店休息，再到城市公园看日落。全程不赶时间，穿一双舒服的鞋就好。傍晚光线柔和，桥边和树影下都很适合拍照。#周末散步 #城市生活";
  const defaultPrompt = "写一段周末城市散步路线分享，语气自然，包含路线、休息点和一个拍照建议。";

  function sanitizeId(value) { return value ? value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) : ""; }
  function createId(prefix) { const b = new Uint32Array(2); crypto.getRandomValues(b); return `${prefix}-${Date.now().toString(36)}-${b[0].toString(36)}${b[1].toString(36)}`; }
  function logEvent(name, detail = {}) { state.events.push({ name, at: new Date().toISOString(), elapsedMs: Date.now() - new Date(state.startedAt).getTime(), ...detail }); }
  function showScreen(id) { document.querySelectorAll(".screen").forEach((screen) => screen.classList.toggle("active", screen.id === id)); window.scrollTo({ top: 0, behavior: "smooth" }); logEvent("screen_view", { screen: id }); }
  function updateCount(input, output, limit) { output.textContent = `${input.value.length} / ${limit}`; }

  function installDeclarationMenu() {
    const panel = document.querySelector("#publish-screen .panel");
    const composer = document.querySelector("#publish-screen .composer");
    const textarea = $("publish-text");
    panel.classList.add("publish-panel");
    composer.classList.add("publish-composer");
    const composeArea = document.createElement("div");
    composeArea.className = "publish-compose-area";
    textarea.parentNode.insertBefore(composeArea, textarea);
    composeArea.appendChild(textarea);
    document.querySelector(".ai-disclosure-option")?.remove();
    document.querySelector(".publish-settings")?.remove();
    composeArea.insertAdjacentHTML("beforeend", `<div class="declaration-select"><button id="declaration-toggle" class="declaration-toggle" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="declaration-menu"><span id="declaration-toggle-label">内容声明</span><span aria-hidden="true">⌄</span></button><div id="declaration-menu" class="declaration-menu" aria-label="内容声明选项" hidden><strong class="declaration-menu-title">选择内容声明</strong><label class="declaration-menu-option"><input id="content-declaration-none" type="radio" name="content-declaration" value="none" checked><span><strong>不添加声明</strong><small>按普通动态发布</small></span></label><label class="declaration-menu-option"><input id="initial-disclosure" type="radio" name="content-declaration" value="ai" autocomplete="off"><span><strong>内容使用AI生成</strong><small>发布后将在动态上显示相应声明</small></span></label></div></div>`);
    const toolbar = document.createElement("div");
    toolbar.className = "publish-toolbar";
    toolbar.innerHTML = `<div class="publish-tools" aria-hidden="true"><span>☺<small>表情</small></span><span>▧<small>图片</small></span><span>▣<small>视频</small></span><span>#<small>话题</small></span><span>•••<small>更多</small></span></div><div class="publish-actions"><span class="visibility-setting" aria-label="当前公开可见">◷ 公开⌄</span><button id="publish-btn" class="primary-btn" type="button">发布</button></div>`;
    document.querySelector(".publish-footer").replaceWith(toolbar);

    const style = document.createElement("style");
    style.textContent = `[hidden]{display:none!important}.publish-panel{overflow:visible}.publish-compose-area{position:relative;min-width:0;border:1px solid #e3e6eb;border-radius:12px;background:#f8f9fb}.publish-composer textarea{min-height:190px;border:0;border-radius:12px;background:transparent;padding:14px 14px 46px}.publish-composer textarea:focus{border:0;outline:2px solid rgba(255,122,26,.14)}.declaration-select{position:absolute;right:11px;bottom:9px;z-index:8}.declaration-toggle{display:inline-flex;align-items:center;gap:5px;border:0;border-radius:7px;padding:5px 7px;background:transparent;color:#747d89;font-size:13px}.declaration-toggle:hover,.declaration-toggle[aria-expanded=true]{background:#eef1f4;color:#48515e}.declaration-toggle.selected{color:#d85c00}.declaration-menu{position:absolute;right:0;bottom:calc(100% + 8px);width:260px;padding:10px;border:1px solid #dfe4ea;border-radius:11px;background:#fff;box-shadow:0 12px 34px rgba(29,39,53,.16)}.declaration-menu-title{display:block;padding:4px 7px 8px;color:#343b45;font-size:13px}.declaration-menu-option{display:grid;grid-template-columns:20px 1fr;gap:9px;align-items:start;padding:9px 7px;border-radius:8px;cursor:pointer}.declaration-menu-option:hover{background:#f5f7f9}.declaration-menu-option input{width:16px;height:16px;margin-top:3px;accent-color:var(--accent)}.declaration-menu-option span{display:grid;gap:1px}.declaration-menu-option strong{font-size:13px}.declaration-menu-option small{color:var(--muted);font-size:11px}.publish-toolbar{display:flex;justify-content:space-between;align-items:center;gap:18px;margin-top:12px;padding-top:12px;border-top:1px solid var(--line)}.publish-tools{display:flex;align-items:center;gap:20px;color:#737c88}.publish-tools span{display:grid;justify-items:center;gap:1px;min-width:28px;font-size:19px;line-height:1.1}.publish-tools small{font-size:10px;white-space:nowrap}.publish-actions{display:flex;align-items:center;gap:13px}.visibility-setting{color:#68717e;font-size:13px;white-space:nowrap}@media(max-width:760px){.publish-toolbar{align-items:stretch;flex-direction:column}.publish-actions{justify-content:flex-end}.publish-tools{justify-content:space-between;gap:6px}}`;
    document.head.appendChild(style);

    const closeMenu = () => { $("declaration-menu").hidden = true; $("declaration-toggle").setAttribute("aria-expanded", "false"); };
    const updateSummary = () => { const selected = $("initial-disclosure").checked; $("declaration-toggle-label").textContent = selected ? "已添加声明" : "内容声明"; $("declaration-toggle").classList.toggle("selected", selected); };
    const resetSelection = () => { $("content-declaration-none").checked = true; $("initial-disclosure").checked = false; updateSummary(); closeMenu(); };
    $("declaration-toggle").addEventListener("click", (event) => { event.stopPropagation(); const open = $("declaration-menu").hidden; $("declaration-menu").hidden = !open; $("declaration-toggle").setAttribute("aria-expanded", String(open)); });
    $("declaration-menu").addEventListener("click", (event) => event.stopPropagation());
    document.querySelectorAll('input[name="content-declaration"]').forEach((input) => input.addEventListener("change", () => { updateSummary(); closeMenu(); }));
    document.addEventListener("click", closeMenu);
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeMenu(); });
    window.addEventListener("pageshow", () => { if ($("publish-screen").classList.contains("active")) resetSelection(); });
    resetSelection();
  }

  function generateDraft() {
    const prompt = $("prompt-input").value.trim();
    if (prompt.length < 5) { $("prompt-input").setCustomValidity("请先输入至少5个字的提示词。"); $("prompt-input").reportValidity(); return; }
    $("prompt-input").setCustomValidity(""); state.prompt = prompt; state.aiCalls += 1; logEvent("ai_generation_requested", { call: state.aiCalls, promptLength: prompt.length }); $("generate-btn").disabled = true; $("ai-working").hidden = false;
    window.setTimeout(() => { state.aiDraft = generatedText; $("draft-input").value = state.aiDraft; $("draft-panel").hidden = false; $("ai-working").hidden = true; $("generate-btn").disabled = false; updateCount($("draft-input"), $("draft-count"), 1500); logEvent("ai_generation_completed", { outputLength: state.aiDraft.length }); $("draft-panel").scrollIntoView({ behavior: "smooth", block: "start" }); }, 700);
  }

  function displayPublishedPost() {
    $("published-content").textContent = state.finalDraft;
    $("ai-label").hidden = !state.initialDisclosure;
    const hasNote = state.eligibleForRandomization && state.condition === "public_note";
    $("community-note").hidden = !hasNote; $("note-metadata").hidden = true;
    $("initial-discloser-exit").hidden = !state.initialDisclosure; $("continue-panel").hidden = Boolean(state.initialDisclosure);
    showScreen("post-screen"); logEvent("post_rendered", { initialDisclosure: state.initialDisclosure, condition: state.condition, noteVisible: hasNote });
  }

  function finishExperiment(path) {
    state.completedAt = new Date().toISOString(); state.completionPath = path; state.completionCode = `WG-1-${sessionId.slice(-8).toUpperCase()}`; logEvent("experiment_complete", { path });
    try { localStorage.setItem(`crowdchecking-${sessionId}`, JSON.stringify(state)); } catch (_) { state.storageWarning = true; }
    window.parent?.postMessage({ type: "crowdchecking-experiment-complete", payload: state }, "*"); $("completion-code").textContent = `完成码：${state.completionCode}`; if (returnUrl) $("return-btn").hidden = false; showScreen("complete-screen");
  }

  const hiddenGuard = document.createElement("style"); hiddenGuard.textContent = "[hidden]{display:none!important}"; document.head.appendChild(hiddenGuard);
  document.body.dataset.version = "2026-07-29-declaration-menu";
  ["survey-screen", "checks-screen"].forEach((id) => $(id)?.remove());
  const continuePanel = $("continue-panel"); continuePanel.querySelector("p").textContent = "请确认页面中的动态及相关信息。后续问题将在见数平台中呈现。";
  const finishButton = $("to-survey-btn"); finishButton.id = "finish-experiment-btn"; finishButton.textContent = "完成体验并返回";
  $("complete-title").textContent = "本阶段体验已完成"; $("complete-title").nextElementSibling.textContent = "网站内不再呈现问卷题项，请返回见数平台继续完成后续测量。";
  document.querySelectorAll(".step-kicker").forEach((item) => item.textContent = item.textContent.replace("/ 4", "/ 2"));
  installDeclarationMenu();
  $("topic-instruction").textContent = "本次主题：城市散步路线。请让AI助手创作一段“周末城市散步路线”分享，内容应轻松、具体，适合发布在社交媒体。";
  $("prompt-input").value = defaultPrompt; updateCount($("prompt-input"), $("prompt-count"), 500);

  $("consent").addEventListener("change", (event) => $("start-btn").disabled = !event.target.checked);
  $("start-btn").addEventListener("click", () => { logEvent("consent_confirmed"); showScreen("create-screen"); });
  $("prompt-input").addEventListener("input", () => updateCount($("prompt-input"), $("prompt-count"), 500));
  $("draft-input").addEventListener("input", () => updateCount($("draft-input"), $("draft-count"), 1500));
  $("generate-btn").addEventListener("click", generateDraft);
  $("to-publish-btn").addEventListener("click", () => { const finalDraft = $("draft-input").value.trim(); if (finalDraft.length < 20) { $("draft-input").setCustomValidity("最终文案请至少保留20个字。"); $("draft-input").reportValidity(); return; } $("draft-input").setCustomValidity(""); state.finalDraft = finalDraft; state.editDistanceApprox = Math.abs(state.aiDraft.length - finalDraft.length); $("publish-text").value = finalDraft; logEvent("draft_confirmed", { finalLength: finalDraft.length }); showScreen("publish-screen"); });
  $("publish-text").addEventListener("input", (event) => state.finalDraft = event.target.value);
  $("publish-btn").addEventListener("click", () => { const finalDraft = $("publish-text").value.trim(); if (finalDraft.length < 20) { $("publish-text").setCustomValidity("发布文案请至少保留20个字。"); $("publish-text").reportValidity(); return; } state.finalDraft = finalDraft; state.initialDisclosure = $("initial-disclosure").checked; state.eligibleForRandomization = !state.initialDisclosure; state.condition = state.eligibleForRandomization ? fixedCondition : "initial_discloser"; logEvent("initial_publish_submitted", { initialDisclosure: state.initialDisclosure, assignedCondition: state.condition }); displayPublishedPost(); });
  $("initial-finish-btn").addEventListener("click", () => finishExperiment("initial_discloser"));
  $("finish-experiment-btn").addEventListener("click", () => finishExperiment("randomized_experiment"));
  $("return-btn").addEventListener("click", () => { const target = new URL(returnUrl); target.searchParams.set("completionCode", state.completionCode); target.searchParams.set("pid", participantId); window.location.href = target.toString(); });
  logEvent("experiment_loaded", { study: 1, participantId, fixedCondition });
})();
