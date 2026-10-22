/* Figure 5: animated distribution of 112 countries, 1960 to 2019.
   Rendered inline (no iframe) and redrawn from the container's real width. */
(function () {
  const root = document.getElementById("explorer");
  if (!root) return;
  const BLUE = "#6c85b9", CORAL = "#5f9daf", DOT = "#8e98a4", INK = "#121212", FOCUS = "#26262c";
  const f0 = (v) => String(Math.round(v));
  const f1 = (v) => (Math.round(v * 10 + 1e-9) / 10).toFixed(1);
  const YEARS = d3.range(1960, 2020);

  root.innerHTML = `
    <div class="gfx-tools ex-top">
      <span class="toggle ex-range" role="group" aria-label="Countries compared">
        <button type="button" data-range="80" aria-pressed="true">Middle 80%</button>
        <button type="button" data-range="50" aria-pressed="false">Middle 50%</button>
        <button type="button" data-range="100" aria-pressed="false">Full range</button>
      </span>
      <span class="ex-right">
        <button type="button" class="ex-resume" hidden>&#9654; Resume</button>
        <span class="ex-seg toggle" role="group" aria-label="Scale">
          <button type="button" data-mode="linear" aria-pressed="true">Linear</button>
          <button type="button" data-mode="log" aria-pressed="false">Log</button>
        </span>
      </span>
    </div>
    <div class="frame ex-stage">
      <div class="ex-head">
      <div class="ex-head-text">
        <p class="ex-title">Child mortality in 112 countries, year by year</p>
        <p class="ex-dek">Each dot is a country. Shading marks the selected comparison.</p>
      </div>
      <div class="ex-find">
        <div class="ex-combo">
          <svg class="ex-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
          <input type="text" role="combobox" aria-expanded="false" aria-controls="ex-list" aria-autocomplete="list"
                 placeholder="Find a country" aria-label="Find a country" autocomplete="off" spellcheck="false" />
          <ul class="ex-list" id="ex-list" role="listbox" hidden></ul>
        </div>
      </div>
      </div>
      <div class="ex-chart"><svg></svg></div>
      <input class="ex-slider" type="range" min="1960" max="2019" step="1" value="1960" aria-label="Year" />
      <p class="ex-src">Source: World Bank Human Development Indicators. The 112 countries with data in both 1960 and 2019.</p>
    </div>
    <div class="frame ex-measures">
      <section class="ex-measure ex-measure-country" data-metric="country">
        <h4 class="ex-c-name">United States</h4>
        <p class="ex-readout"><span class="ex-measure-value"></span><span class="ex-verdict"></span></p>
        <svg role="img" aria-label="The selected country's under-five mortality over time, against the middle 80% of countries"></svg>
      </section>
      <section class="ex-measure" data-metric="gap">
        <h4>Difference in rates</h4>
        <p class="ex-readout"><span class="ex-measure-value"></span><span class="ex-verdict"></span></p>
        <svg role="img" aria-label="Difference in mortality rates over time"></svg>
      </section>
      <section class="ex-measure" data-metric="ratio">
        <h4>Ratio of rates</h4>
        <p class="ex-readout"><span class="ex-measure-value"></span><span class="ex-verdict"></span></p>
        <svg role="img" aria-label="Ratio of mortality rates over time"></svg>
      </section>
    </div>`;

  const $ = (s) => root.querySelector(s);
  const resume = $(".ex-resume"), slider = $(".ex-slider"), chart = $(".ex-chart"), tip = { hidden: true };
  const svg = d3.select($(".ex-chart svg"));
  const state = { year: 1960, mode: "linear", playing: false, timer: null, width: 0, range: "80", focus: "United States" };
  let D, S, countries, draw, styleDots, refocus, comparisons, measurePlots = [];

  d3.json("charts/data.json").then((data) => {
    D = data;
    S = Object.fromEntries(D.stats.map((s) => [s.y, s]));
    countries = D.cohort.map((c) => ({ name: c.name, v: Object.fromEntries(c.v) }));
    comparisons = Object.fromEntries(["80", "50", "100"].map(range => [range, YEARS.map(y => {
      const s = S[y], vals = countries.map(c => c.v[y]).filter(v => v != null).sort(d3.ascending);
      const lo = range === "80" ? s.p10 : range === "50" ? s.p25 : vals[0];
      const hi = range === "80" ? s.p90 : range === "50" ? s.p75 : vals[vals.length - 1];
      return { y, lo, hi, gap: hi - lo, ratio: hi / lo };
    })]));
    build();
    start();
    new ResizeObserver(() => {
      const w = Math.floor(chart.clientWidth);
      if (Math.abs(w - state.width) > 8) build();
    }).observe(chart);
  });

  function build() {
    const W = Math.floor(chart.clientWidth), narrow = W < 480;
    state.width = W;
    const R = narrow ? 2.9 : 4.2, H = narrow ? 210 : 250, MID = narrow ? 100 : 118, HB = narrow ? 62 : 74;
    const pad = 10;
    svg.attr("width", W).attr("height", H).attr("viewBox", `0 0 ${W} ${H}`).selectAll("*").remove();
    const lin = d3.scaleLinear().domain([0, 400]).range([pad, W - pad]);
    const log = d3.scaleLog().domain([1.5, 450]).range([pad, W - pad]);
    const cache = { linear: {}, log: {} };
    const layout = (m, yr) => {
      if (cache[m][yr]) return cache[m][yr];
      const sc = m === "log" ? log : lin, prev = cache[m][yr - 1];
      const nodes = countries.filter((c) => c.v[yr] != null).map((c) => {
        const p = prev && prev.get(c.name);
        return { name: c.name, val: c.v[yr], x: sc(c.v[yr]), y: p ? p.y : MID };
      });
      d3.forceSimulation(nodes).force("x", d3.forceX((d) => sc(d.val)).strength(1)).force("y", d3.forceY(MID).strength(0.08))
        .force("c", d3.forceCollide(R + 0.5)).stop().tick(prev ? 40 : 120);
      nodes.forEach((n) => (n.y = Math.max(MID - HB + R, Math.min(MID + HB - R, n.y))));
      return (cache[m][yr] = new Map(nodes.map((n) => [n.name, n])));
    };

    const yearMark = svg.append("text").attr("class", "ex-yearmark").attr("text-anchor", "end")
      .attr("x", W - pad).attr("y", MID - HB + (narrow ? 30 : 42)).text(state.year);
    const axisG = svg.append("g"), band = svg.append("rect").attr("y", MID - HB).attr("height", 2 * HB).attr("rx", 4).attr("fill", INK).attr("opacity", 0.045);
    const l10 = svg.append("line"), l90 = svg.append("line");
    [l10, l90].forEach((l) => l.attr("y1", MID - HB).attr("y2", MID + HB).attr("stroke", INK).attr("stroke-width", 1.1).attr("stroke-dasharray", "3 3"));
    const t10 = svg.append("text").attr("class", "ex-pct").attr("y", MID - HB - 6).attr("text-anchor", "middle").text("10th");
    const t90 = svg.append("text").attr("class", "ex-pct").attr("y", MID - HB - 6).attr("text-anchor", "middle").text(narrow ? "90th" : "90th percentile");
    const dotsG = svg.append("g");
    const focusLab = svg.append("text").attr("class", "ex-focus-lab").attr("text-anchor", "middle").attr("opacity", 0);
    const RF = R + 1;

    let axisMode;
    function axis(dur) {
      if (axisMode === state.mode) return;
      axisMode = state.mode;
      const sc = state.mode === "log" ? log : lin;
      const ticks = state.mode === "log" ? (narrow ? [2, 10, 50, 200] : [2, 5, 10, 20, 50, 100, 200, 400]) : (narrow ? [0, 100, 200, 300, 400] : [0, 50, 100, 150, 200, 250, 300, 350, 400]);
      axisG.selectAll("line").data(ticks, d => d).join(
        enter => enter.append("line").attr("x1", sc).attr("x2", sc).attr("y1", MID - HB - 18).attr("y2", MID + HB + 4).attr("stroke", "#ececec").attr("opacity", 0),
        update => update,
        exit => exit.transition("motion").duration(dur).attr("opacity", 0).remove()
      ).transition("motion").duration(dur).ease(d3.easeCubicInOut).attr("x1", sc).attr("x2", sc).attr("opacity", 1);
      axisG.selectAll("text.ex-axis-number").data(ticks, d => d).join(
        enter => enter.append("text").attr("class", "ex-tick ex-axis-number").attr("x", sc).attr("y", MID + HB + 20).attr("opacity", 0),
        update => update,
        exit => exit.transition("motion").duration(dur).attr("opacity", 0).remove()
      ).text(d => d).attr("text-anchor", d => d === ticks[0] ? "start" : d === ticks[ticks.length - 1] ? "end" : "middle")
        .transition("motion").duration(dur).ease(d3.easeCubicInOut).attr("x", sc).attr("opacity", 1);
      axisG.selectAll("text.ex-axis-title").data([state.mode]).join("text").attr("class", "ex-tick ex-axis-title")
        .attr("x", W / 2).attr("y", MID + HB + 38).attr("text-anchor", "middle")
        .text(`Deaths per 1,000 births${state.mode === "log" ? ", log scale" : ""}`);
    }


    styleDots = () => {
      dotsG.selectAll("circle").attr("r", R).attr("fill", DOT).attr("fill-opacity", 0.8)
        .attr("stroke", (d) => (d.name === state.focus ? INK : "#fff")).attr("stroke-width", (d) => (d.name === state.focus ? 1.6 : 0.8))
        .filter((d) => d.name === state.focus).raise();
    };
    refocus = () => { styleDots(); drawFocus(0); countryPanel(); };

    function drawFocus(dur, easing) {
      const fd = state.focus && layout(state.mode, state.year).get(state.focus);
      if (!fd) { focusLab.attr("opacity", 0).attr("data-name", null); return; }
      const anchor = fd.x > W - 60 ? "end" : fd.x < 60 ? "start" : "middle";
      const fresh = focusLab.attr("data-name") !== state.focus;
      focusLab.text(state.focus).attr("data-name", state.focus).attr("opacity", 1).attr("text-anchor", anchor).raise();
      const t = dur && !fresh ? focusLab.transition("motion").duration(dur).ease(easing) : focusLab.interrupt("motion");
      t.attr("x", anchor === "end" ? fd.x + RF : anchor === "start" ? fd.x - RF : fd.x).attr("y", Math.max(11, fd.y - RF - 6));
    }

    draw = (dur, easing = d3.easeCubicInOut) => {
      const sc = state.mode === "log" ? log : lin, s = comparisons[state.range][state.year - 1960];
      yearMark.text(state.year);
      slider.value = state.year;
      axis(dur);
      dotsG.selectAll("circle").data([...layout(state.mode, state.year).values()], (d) => d.name)
        .join((enter) => enter.append("circle").attr("r", R).attr("cx", (d) => d.x).attr("cy", (d) => d.y)
          .attr("fill", DOT).attr("fill-opacity", 0.8).attr("stroke", "#fff").attr("stroke-width", 0.8)
          .on("pointerenter", (e, d) => { if (e.pointerType === "mouse") setFocus(d.name); })
          .on("click", (e, d) => setFocus(d.name)))
        .transition("motion").duration(dur).ease(easing).attr("cx", (d) => d.x).attr("cy", (d) => d.y);
      const on = (d) => d.name === state.focus;
      styleDots();
      drawFocus(dur, easing);
      countryPanel();
      const x10 = sc(s.lo), x90 = sc(s.hi);
      t10.text(state.range === "100" ? "Lowest" : state.range === "50" ? "25th" : "10th");
      t90.text(state.range === "100" ? "Highest" : state.range === "50" ? (narrow ? "75th" : "75th percentile") : narrow ? "90th" : "90th percentile");
      band.transition("motion").duration(dur).ease(easing).attr("x", x10).attr("width", x90 - x10);
      l10.transition("motion").duration(dur).ease(easing).attr("x1", x10).attr("x2", x10);
      l90.transition("motion").duration(dur).ease(easing).attr("x1", x90).attr("x2", x90);
      const spacing = narrow ? 48 : 80;
      let label10 = Math.max(14, x10), label90 = Math.min(W - 24, x90);
      if (label90 - label10 < spacing) {
        label10 = Math.max(14, Math.min((label10 + label90 - spacing) / 2, W - 24 - spacing));
        label90 = label10 + spacing;
      }
      t10.transition("motion").duration(dur).ease(easing).attr("x", label10);
      t90.transition("motion").duration(dur).ease(easing).attr("x", label90);
      updateMeasures(dur, easing);
    };
    buildMeasures();
    draw(0);
  }

  // Keep the chart elements in place as the selected comparison changes.
  function buildMeasures() {
    measurePlots = ["gap", "ratio"].map(key => {
      const el = root.querySelector(`[data-metric="${key}"]`), node = el.querySelector("svg");
      const W = Math.floor(el.clientWidth), H = 210, m = { l: 48, r: 12, t: 12, b: 46 };
      const g = d3.select(node).attr("width", W).attr("height", H).attr("viewBox", `0 0 ${W} ${H}`);
      g.selectAll("*").remove();
      const x = d3.scaleLinear().domain([1960, 2019]).range([m.l, W - m.r]);
      const y = d3.scaleLinear().range([H - m.b, m.t]);
      const color = key === "gap" ? BLUE : CORAL;
      const yAxis = g.append("g").attr("class", "ex-mini-axis").attr("transform", `translate(${m.l},0)`);
      g.append("g").attr("class", "ex-mini-axis ex-mini-x").attr("transform", `translate(0,${H - m.b})`)
        .call(d3.axisBottom(x).tickValues(W < 300 ? [1960, 1990, 2019] : [1960, 1980, 2000, 2019]).tickFormat(d3.format("d")).tickSize(4));
      g.append("text").attr("class", "ex-tick").attr("text-anchor", "middle").attr("x", (m.l + W - m.r) / 2).attr("y", H - 6).text("Year");
      g.append("text").attr("class", "ex-tick").attr("text-anchor", "middle")
        .attr("transform", `translate(12,${(m.t + H - m.b) / 2}) rotate(-90)`)
        .text(key === "gap" ? "Deaths per 1,000 births" : "Mortality rate ratio");
      const baselineLine = g.append("line").attr("x1", m.l).attr("x2", W - m.r)
        .attr("stroke", "#b1b8be").attr("stroke-dasharray", "3 3");
      const line = d3.line().x(d => x(d.y)).y(d => y(d[key])).curve(d3.curveMonotoneX);
      const future = g.append("path").attr("fill", "none").attr("stroke", "#dce1e6").attr("stroke-width", 2);
      const clipId = `ex-history-${key}`;
      const historyClip = g.append("defs").append("clipPath").attr("id", clipId).append("rect")
        .attr("x", m.l - 2).attr("y", 0).attr("width", 0).attr("height", H);
      const past = g.append("path").attr("clip-path", `url(#${clipId})`).attr("fill", "none").attr("stroke", color).attr("stroke-width", 2.4);
      const cursor = g.append("line").attr("y1", m.t).attr("y2", H - m.b).attr("stroke", "#a8b1b8").attr("stroke-width", 1);
      const point = g.append("circle").attr("r", 3.8).attr("fill", color).attr("stroke", "#fff").attr("stroke-width", 1.5);
      return { key, el, x, y, line, future, past, cursor, point, baselineLine, historyClip, yAxis, range: null, plotWidth: W - m.l - m.r };
    });
  }

  function updateMeasures(dur, easing) {
    const series = comparisons[state.range], s = series[state.year - 1960], baseline = series[0];
    measurePlots.forEach(plot => {
      const { key, el, x, y, line, future, past, cursor, point, baselineLine, historyClip, yAxis, plotWidth } = plot;
      const move = selection => dur ? selection.transition("motion").duration(dur).ease(easing) : selection;
      if (plot.range !== state.range) {
        y.domain([0, d3.max(series, d => d[key]) * 1.08]).nice(4);
        move(yAxis).call(d3.axisLeft(y).ticks(4).tickSize(-plotWidth).tickFormat(v => key === "ratio" ? `${v}×` : v));
        yAxis.select(".domain").remove();
        move(future).attr("d", line(series));
        move(past).attr("d", line(series));
        move(baselineLine).attr("y1", y(baseline[key])).attr("y2", y(baseline[key]));
        plot.range = state.range;
      }
      move(historyClip).attr("width", x(state.year) - x(1960) + 2);
      move(cursor).attr("x1", x(state.year)).attr("x2", x(state.year));
      move(point).attr("cx", x(state.year)).attr("cy", y(s[key]));
      el.querySelector(".ex-measure-value").textContent = `${f1(s[key])}${key === "ratio" ? "×" : " per 1,000"}`;
      const change = (s[key] / baseline[key] - 1) * 100;
      el.querySelector(".ex-verdict").textContent = state.year === 1960 ? "1960 value" : `${Math.abs(change) < 0.5 ? "<1" : Math.round(Math.abs(change))}% ${change < 0 ? "lower" : "higher"} since 1960`;
    });
  }

  // Follow one country: highlighted dot, plus a panel with its own line against the middle 80%
  const input = $(".ex-combo input"), list = $(".ex-list");
  const panel = $('[data-metric="country"]'), pName = $(".ex-c-name"), pSvg = d3.select(panel.querySelector("svg"));
  let panelKey = null, pc = null;

  function rankOf(name, yr) {
    const v = countries.find((c) => c.name === name).v[yr];
    if (v == null) return { v: null };
    const vals = countries.map((o) => o.v[yr]).filter((x) => x != null).sort(d3.ascending);
    return { v, rank: vals.findIndex((x) => x >= v) + 1, n: vals.length };
  }

  function countryPanel() {
    const c = countries && countries.find((o) => o.name === state.focus);
    if (!c) return;
    const el = panel, node = pSvg.node();
    const W = Math.floor(el.clientWidth) || 300, H = 210, m = { l: 48, r: 12, t: 12, b: 46 };
    const key = [state.focus, state.mode, W].join("|");
    if (key !== panelKey) {
      panelKey = key;
      const g = pSvg.attr("width", W).attr("height", H).attr("viewBox", `0 0 ${W} ${H}`);
      g.selectAll("*").remove();
      const x = d3.scaleLinear().domain([1960, 2019]).range([m.l, W - m.r]);
      const hi = d3.max(YEARS, (t) => Math.max(S[t].p90, c.v[t] || 0));
      const y = state.mode === "log" ? d3.scaleLog().domain([1.5, 450]).range([H - m.b, m.t])
                                     : d3.scaleLinear().domain([0, hi * 1.05]).nice(4).range([H - m.b, m.t]);
      g.append("g").attr("class", "ex-mini-axis").attr("transform", `translate(${m.l},0)`)
        .call(state.mode === "log" ? d3.axisLeft(y).tickValues([2, 10, 50, 200]).tickFormat(d3.format("d")).tickSize(-(W - m.l - m.r))
                                   : d3.axisLeft(y).ticks(4).tickSize(-(W - m.l - m.r)))
        .select(".domain").remove();
      g.append("g").attr("class", "ex-mini-axis ex-mini-x").attr("transform", `translate(0,${H - m.b})`)
        .call(d3.axisBottom(x).tickValues(W < 300 ? [1960, 1990, 2019] : [1960, 1980, 2000, 2019]).tickFormat(d3.format("d")).tickSize(4));
      g.append("text").attr("class", "ex-tick").attr("text-anchor", "middle").attr("x", (m.l + W - m.r) / 2).attr("y", H - 6).text("Year");
      g.append("text").attr("class", "ex-tick").attr("text-anchor", "middle")
        .attr("transform", `translate(12,${(m.t + H - m.b) / 2}) rotate(-90)`).text("Deaths per 1,000 births");
      g.append("path").datum(YEARS).attr("fill", "#eceef2")
        .attr("d", d3.area().x((t) => x(t)).y0((t) => y(S[t].p10)).y1((t) => y(S[t].p90)).curve(d3.curveMonotoneX));
      const ys = YEARS.filter((t) => c.v[t] != null);
      const line = d3.line().x((t) => x(t)).y((t) => y(c.v[t])).curve(d3.curveMonotoneX);
      g.append("path").datum(ys).attr("fill", "none").attr("stroke", "#dce1e6").attr("stroke-width", 2).attr("d", line);
      const clip = g.append("defs").append("clipPath").attr("id", "ex-history-country").append("rect")
        .attr("x", m.l - 2).attr("y", 0).attr("height", H).attr("width", 0);
      g.append("path").datum(ys).attr("clip-path", "url(#ex-history-country)").attr("fill", "none").attr("stroke", FOCUS).attr("stroke-width", 2.4).attr("d", line);
      const cursor = g.append("line").attr("y1", m.t).attr("y2", H - m.b).attr("stroke", "#a8b1b8").attr("stroke-width", 1);
      const dot = g.append("circle").attr("r", 3.8).attr("fill", FOCUS).attr("stroke", "#fff").attr("stroke-width", 1.5);
      pc = { x, y, cursor, dot, clip };
    }
    const r = rankOf(state.focus, state.year);
    pName.textContent = state.focus;
    el.querySelector(".ex-measure-value").textContent = r.v == null ? "No data" : `${f1(r.v)} per 1,000`;
    el.querySelector(".ex-verdict").textContent = r.v == null ? "" : `rank ${r.rank} of ${r.n}, lowest first`;
    pc.clip.attr("width", pc.x(state.year) - pc.x(1960) + 2);
    pc.cursor.attr("x1", pc.x(state.year)).attr("x2", pc.x(state.year));
    if (r.v != null) pc.dot.attr("opacity", 1).attr("cx", pc.x(state.year)).attr("cy", pc.y(r.v)); else pc.dot.attr("opacity", 0);
  }

  function setFocus(name) {
    const hit = name && countries && countries.find((c) => c.name.toLowerCase() === String(name).trim().toLowerCase());
    if (!hit || hit.name === state.focus) { closeList(); return; }
    state.focus = hit.name;
    input.value = "";
    closeList();
    if (refocus) refocus();
  }

  // custom combobox
  let matches = [], active = -1;
  const esc = (t) => t.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  function openList() {
    if (!countries) return;
    const q = input.value.trim().toLowerCase();
    const names = countries.map((c) => c.name).sort();
    matches = q
      ? names.filter((n) => n.toLowerCase().startsWith(q)).concat(names.filter((n) => !n.toLowerCase().startsWith(q) && n.toLowerCase().includes(q)))
      : names;
    active = matches.length ? 0 : -1;
    list.innerHTML = matches.length
      ? matches.map((n, i) => {
          const at = q ? n.toLowerCase().indexOf(q) : -1;
          const label = at < 0 ? esc(n) : esc(n.slice(0, at)) + "<mark>" + esc(n.slice(at, at + q.length)) + "</mark>" + esc(n.slice(at + q.length));
          const v = countries.find((c) => c.name === n).v[state.year];
          return `<li role="option" data-name="${esc(n)}"${i === active ? ' aria-selected="true"' : ""}><span>${label}</span><span class="ex-li-v">${v != null ? f1(v) : ""}</span></li>`;
        }).join("")
      : `<li class="ex-none">No country matches “${esc(input.value.trim())}”</li>`;
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }
  function closeList() { list.hidden = true; input.setAttribute("aria-expanded", "false"); }
  function setActive(i) {
    if (!matches.length) return;
    active = (i + matches.length) % matches.length;
    list.querySelectorAll("li").forEach((li, k) => li.toggleAttribute("aria-selected", k === active));
    const li = list.children[active];
    if (li) li.scrollIntoView({ block: "nearest" });
  }
  input.addEventListener("focus", openList);
  input.addEventListener("input", openList);
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); list.hidden ? openList() : setActive(active + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(active - 1); }
    else if (e.key === "Enter") { e.preventDefault(); if (matches[active]) { setFocus(matches[active]); input.blur(); } }
    else if (e.key === "Escape") { closeList(); input.blur(); }
  });
  list.addEventListener("mousedown", (e) => e.preventDefault());
  list.addEventListener("click", (e) => { const li = e.target.closest("li[data-name]"); if (li) { setFocus(li.dataset.name); input.blur(); } });
  input.addEventListener("blur", () => { closeList(); input.value = ""; });

  function setSelection(mode, range) {
    state.mode = mode;
    state.range = range;
    root.querySelectorAll(".ex-seg button").forEach(b => b.setAttribute("aria-pressed", b.dataset.mode === mode));
    root.querySelectorAll(".ex-range button").forEach(b => b.setAttribute("aria-pressed", b.dataset.range === range));
  }

  // Complete both scales for one comparison before moving to the next.
  function playbackFrame(year, mode, range) {
    if (year < 2019) return { year: year + 1, mode, range };
    if (mode === "linear") return { year: 1960, mode: "log", range };
    const ranges = ["80", "50", "100"];
    return { year: 1960, mode: "linear", range: ranges[(ranges.indexOf(range) + 1) % ranges.length] };
  }

  function stop() {
    state.playing = false;
    clearTimeout(state.timer);
    resume.hidden = false;
  }

  function start() {
    if (!draw || state.playing) return;
    tip.hidden = true;
    state.playing = true;
    resume.hidden = true;
    setSelection(state.mode, state.range);
    draw(200);
    const advance = () => {
      if (!state.playing) return;
      const reset = state.year === 2019;
      const next = playbackFrame(state.year, state.mode, state.range);
      state.year = next.year;
      setSelection(next.mode, next.range);
      const duration = reset ? 650 : 200;
      draw(duration, reset ? d3.easeCubicInOut : d3.easeLinear);
      state.timer = setTimeout(advance, reset ? 750 : state.year === 2019 ? 450 : duration);
    };
    state.timer = setTimeout(advance, 200);
  }

  resume.addEventListener("click", start);
  slider.addEventListener("input", () => {
    if (!draw) return;
    state.year = +slider.value; tip.hidden = true; draw(150);
  });
  root.querySelectorAll(".ex-range button").forEach(b => b.addEventListener("click", () => {
    if (!draw) return;
    stop(); tip.hidden = true; setSelection(state.mode, b.dataset.range); draw(300);
  }));
  root.querySelectorAll(".ex-seg button").forEach(b => b.addEventListener("click", () => {
    if (!draw) return;
    stop(); tip.hidden = true; setSelection(b.dataset.mode, state.range); draw(700);
  }));
})();
