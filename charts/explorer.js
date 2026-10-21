/* Figure 5: animated distribution of 112 countries, 1960 to 2019.
   Rendered inline (no iframe) and redrawn from the container's real width. */
(function () {
  const root = document.getElementById("explorer");
  if (!root) return;
  const BLUE = "#3f7cac", CORAL = "#e07a5f", DOT = "#7d8792", INK = "#121212";
  const f0 = (v) => String(Math.round(v));
  const f1 = (v) => (Math.round(v * 10 + 1e-9) / 10).toFixed(1);
  const YEARS = d3.range(1960, 2020);

  root.innerHTML = `
    <div class="ex-top">
      <button type="button" class="ex-play" aria-label="Play">&#9654;</button>
      <span class="ex-year">1960</span>
      <span class="ex-seg" role="group" aria-label="Scale">
        <button type="button" data-mode="linear" aria-pressed="true">Linear</button>
        <button type="button" data-mode="log" aria-pressed="false">Log</button>
      </span>
    </div>
    <input class="ex-slider" type="range" min="1960" max="2019" step="1" value="1960" aria-label="Year" />
    <div class="ex-chart"><svg></svg><div class="ex-tip" hidden></div></div>
    <div class="ex-cards">
      <div class="ex-card" data-key="gap"><div class="ex-label">Difference<span class="ex-x">, 90th − 10th</span></div><div class="ex-val" style="color:${BLUE}"></div><div class="ex-ch"></div><svg class="ex-spark"></svg></div>
      <div class="ex-card" data-key="ratio"><div class="ex-label">Ratio<span class="ex-x">, 90th ÷ 10th</span></div><div class="ex-val" style="color:${CORAL}"></div><div class="ex-ch"></div><svg class="ex-spark"></svg></div>
    </div>`;

  const $ = (s) => root.querySelector(s);
  const play = $(".ex-play"), yearEl = $(".ex-year"), slider = $(".ex-slider"), chart = $(".ex-chart"), tip = $(".ex-tip");
  const svg = d3.select($(".ex-chart svg"));
  const state = { year: 1960, mode: "linear", playing: false, timer: null, width: 0 };
  let D, S, countries, draw;

  d3.json("charts/data.json").then((data) => {
    D = data;
    S = Object.fromEntries(D.stats.map((s) => [s.y, s]));
    countries = D.cohort.map((c) => ({ name: c.name, v: Object.fromEntries(c.v) }));
    build();
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

    function axis() {
      axisG.selectAll("*").remove();
      const sc = state.mode === "log" ? log : lin;
      const ticks = state.mode === "log" ? (narrow ? [2, 10, 50, 200] : [2, 5, 10, 20, 50, 100, 200, 400]) : (narrow ? [0, 100, 200, 300, 400] : [0, 50, 100, 150, 200, 250, 300, 350, 400]);
      ticks.forEach((t) => {
        axisG.append("line").attr("x1", sc(t)).attr("x2", sc(t)).attr("y1", MID - HB - 18).attr("y2", MID + HB + 4).attr("stroke", "#ececec");
        axisG.append("text").attr("class", "ex-tick").attr("x", sc(t)).attr("y", MID + HB + 20).attr("text-anchor", t === ticks[0] ? "start" : t === ticks[ticks.length - 1] ? "end" : "middle")
          .attr("dx", t === ticks[0] ? -3 : t === ticks[ticks.length - 1] ? 3 : 0).text(t);
      });
      axisG.append("text").attr("class", "ex-tick").attr("x", W - pad + 3).attr("y", MID + HB + 38).attr("text-anchor", "end")
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

    draw = (dur) => {
      const sc = state.mode === "log" ? log : lin, s = S[state.year];
      yearEl.textContent = state.year;
      slider.value = state.year;
      axis();
      dotsG.selectAll("circle").data([...layout(state.mode, state.year).values()], (d) => d.name)
        .join((enter) => enter.append("circle").attr("r", R).attr("cx", (d) => d.x).attr("cy", (d) => d.y)
          .attr("fill", DOT).attr("fill-opacity", 0.8).attr("stroke", "#fff").attr("stroke-width", 0.8)
          .on("pointerenter", function (e, d) { if (e.pointerType === "mouse") showTip(d, this); })
          .on("pointerleave", (e) => { if (e.pointerType === "mouse") tip.hidden = true; })
          .on("click", function (e, d) { e.stopPropagation(); showTip(d, this); }))
        .transition().duration(dur).ease(d3.easeCubicInOut).attr("cx", (d) => d.x).attr("cy", (d) => d.y);
      const x10 = sc(s.p10), x90 = sc(s.p90);
      band.transition().duration(dur).attr("x", x10).attr("width", x90 - x10);
      l10.transition().duration(dur).attr("x1", x10).attr("x2", x10);
      l90.transition().duration(dur).attr("x1", x90).attr("x2", x90);
      t10.transition().duration(dur).attr("x", Math.max(14, x10));
      t90.transition().duration(dur).attr("x", Math.min(W - 24, x90));
      cards();
    };
    sparks();
    draw(0);
  }

  // readout cards with sparklines, sized to each card
  const sparkState = {};
  function sparks() {
    root.querySelectorAll(".ex-card").forEach((card) => {
      const key = card.dataset.key, color = key === "gap" ? BLUE : CORAL;
      const sv = d3.select(card.querySelector(".ex-spark")), w = Math.floor(card.querySelector(".ex-spark").clientWidth) || 140, h = 44;
      sv.attr("viewBox", `0 0 ${w} ${h}`).attr("height", h).selectAll("*").remove();
      const x = d3.scaleLinear().domain([1960, 2019]).range([4, w - 4]);
      const y = d3.scaleLinear().domain([0, d3.max(YEARS, (yr) => S[yr][key])]).range([h - 4, 4]);
      const line = d3.line().x((yr) => x(yr)).y((yr) => y(S[yr][key])).curve(d3.curveMonotoneX);
      sv.append("path").attr("d", line(YEARS)).attr("fill", "none").attr("stroke", color).attr("stroke-opacity", 0.25).attr("stroke-width", 2);
      const done = sv.append("path").attr("fill", "none").attr("stroke", color).attr("stroke-width", 2.4);
      const dot = sv.append("circle").attr("r", 4).attr("fill", color).attr("stroke", "#fff").attr("stroke-width", 1.4);
      sparkState[key] = { done, dot, line, x, y };
    });
  }
  function cards() {
    root.querySelectorAll(".ex-card").forEach((card) => {
      const key = card.dataset.key, v = S[state.year][key], c = v / S[1960][key] - 1;
      card.querySelector(".ex-val").textContent = key === "gap" ? `${f0(v)} deaths` : `${f1(v)}×`;
      card.querySelector(".ex-ch").textContent = state.year === 1960 ? "1960 baseline" : `${c > 0 ? "+" : "−"}${Math.round(Math.abs(c) * 100)}% since 1960`;
      const sp = sparkState[key];
      sp.done.attr("d", sp.line(YEARS.filter((yr) => yr <= state.year)));
      sp.dot.attr("cx", sp.x(state.year)).attr("cy", sp.y(v));
    });
  }

  // controls
  const ICON = { play: "&#9654;", pause: "&#10074;&#10074;", replay: "&#8635;" };
  const setIcon = (k) => { play.innerHTML = ICON[k]; play.setAttribute("aria-label", k[0].toUpperCase() + k.slice(1)); play.classList.toggle("replay", k === "replay"); };
  const stop = () => { state.playing = false; clearInterval(state.timer); setIcon(state.year === 2019 ? "replay" : "play"); };
  play.addEventListener("click", () => {
    if (!draw) return;
    if (state.playing) return stop();
    tip.hidden = true;
    if (state.year === 2019) { state.year = 1960; draw(400); }
    state.playing = true; setIcon("pause");
    state.timer = setInterval(() => {
      if (state.year >= 2019) return stop();
      state.year += 1; draw(200);
      if (state.year === 2019) stop();
    }, 230);
  });
  slider.addEventListener("input", () => { if (!draw) return; state.year = +slider.value; tip.hidden = true; stop(); draw(150); });
  root.querySelectorAll(".ex-seg button").forEach((b) => b.addEventListener("click", () => {
    if (!draw) return;
    state.mode = b.dataset.mode;
    root.querySelectorAll(".ex-seg button").forEach((o) => o.setAttribute("aria-pressed", o === b));
    tip.hidden = true; draw(700);
  }));
})();
