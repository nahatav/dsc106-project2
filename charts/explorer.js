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
    <div class="ex-top">
      <div class="ex-playback">
        <span class="ex-year">1960</span>
        <button type="button" class="ex-resume resource-btn" hidden>Resume</button>
      </div>
      <span class="toggle ex-range" role="group" aria-label="Countries compared">
        <button type="button" data-range="80" aria-pressed="true">Middle 80%</button>
        <button type="button" data-range="50" aria-pressed="false">Middle 50%</button>
        <button type="button" data-range="100" aria-pressed="false">Full range</button>
      </span>
      <span class="ex-seg toggle" role="group" aria-label="Scale">
        <button type="button" data-mode="linear" aria-pressed="true">Linear</button>
        <button type="button" data-mode="log" aria-pressed="false">Log</button>
      </span>
    </div>
    <div class="frame ex-stage">
      <p class="ex-title">Under-five mortality in 112 countries</p>
      <div class="ex-find">
        <span class="ex-find-box">
          <input type="search" list="ex-countries" placeholder="Find a country" aria-label="Find a country" autocomplete="off" />
          <button type="button" class="ex-clear" aria-label="Clear country" hidden>&times;</button>
        </span>
        <span class="ex-picks">Try <button type="button">India</button><button type="button">Sierra Leone</button><button type="button">Sweden</button></span>
        <datalist id="ex-countries"></datalist>
      </div>
      <p class="ex-focus" aria-live="polite"></p>
      <div class="ex-chart"><svg></svg><div class="ex-tip" hidden></div></div>
      <input class="ex-slider" type="range" min="1960" max="2019" step="1" value="1960" aria-label="Year" />
    </div>
    <div class="frame ex-measures">
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
  const resume = $(".ex-resume"), yearEl = $(".ex-year"), slider = $(".ex-slider"), chart = $(".ex-chart"), tip = $(".ex-tip");
  const svg = d3.select($(".ex-chart svg"));
  const state = { year: 1960, mode: "linear", playing: false, timer: null, width: 0, range: "80", focus: null };
  let D, S, countries, draw, comparisons, measurePlots = [];

  d3.json("charts/data.json").then((data) => {
    D = data;
    S = Object.fromEntries(D.stats.map((s) => [s.y, s]));
    countries = D.cohort.map((c) => ({ name: c.name, v: Object.fromEntries(c.v) }));
    $("#ex-countries").innerHTML = countries.map(c => c.name).sort().map(n => `<option value="${n}">`).join("");
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

    const axisG = svg.append("g"), band = svg.append("rect").attr("y", MID - HB).attr("height", 2 * HB).attr("rx", 4).attr("fill", INK).attr("opacity", 0.045);
    const l10 = svg.append("line"), l90 = svg.append("line");
    [l10, l90].forEach((l) => l.attr("y1", MID - HB).attr("y2", MID + HB).attr("stroke", INK).attr("stroke-width", 1.1).attr("stroke-dasharray", "3 3"));
    const t10 = svg.append("text").attr("class", "ex-pct").attr("y", MID - HB - 6).attr("text-anchor", "middle").text("10th");
    const t90 = svg.append("text").attr("class", "ex-pct").attr("y", MID - HB - 6).attr("text-anchor", "middle").text(narrow ? "90th" : "90th percentile");
    const dotsG = svg.append("g");
    // followed country: trail of past years, then its dot and label on top of everything
    const trailG = svg.append("g").attr("class", "ex-trail").style("pointer-events", "none");
    const focusDot = svg.append("circle").attr("fill", FOCUS).attr("stroke", "#fff").attr("stroke-width", 2).attr("opacity", 0).style("pointer-events", "none");
    const focusLab = svg.append("text").attr("class", "ex-focus-lab").attr("text-anchor", "middle").attr("opacity", 0);
    const RF = R * 1.9;

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

    function showTip(d, el) {
      const v = countries.find((c) => c.name === d.name).v[state.year];
      tip.innerHTML = `<b>${d.name}</b>${state.year}: ${f1(v)} per 1,000`;
      tip.hidden = false;
      const x = Math.min(W - tip.offsetWidth, Math.max(0, d.x - tip.offsetWidth / 2));
      tip.style.left = x + "px"; tip.style.top = Math.max(0, d.y - 52) + "px";
      dotsG.selectAll("circle").attr("stroke", "#fff").attr("stroke-width", 0.8);
      d3.select(el).attr("stroke", INK).attr("stroke-width", 1.6).raise();
    }
    svg.on("click", (e) => { if (e.target.tagName !== "circle") { tip.hidden = true; dotsG.selectAll("circle").attr("stroke", "#fff").attr("stroke-width", 0.8); } });

    // The trail runs along the centre line: one segment per year from 1960 to the selected year,
    // darkening toward the present, with hollow markers at each decade.
    function drawTrail(sc, dur, easing) {
      const c = state.focus && countries.find((o) => o.name === state.focus);
      const yrs = c ? YEARS.filter((y) => y <= state.year && c.v[y] != null) : [];
      const move = (sel) => (dur ? sel.transition("motion").duration(dur).ease(easing) : sel);
      const segs = yrs.slice(1).map((y, i) => ({ y, a: c.v[yrs[i]], b: c.v[y], t: (i + 1) / Math.max(1, yrs.length - 1) }));
      move(trailG.selectAll("line").data(segs, (d) => d.y).join((e) => e.append("line").attr("x1", (d) => sc(d.a)).attr("x2", (d) => sc(d.a)))
        .attr("y1", MID).attr("y2", MID).attr("stroke", FOCUS).attr("stroke-width", 3).attr("stroke-linecap", "round")
        .attr("stroke-opacity", (d) => 0.12 + 0.6 * d.t)).attr("x1", (d) => sc(d.a)).attr("x2", (d) => sc(d.b));
      const decades = yrs.filter((y) => y % 10 === 0 && y !== state.year);
      move(trailG.selectAll("circle").data(decades, (d) => d).join((e) => e.append("circle").attr("cx", (d) => sc(c.v[d])))
        .attr("cy", MID).attr("r", R + 1).attr("fill", "#fff").attr("stroke", FOCUS).attr("stroke-width", 1.5)
        .attr("stroke-opacity", (d) => 0.35 + 0.5 * ((d - 1960) / 59))).attr("cx", (d) => sc(c.v[d]));
      let last = -Infinity;
      const labelled = decades.filter((d) => { const x = sc(c.v[d]); if (Math.abs(x - last) < (narrow ? 30 : 34)) return false; last = x; return true; });
      move(trailG.selectAll("text").data(labelled, (d) => d).join((e) => e.append("text").attr("x", (d) => sc(c.v[d])))
        .attr("class", "ex-trail-year").attr("y", MID + RF + 13).attr("text-anchor", "middle").text((d) => (narrow ? "’" + String(d).slice(2) : d)))
        .attr("x", (d) => sc(c.v[d]));
      if (!c || c.v[state.year] == null) { focusDot.attr("opacity", 0); focusLab.attr("opacity", 0); return; }
      const x = sc(c.v[state.year]);
      const vals = countries.map((o) => o.v[state.year]).filter((v) => v != null).sort(d3.ascending);
      const rank = vals.findIndex((v) => v >= c.v[state.year]) + 1;
      focusDot.attr("r", RF).attr("opacity", 1).attr("cy", MID);
      move(focusDot).attr("cx", x);
      const anchor = x > W - 70 ? "end" : x < 70 ? "start" : "middle";
      focusLab.text(`${state.focus} · ${rank} of ${vals.length}`).attr("opacity", 1).attr("y", MID - RF - 8).attr("text-anchor", anchor);
      move(focusLab).attr("x", anchor === "end" ? x + RF : anchor === "start" ? x - RF : x);
    }

    draw = (dur, easing = d3.easeCubicInOut) => {
      const sc = state.mode === "log" ? log : lin, s = comparisons[state.range][state.year - 1960];
      yearEl.textContent = state.year;
      slider.value = state.year;
      axis(dur);
      dotsG.selectAll("circle").data([...layout(state.mode, state.year).values()], (d) => d.name)
        .join((enter) => enter.append("circle").attr("r", R).attr("cx", (d) => d.x).attr("cy", (d) => d.y)
          .attr("fill", DOT).attr("fill-opacity", 0.8).attr("stroke", "#fff").attr("stroke-width", 0.8)
          .on("pointerenter", function (e, d) { if (e.pointerType === "mouse") showTip(d, this); })
          .on("pointerleave", (e) => { if (e.pointerType === "mouse") tip.hidden = true; })
          .on("click", function (e, d) { e.stopPropagation(); tip.hidden = true; setFocus(d.name); }))
        .transition("motion").duration(dur).ease(easing).attr("cx", (d) => d.x).attr("cy", (d) => d.y);
      const on = (d) => d.name === state.focus;
      dotsG.selectAll("circle").attr("r", R).attr("fill", DOT)
        .attr("fill-opacity", (d) => (on(d) ? 0 : state.focus ? 0.35 : 0.8)).attr("stroke-opacity", (d) => (on(d) ? 0 : 1));
      drawTrail(sc, dur, easing);
      focusText();
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

  // Follow one country through the animation
  const input = $(".ex-find input"), clear = $(".ex-clear"), focusEl = $(".ex-focus");
  function focusText() {
    if (!state.focus) { focusEl.textContent = "Search for a country, or tap a dot, to follow it through every year."; focusEl.classList.remove("on"); return; }
    const c = countries.find(c => c.name === state.focus), v = c.v[state.year];
    const vals = countries.map(o => o.v[state.year]).filter(x => x != null).sort(d3.ascending);
    const rank = vals.findIndex(x => x >= v) + 1, ch = (v / c.v[1960] - 1) * 100;
    focusEl.innerHTML = `<b>${state.focus}</b> ${state.year}: <b>${f1(v)}</b> deaths per 1,000 births · ` +
      `ranked ${rank} of ${vals.length} (1 = lowest)` + (state.year === 1960 ? "" : ` · ${Math.round(Math.abs(ch))}% ${ch < 0 ? "lower" : "higher"} than in 1960`);
    focusEl.classList.add("on");
  }
  function setFocus(name) {
    const hit = name && countries.find(c => c.name.toLowerCase() === name.trim().toLowerCase());
    state.focus = hit ? hit.name : null;
    input.value = state.focus || "";
    clear.hidden = !state.focus;
    if (draw) draw(250);
  }
  input.addEventListener("input", () => { const hit = countries.find(c => c.name.toLowerCase() === input.value.trim().toLowerCase()); if (hit) setFocus(hit.name); });
  input.addEventListener("change", () => setFocus(input.value));
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { const q = input.value.trim().toLowerCase(); const m = countries.find(c => c.name.toLowerCase().startsWith(q)); setFocus(m ? m.name : input.value); } });
  clear.addEventListener("click", () => setFocus(null));
  root.querySelectorAll(".ex-picks button").forEach(b => b.addEventListener("click", () => setFocus(b.textContent)));

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
