/* <world-pins-map> — d3-geo world map with country highlights + pins, zoomable/pannable */
(function () {
  if (customElements.get('world-pins-map')) return;

  const LIBS = [
    { src: 'https://unpkg.com/d3@7.9.0/dist/d3.min.js', integrity: 'sha384-CjloA8y00+1SDAUkjs099PVfnY2KmDC2BZnws9kh8D/lX1s46w6EPhpXdqMfjK6i', global: 'd3' },
    { src: 'https://unpkg.com/topojson-client@3.1.0/dist/topojson-client.min.js', integrity: 'sha384-Ukv1p/xTma6P4/2bY5KzWBw+ydSpXmhCMtyciIQVDJ1RmOxtCYNMF1uXT9T63H67', global: 'topojson' }
  ];
  function loadScript(lib) {
    window.__libCache = window.__libCache || {};
    if (window.__libCache[lib.src]) return window.__libCache[lib.src];
    window.__libCache[lib.src] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = lib.src; s.integrity = lib.integrity; s.crossOrigin = 'anonymous';
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
    return window.__libCache[lib.src];
  }

  const MOBILE_QUERY = '(max-width: 860px)';

  // ISO numeric ids in world-atlas: TR 792, US 840, CA 124, NL 528, VN 704, TH 764, AE 784, GH 288,
  // DE 276, BE 56, AL 8, GR 300, RS 688, HU 348 (visited, no pin/label — map highlight only)
  const HIGHLIGHTS = new Set(['792', '840', '124', '528', '704', '764', '784', '288', '276', '56', '8', '300', '688', '348']);
  // Individual city dots (no per-city labels — labels are drawn once per cluster to avoid overlap)
  const DOTS = [
    { c: [4.48, 51.92], current: true },
    { c: [28.98, 41.01], home: true }, { c: [27.14, 38.42] }, { c: [32.85, 39.93] }, { c: [28.36, 37.22] },
    { c: [-79.38, 43.65] }, { c: [-123.12, 49.28] },
    { c: [-71.06, 42.36] }, { c: [-69.24, 45.25] }, { c: [-74.0, 40.71] },
    { c: [-115.14, 36.17] }, { c: [-118.24, 34.05] }, { c: [-122.42, 37.77] },
    { c: [55.27, 25.2] },
    { c: [100.5, 13.75] }, { c: [98.92, 8.09] }, { c: [98.34, 7.88] }, { c: [100.06, 9.51] },
    { c: [108.2, 16.05] }, { c: [106.28, 17.6] },
    { c: [-0.19, 5.6], soon: true }
  ];
  // One label per region cluster, positioned to avoid collisions
  const LABELS = [
    { name: 'Netherlands', c: [4.48, 51.92], current: true, dy: -14 },
    { name: 'Turkiye', c: [30, 40], home: true, dy: -12 },
    { name: 'Canada', c: [-95, 56], dy: 0 },
    { name: 'USA', c: [-99, 40], dy: 0 },
    { name: 'Dubai', c: [55.27, 25.2], dy: 16 },
    { name: 'Thailand', c: [99, 10], dy: 18 },
    { name: 'Vietnam', c: [110, 18], dy: -12 },
    { name: 'Ghana · soon', c: [-0.19, 5.6], soon: true, dy: 16 }
  ];

  class WorldPinsMap extends HTMLElement {
    async connectedCallback() {
      this.style.display = 'block';
      this.style.position = 'relative';
      try {
        for (const lib of LIBS) { if (lib.global && window[lib.global]) continue; await loadScript(lib); }
        const topoUrl = (typeof window !== 'undefined' && window.__resources && window.__resources.worldTopo) || 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json';
        window.__worldTopo = window.__worldTopo || fetch(topoUrl).then((r) => r.json());
        const topo = await window.__worldTopo;
        this.render(topo);
      } catch (e) {
        this.innerHTML = '<div style="padding:40px;text-align:center;font-family:monospace;font-size:12px;color:#a3a29b">map unavailable offline</div>';
      }
    }
    disconnectedCallback() {
      if (this._mq && this._mqHandler) this._mq.removeEventListener('change', this._mqHandler);
    }
    render(topo) {
      const d3 = window.d3, topojson = window.topojson;
      const W = 960, H = 400;
      const countries = topojson.feature(topo, topo.objects.countries);
      const focus = { type: 'MultiPoint', coordinates: DOTS.map((d) => d.c).concat(LABELS.map((l) => l.c)) };
      const proj = d3.geoNaturalEarth1().fitExtent([[48, 40], [W - 48, H - 40]], focus);
      const path = d3.geoPath(proj);
      this.innerHTML = '';

      const svg = d3.select(this).append('svg')
        .attr('viewBox', `0 0 ${W} ${H}`)
        .attr('style', 'width:100%;height:auto;display:block;touch-action:none;cursor:grab;-webkit-tap-highlight-color:transparent');

      const zoomLayer = svg.append('g');

      zoomLayer.append('g').selectAll('path')
        .data(countries.features.filter((f) => f.id !== '010'))
        .join('path')
        .attr('d', path)
        .attr('fill', (f) => (HIGHLIGHTS.has(String(f.id)) ? '#dcd9ce' : '#edebe4'))
        .attr('stroke', '#fffefb')
        .attr('stroke-width', 0.6);

      const col = (p) => (p.home ? '#059669' : p.current ? '#0891b2' : p.soon ? '#a3a29b' : '#d97706');
      const dot = zoomLayer.append('g').selectAll('g')
        .data(DOTS).join('g')
        .attr('transform', (p) => `translate(${proj(p.c)})`);
      dot.append('circle')
        .attr('r', 4).attr('fill', 'none')
        .attr('stroke', col).attr('stroke-width', 1.2)
        .each(function () {
          const a = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
          a.setAttribute('attributeName', 'r'); a.setAttribute('values', '3;9'); a.setAttribute('dur', '2s'); a.setAttribute('repeatCount', 'indefinite');
          const o = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
          o.setAttribute('attributeName', 'stroke-opacity'); o.setAttribute('values', '0.7;0'); o.setAttribute('dur', '2s'); o.setAttribute('repeatCount', 'indefinite');
          this.appendChild(a); this.appendChild(o);
        });
      dot.append('circle')
        .attr('r', 3).attr('fill', col)
        .attr('stroke', '#fffefb').attr('stroke-width', 1.2);
      const lab = zoomLayer.append('g').selectAll('g')
        .data(LABELS).join('g')
        .attr('transform', (p) => `translate(${proj(p.c)})`);
      lab.each(function (p) {
        const g = window.d3.select(this);
        const txt = g.append('text')
          .text(p.name)
          .attr('y', p.dy)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('style', "font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600;letter-spacing:0.03em;fill:" + (p.home ? '#059669' : p.current ? '#0891b2' : p.soon ? '#8f8e88' : '#141414'));
        const bb = txt.node().getBBox();
        const padX = 8, padY = 4;
        g.insert('rect', 'text')
          .attr('x', bb.x - padX).attr('y', bb.y - padY)
          .attr('width', bb.width + padX * 2).attr('height', bb.height + padY * 2)
          .attr('rx', (bb.height + padY * 2) / 2)
          .attr('fill', '#fffefb')
          .attr('stroke', p.home ? '#059669' : p.current ? '#0891b2' : p.soon ? '#d9d7cf' : '#e0ddd3')
          .attr('stroke-width', 1);
      });

      // ---- zoom / pan ----
      const zoomBehavior = d3.zoom()
        .scaleExtent([1, 10])
        .translateExtent([[0, 0], [W, H]])
        .on('start', () => svg.style('cursor', 'grabbing'))
        .on('end', () => svg.style('cursor', 'grab'))
        .on('zoom', (event) => zoomLayer.attr('transform', event.transform));
      svg.call(zoomBehavior).on('dblclick.zoom', null);

      const currentDot = DOTS.find((d) => d.current) || DOTS[0];
      const identity = d3.zoomIdentity;
      const currentTransform = () => {
        const [cx, cy] = proj(currentDot.c);
        const scale = 4.2;
        return d3.zoomIdentity.translate(W / 2, H / 2).scale(scale).translate(-cx, -cy);
      };

      const mq = window.matchMedia(MOBILE_QUERY);
      const applyDefaultView = (animate) => {
        const t = mq.matches ? currentTransform() : identity;
        (animate ? svg.transition().duration(500) : svg).call(zoomBehavior.transform, t);
      };
      applyDefaultView(false);
      this._mq = mq;
      this._mqHandler = () => applyDefaultView(true);
      mq.addEventListener('change', this._mqHandler);

      // ---- controls overlay ----
      const controls = d3.select(this).append('div')
        .attr('style', 'position:absolute; right:10px; bottom:10px; display:flex; flex-direction:column; gap:6px; z-index:5');
      const btnBase = 'width:30px; height:30px; border-radius:50%; background:#fffefb; border:1px solid #e6e4dd; box-shadow:0 4px 10px rgba(20,20,20,0.12); display:flex; align-items:center; justify-content:center; cursor:pointer; font-family:\'JetBrains Mono\',monospace; font-weight:700; color:#141414; user-select:none; touch-action:manipulation;';

      controls.append('div')
        .attr('style', btnBase + 'font-size:16px;')
        .text('+')
        .on('click', () => svg.transition().duration(250).call(zoomBehavior.scaleBy, 1.6));
      controls.append('div')
        .attr('style', btnBase + 'font-size:18px; line-height:0;')
        .text('−')
        .on('click', () => svg.transition().duration(250).call(zoomBehavior.scaleBy, 1 / 1.6));
      controls.append('div')
        .attr('style', btnBase + 'font-size:14px;')
        .html('&#8634;')
        .attr('title', 'Reset view')
        .on('click', () => applyDefaultView(true));
    }
  }
  customElements.define('world-pins-map', WorldPinsMap);
})();
