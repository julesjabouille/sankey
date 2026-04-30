(function () {
  'use strict';

  var COL_ALIASES = {
    source: ['source', 'origine', 'from', 'départ', 'depart'],
    target: ['target', 'cible', 'to', 'destination', 'arrivée', 'arrivee'],
    value: ['value', 'valeur', 'flux', 'weight', 'poids'],
  };

  /** Même jeu que l’exemple CSV — aperçu DSFR au chargement */
  var DEMO_LINKS = [
    { source: 'Énergie', target: 'Industrie', value: 120 },
    { source: 'Énergie', target: 'Résidentiel', value: 80 },
    { source: 'Industrie', target: 'Export', value: 45 },
    { source: 'Industrie', target: 'Stockage', value: 30 },
    { source: 'Industrie', target: 'Pertes', value: 45 },
    { source: 'Résidentiel', target: 'Chauffage', value: 50 },
    { source: 'Résidentiel', target: 'Électricité', value: 30 },
  ];

  var DSFR_SWATCHES = [
    { label: 'Bleu France', hex: '#000091' },
    { label: 'Bleu France hover', hex: '#1212AB' },
    { label: 'Info', hex: '#0063CB' },
    { label: 'Succès', hex: '#18753C' },
    { label: 'Succès majeur', hex: '#0D8043' },
    { label: 'Attention', hex: '#B34000' },
    { label: 'Erreur', hex: '#E1000F' },
    { label: 'Violet science-fiction', hex: '#A558A0' },
    { label: 'Jaune moutarde', hex: '#D8C635' },
    { label: 'Vert bourgeon', hex: '#448524' },
    { label: 'Brun caramel', hex: '#A9664A' },
    { label: 'Gris G800', hex: '#1E1E1E' },
    { label: 'Gris G600', hex: '#3A3A3A' },
    { label: 'Gris G400', hex: '#696A84' },
    { label: 'Gris G200', hex: '#E5E5E5' },
    { label: 'Bleu cumulus', hex: '#417DC4' },
    { label: 'Menthe majeur', hex: '#169B62' },
    { label: 'Écume majeur', hex: '#465F9D' },
    { label: 'Tournesol majeur', hex: '#716045' },
    { label: 'Macaron majeur', hex: '#E18B76' },
  ];

  var DSFR_PALETTES = {
    institutionnel: [
      '#000091',
      '#E1000F',
      '#18753C',
      '#6A6AF4',
      '#696A84',
      '#161616',
      '#3358A8',
      '#A558A0',
      '#169B62',
      '#FC5D00',
    ],
    bleu_france: ['#000091', '#1212AB', '#2323BE', '#3131D2', '#4A4AE0', '#6A6AF4', '#9292E9', '#CACAFB'],
    ecologie: ['#18753C', '#169B62', '#448524', '#88B39F', '#3E8E65', '#0D8043', '#466964', '#A4C3B2'],
    contraste: ['#000091', '#E1000F', '#18753C', '#161616', '#0063CB', '#FC5D00', '#A558A0', '#D8C635'],
    neutre: ['#3A3A3A', '#545454', '#696A84', '#929292', '#B4B4B4', '#CECECE', '#E5E5E5', '#F6F6F6'],
  };

  var DSFR_LINK_COLORS = {
    bleu_france: 'rgba(0, 0, 145, 0.22)',
    gris: 'rgba(102, 102, 149, 0.28)',
    vert: 'rgba(24, 117, 60, 0.25)',
    rouge: 'rgba(225, 0, 15, 0.2)',
    violet: 'rgba(165, 88, 160, 0.22)',
  };

  var state = {
    links: null,
    graph: null,
    trace: null,
    layout: null,
    fileName: 'apercu-dsfr',
    isDemo: true,
    paletteId: 'institutionnel',
    linkColorKey: 'bleu_france',
    nodeColorOverrides: Object.create(null),
    /** Clé : source + '\\0' + cible (libellés) → couleur hex choisie pour ce flux */
    linkColorOverrides: Object.create(null),
    showLinkValues: false,
    verticalSankey: false,
    /** Flux avec value < seuil : invisibles sur le graphe mais conservés pour la géométrie des nœuds */
    linkDisplayMin: 0,
    /** Taille (px) du texte des valeurs sur les rubans Sankey */
    linkValuesFontPx: 20,
    /** exact | k | M | Md — affichage des valeurs (rubans, infobulles, export HTML) */
    valueDisplayMode: 'exact',
  };

  function linkPairKey(sourceLabel, targetLabel) {
    return sourceLabel + '\0' + targetLabel;
  }

  function hexToRgb(hex) {
    var h = String(hex || '')
      .trim()
      .replace(/^#/, '');
    if (h.length === 3) {
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }
    if (h.length !== 6) return null;
    var r = parseInt(h.slice(0, 2), 16);
    var g = parseInt(h.slice(2, 4), 16);
    var b = parseInt(h.slice(4, 6), 16);
    if (!isFinite(r) || !isFinite(g) || !isFinite(b)) return null;
    return { r: r, g: g, b: b };
  }

  /** Ruban Sankey : même logique que les teintes DSFR prédéfinies (alpha ~ translucide). */
  function hexToFlowRgba(hex, alpha) {
    var a = alpha == null ? 0.28 : alpha;
    var rgb = hexToRgb(hex);
    if (!rgb) return null;
    return 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + a + ')';
  }

  function resolvedNodeHexForLabel(graph, lab, labelIndex) {
    if (state.nodeColorOverrides[lab]) return state.nodeColorOverrides[lab];
    var pal = DSFR_PALETTES[state.paletteId] || DSFR_PALETTES.institutionnel;
    return pal[labelIndex % pal.length];
  }

  /** Couleur CSS pour le carré d’aperçu d’un flux (rgba translucide ou hex). */
  function resolvedLinkCssForIndex(graph, i) {
    var def = DSFR_LINK_COLORS[state.linkColorKey] || DSFR_LINK_COLORS.bleu_france;
    var sLab = graph.labels[graph.link.source[i]];
    var tLab = graph.labels[graph.link.target[i]];
    var k = linkPairKey(sLab, tLab);
    var o = state.linkColorOverrides[k];
    if (o) {
      if (/^rgba?\(/i.test(String(o))) return o;
      return hexToFlowRgba(o, 0.28) || def;
    }
    return def;
  }

  function createColorChip(cssColor, title) {
    var chip = document.createElement('span');
    chip.className = 'sankey-color-chip';
    chip.setAttribute('aria-hidden', 'true');
    chip.style.backgroundColor = cssColor || '#ccc';
    if (title) chip.title = title;
    return chip;
  }

  function buildLinkColorsArray(graph) {
    var def = DSFR_LINK_COLORS[state.linkColorKey] || DSFR_LINK_COLORS.bleu_france;
    var arr = [];
    for (var i = 0; i < graph.link.source.length; i++) {
      var sLab = graph.labels[graph.link.source[i]];
      var tLab = graph.labels[graph.link.target[i]];
      var k = linkPairKey(sLab, tLab);
      var o = state.linkColorOverrides[k];
      if (o) {
        if (/^rgba?\(/i.test(String(o))) arr.push(o);
        else {
          var conv = hexToFlowRgba(o, 0.28);
          arr.push(conv || def);
        }
      } else arr.push(def);
    }
    return arr;
  }

  function readDiagramOptions() {
    var elVal = document.getElementById('opt-afficher-valeurs');
    var elVert = document.getElementById('opt-sankey-vertical');
    state.showLinkValues = !!(elVal && elVal.checked);
    state.verticalSankey = !!(elVert && elVert.checked);
    var elSeuil = document.getElementById('seuil-flux-affichage');
    var seuilRaw =
      elSeuil && String(elSeuil.value || '').trim() !== '' ? parseNumber(elSeuil.value) : 0;
    state.linkDisplayMin = isFinite(seuilRaw) && seuilRaw > 0 ? seuilRaw : 0;
    var elFontRub = document.getElementById('taille-police-valeurs-rubans');
    var fp =
      elFontRub && String(elFontRub.value || '').trim() !== '' ? parseNumber(elFontRub.value) : NaN;
    if (!isFinite(fp)) fp = 20;
    state.linkValuesFontPx = Math.min(40, Math.max(8, Math.round(fp)));
    var elFmt = document.getElementById('opt-format-valeurs');
    var dm = elFmt && elFmt.value ? String(elFmt.value) : 'exact';
    if (dm !== 'k' && dm !== 'M' && dm !== 'Md') dm = 'exact';
    state.valueDisplayMode = dm;
  }

  function isLinkBelowDisplayThreshold(value) {
    var t = state.linkDisplayMin || 0;
    return t > 0 && isFinite(value) && value < t;
  }

  /** Centre du ruban : milieu du rectangle englobant du flux (hauteur × largeur), entre les nœuds visuellement. */
  function pathLinkLabelAnchor(pathEl) {
    try {
      var bbox = pathEl.getBBox();
      if (
        isFinite(bbox.width) &&
        isFinite(bbox.height) &&
        bbox.width >= 2 &&
        bbox.height >= 2 &&
        isFinite(bbox.x) &&
        isFinite(bbox.y)
      ) {
        return { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
      }
    } catch (e) {
      /* getBBox peut échouer avant layout */
    }
    try {
      var len = pathEl.getTotalLength();
      if (!isFinite(len) || len <= 0) return null;
      var pt = pathEl.getPointAtLength(len * 0.5);
      if (!pt || !isFinite(pt.x) || !isFinite(pt.y)) return null;
      return { x: pt.x, y: pt.y };
    } catch (e2) {
      return null;
    }
  }

  /** Groupe les chiffres par blocs de 3 (espaces : milliers, millions, milliards…). */
  function groupIntDigitsWithSpaces(digitStr) {
    digitStr = String(digitStr);
    if (!/^\d+$/.test(digitStr)) return digitStr;
    var len = digitStr.length;
    if (len <= 3) return digitStr;
    var first = len % 3;
    if (first === 0) first = 3;
    var parts = [digitStr.slice(0, first)];
    for (var gi = first; gi < len; gi += 3) {
      parts.push(digitStr.slice(gi, gi + 3));
    }
    return parts.join(' ');
  }

  /** Nombre fini → libellé FR (espaces milliers, virgule décimale). */
  function formatNumberExactFr(n) {
    if (!isFinite(n)) return '';
    var num = Number(n);
    if (Math.abs(num - Math.round(num)) < 1e-9) {
      var ri = Math.round(num);
      var negI = ri < 0;
      var groupedI = groupIntDigitsWithSpaces(String(Math.abs(ri)));
      return negI ? '-' + groupedI : groupedI;
    }
    var s = String(num);
    if (/e/i.test(s)) s = String(Number(num.toPrecision(15)));
    var neg = num < 0;
    if (neg && s.charAt(0) === '-') s = s.slice(1);
    var dot = s.indexOf('.');
    var intPart = dot === -1 ? s : s.slice(0, dot);
    var fracPart = dot === -1 ? '' : s.slice(dot + 1);
    var grouped = groupIntDigitsWithSpaces(intPart);
    if (neg) grouped = '-' + grouped;
    return fracPart.length ? grouped + ',' + fracPart : grouped;
  }

  /** Une décimale après arrondi (virgule FR, espaces sur la partie entière). */
  function formatOneDecimalFr(n) {
    if (!isFinite(n)) return '';
    var r = Math.round(Number(n) * 10) / 10;
    if (!isFinite(r)) return '';
    var neg = r < 0;
    var abs = Math.abs(r);
    var s = abs.toFixed(1);
    var dot = s.indexOf('.');
    var ip = dot === -1 ? s : s.slice(0, dot);
    var fp = dot === -1 ? '0' : s.slice(dot + 1);
    return (neg ? '-' : '') + groupIntDigitsWithSpaces(ip) + ',' + fp;
  }

  function formatCompactSuffix(v, divisor, unit) {
    var q = Number(v) / divisor;
    if (!isFinite(q)) return '';
    return formatOneDecimalFr(q) + ' ' + unit;
  }

  function formatLinkValue(v) {
    if (!isFinite(v)) return '';
    var mode = state.valueDisplayMode || 'exact';
    if (mode === 'k') return formatCompactSuffix(v, 1e3, 'k');
    if (mode === 'M') return formatCompactSuffix(v, 1e6, 'M');
    if (mode === 'Md') return formatCompactSuffix(v, 1e9, 'Md');
    return formatNumberExactFr(Number(v));
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Texte HTML pour node.hovertemplate (%{customdata}) — totaux + branches */
  function buildNodeHoverCustom(graph) {
    var n = graph.labels.length;
    var outgoing = [];
    var incoming = [];
    for (var i = 0; i < n; i++) {
      outgoing.push([]);
      incoming.push([]);
    }
    var Ln = graph.link.source.length;
    for (var j = 0; j < Ln; j++) {
      var s = graph.link.source[j];
      var t = graph.link.target[j];
      var v = graph.link.value[j];
      outgoing[s].push({ name: graph.labels[t], val: v });
      incoming[t].push({ name: graph.labels[s], val: v });
    }
    return graph.labels.map(function (lab, idx) {
      var lines = [];
      var outSum = 0;
      for (var a = 0; a < outgoing[idx].length; a++) outSum += outgoing[idx][a].val;
      var inSum = 0;
      for (var b = 0; b < incoming[idx].length; b++) inSum += incoming[idx][b].val;
      lines.push('<span style="color:#3A3A3A;font-size:12px">Totaux</span>');
      if (inSum > 0) lines.push('Entrant : <b>' + formatLinkValue(inSum) + '</b>');
      if (outSum > 0) lines.push('Sortant : <b>' + formatLinkValue(outSum) + '</b>');
      if (outgoing[idx].length) {
        lines.push(
          '<span style="display:block;margin-top:6px;border-top:1px solid #E5E5E5;padding-top:6px;color:#3A3A3A;font-size:12px">Branches sortantes</span>',
        );
        for (var c = 0; c < outgoing[idx].length; c++) {
          var L = outgoing[idx][c];
          lines.push('→ ' + escapeHtml(L.name) + ' : <b>' + formatLinkValue(L.val) + '</b>');
        }
      } else if (incoming[idx].length) {
        lines.push(
          '<span style="display:block;margin-top:6px;border-top:1px solid #E5E5E5;padding-top:6px;color:#3A3A3A;font-size:12px">Flux entrants</span>',
        );
        for (var d = 0; d < incoming[idx].length; d++) {
          var L2 = incoming[idx][d];
          lines.push('← ' + escapeHtml(L2.name) + ' : <b>' + formatLinkValue(L2.val) + '</b>');
        }
      }
      var body = lines.join('<br>');
      return (
        '<b style="color:#000091;font-size:15px">' + escapeHtml(lab) + '</b><br>' + body
      );
    });
  }

  /**
   * Avec un seuil > 0 : retire du tracé les nœuds sans aucun flux visible (incident), et les liens qui y touchent.
   * Retourne { g, filtered } où g est le graphe à passer à Plotly ; filtered indique si un filtrage a eu lieu.
   */
  function getDisplaySankeyGraphResult(graph) {
    if (!graph || !state.linkDisplayMin || state.linkDisplayMin <= 0) {
      return { g: graph, filtered: false };
    }
    var nk = graph.labels.length;
    var keep = [];
    for (var i = 0; i < nk; i++) keep.push(false);
    for (var j = 0; j < graph.link.source.length; j++) {
      if (isLinkBelowDisplayThreshold(graph.link.value[j])) continue;
      keep[graph.link.source[j]] = true;
      keep[graph.link.target[j]] = true;
    }
    var oldToNew = Object.create(null);
    var newLabels = [];
    for (var ii = 0; ii < nk; ii++) {
      if (!keep[ii]) continue;
      oldToNew[ii] = newLabels.length;
      newLabels.push(graph.labels[ii]);
    }
    if (newLabels.length === 0) {
      return { g: graph, filtered: false };
    }
    var ns = [];
    var nt = [];
    var nv = [];
    for (var jj = 0; jj < graph.link.source.length; jj++) {
      var s = graph.link.source[jj];
      var t = graph.link.target[jj];
      if (!keep[s] || !keep[t]) continue;
      ns.push(oldToNew[s]);
      nt.push(oldToNew[t]);
      nv.push(graph.link.value[jj]);
    }
    if (ns.length === 0) {
      return { g: graph, filtered: false };
    }
    return {
      g: { labels: newLabels, link: { source: ns, target: nt, value: nv } },
      filtered: true,
    };
  }

  /**
   * Sans filtrage par seuil : masque seulement l’étiquette si aucun flux visible ne part (puits : si entrant visible).
   */
  function buildNodeDisplayLabels(graph, hideLink) {
    if (!state.linkDisplayMin || state.linkDisplayMin <= 0) {
      return graph.labels.slice();
    }
    return graph.labels.map(function (lab, idx) {
      var hasOutgoing = false;
      var visibleOutgoing = false;
      var visibleIncoming = false;
      for (var j = 0; j < graph.link.source.length; j++) {
        if (graph.link.source[j] === idx) {
          hasOutgoing = true;
          if (!hideLink[j]) visibleOutgoing = true;
        }
        if (graph.link.target[j] === idx && !hideLink[j]) visibleIncoming = true;
      }
      if (hasOutgoing) {
        return visibleOutgoing ? lab : '';
      }
      return visibleIncoming ? lab : '';
    });
  }

  var SVG_NS = 'http://www.w3.org/2000/svg';

  /** Plotly ne dessine pas link.label sur les rubans : on ajoute des <text> SVG. */
  function syncFlowValueLabels() {
    readDiagramOptions();
    var gd = document.getElementById('chart');
    if (!gd) return;
    var svg = gd.querySelector('svg');
    if (!svg) return;
    var prev = svg.querySelectorAll('g.sankey-app-flow-value-wrap, text.sankey-app-flow-value');
    for (var i = 0; i < prev.length; i++) {
      if (prev[i].parentNode) prev[i].parentNode.removeChild(prev[i]);
    }
    if (!state.showLinkValues) return;
    var paths = svg.querySelectorAll('path.sankey-link');
    for (var p = 0; p < paths.length; p++) {
      var pathEl = paths[p];
      var d = pathEl.__data__;
      if (!d || !d.link || d.link.value == null) continue;
      if (isLinkBelowDisplayThreshold(Number(d.link.value))) continue;
      try {
        var mid = pathLinkLabelAnchor(pathEl);
        if (!mid) continue;
        var label = formatLinkValue(d.link.value);
        var text = document.createElementNS(SVG_NS, 'text');
        text.setAttribute('class', 'sankey-app-flow-value');
        text.setAttribute('pointer-events', 'none');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('font-size', String(state.linkValuesFontPx));
        var parent = pathEl.parentNode || svg;
        if (state.verticalSankey) {
          /* Repère local : translate au centre du ruban puis scale(1,-1) pour annuler l’inversion Y Plotly ; le texte est réécrit en (0,0) dans ce repère. */
          var wrap = document.createElementNS(SVG_NS, 'g');
          wrap.setAttribute('class', 'sankey-app-flow-value-wrap');
          wrap.setAttribute('transform', 'translate(' + mid.x + ',' + mid.y + ') scale(1,-1)');
          text.setAttribute('x', '0');
          text.setAttribute('y', '0');
          text.textContent = '';
          wrap.appendChild(text);
          parent.appendChild(wrap);
          text.textContent = label;
        } else {
          text.setAttribute('x', String(mid.x));
          text.setAttribute('y', String(mid.y));
          text.textContent = label;
          parent.appendChild(text);
        }
      } catch (e) {
        /* getPointAtLength peut échouer avant layout complet */
      }
    }
  }

  function normalizeHeader(h) {
    return String(h || '')
      .trim()
      .toLowerCase()
      .replace(/\uFEFF/g, '')
      .replace(/\s+/g, ' ');
  }

  function pickColumnIndex(headers, aliases) {
    var map = {};
    for (var i = 0; i < headers.length; i++) {
      map[normalizeHeader(headers[i])] = i;
    }
    for (var a = 0; a < aliases.length; a++) {
      var key = aliases[a].toLowerCase();
      if (map[key] !== undefined) return map[key];
    }
    return -1;
  }

  function parseNumber(v) {
    if (v === null || v === undefined) return NaN;
    var s = String(v).trim().replace(/\s/g, '').replace(',', '.');
    if (s === '') return NaN;
    return Number(s);
  }

  function aggregateLinks(links) {
    var acc = new Map();
    for (var i = 0; i < links.length; i++) {
      var L = links[i];
      var k = L.source + '\0' + L.target;
      acc.set(k, (acc.get(k) || 0) + L.value);
    }
    var out = [];
    acc.forEach(function (v, k) {
      var p = k.split('\0');
      out.push({ source: p[0], target: p[1], value: v });
    });
    return out;
  }

  function parseCsvFile(file, done) {
    if (!window.Papa) {
      done(new Error('Analyse CSV indisponible (Papa Parse).'));
      return;
    }
    window.Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      encoding: 'UTF-8',
      complete: function (res) {
        if (res.errors && res.errors.length) {
          var fatal = res.errors.find(function (e) {
            return e.type === 'Quotes' || e.type === 'Delimiter';
          });
          if (fatal) {
            done(new Error('CSV illisible : ' + fatal.message));
            return;
          }
        }
        var rows = res.data || [];
        if (!rows.length) {
          done(new Error('Le fichier ne contient aucune ligne de données.'));
          return;
        }
        var headers = res.meta && res.meta.fields ? res.meta.fields : Object.keys(rows[0] || {});
        var iSrc = pickColumnIndex(headers, COL_ALIASES.source);
        var iTgt = pickColumnIndex(headers, COL_ALIASES.target);
        var iVal = pickColumnIndex(headers, COL_ALIASES.value);
        if (iSrc === -1 || iTgt === -1 || iVal === -1) {
          if (headers.length >= 3 && iSrc === -1 && iTgt === -1 && iVal === -1) {
            iSrc = 0;
            iTgt = 1;
            iVal = 2;
          } else {
            done(
              new Error(
                'Colonnes introuvables. Utilisez source, target et value (ou les trois premières colonnes du fichier).',
              ),
            );
            return;
          }
        }
        var keySrc = headers[iSrc];
        var keyTgt = headers[iTgt];
        var keyVal = headers[iVal];
        var raw = [];
        for (var r = 0; r < rows.length; r++) {
          var row = rows[r];
          if (!row) continue;
          var src = row[keySrc];
          var tgt = row[keyTgt];
          var val = parseNumber(row[keyVal]);
          if (src === undefined || tgt === undefined) continue;
          src = String(src).trim();
          tgt = String(tgt).trim();
          if (!src || !tgt) continue;
          if (!isFinite(val) || val <= 0) continue;
          raw.push({ source: src, target: tgt, value: val });
        }
        if (!raw.length) {
          done(new Error('Aucun lien valide (source, cible et valeur strictement positive).'));
          return;
        }
        done(null, aggregateLinks(raw));
      },
      error: function (err) {
        done(err || new Error('Lecture du fichier impossible.'));
      },
    });
  }

  function buildSankeyGraph(links) {
    var order = [];
    var index = Object.create(null);
    function touch(label) {
      if (index[label] === undefined) {
        index[label] = order.length;
        order.push(label);
      }
      return index[label];
    }
    var srcIdx = [];
    var tgtIdx = [];
    var vals = [];
    for (var i = 0; i < links.length; i++) {
      var L = links[i];
      srcIdx.push(touch(L.source));
      tgtIdx.push(touch(L.target));
      vals.push(L.value);
    }
    return {
      labels: order,
      link: { source: srcIdx, target: tgtIdx, value: vals },
    };
  }

  function buildNodeColors(graph) {
    var pal = DSFR_PALETTES[state.paletteId] || DSFR_PALETTES.institutionnel;
    return graph.labels.map(function (lab, i) {
      if (state.nodeColorOverrides[lab]) return state.nodeColorOverrides[lab];
      return pal[i % pal.length];
    });
  }

  function makeTrace(graph) {
    readDiagramOptions();
    var disp = getDisplaySankeyGraphResult(graph);
    var displayGraph = disp.g;
    var displayFiltered = disp.filtered;
    var nodeColors = buildNodeColors(displayGraph);
    var linkColors = buildLinkColorsArray(displayGraph);
    var hoverLabelNode = {
      bgcolor: '#f6f6f6',
      bordercolor: '#000091',
      borderwidth: 2,
      font: { family: 'Marianne, arial, sans-serif', size: 14, color: '#161616' },
      align: 'left',
    };
    var hoverLabelLink = {
      bgcolor: '#f6f6f6',
      bordercolor: '#000091',
      borderwidth: 2,
      font: { family: 'Marianne, arial, sans-serif', size: 14, color: '#161616' },
      align: 'left',
    };
    var linkCustom = [];
    for (var li = 0; li < displayGraph.link.source.length; li++) {
      var sIdx = displayGraph.link.source[li];
      var tIdx = displayGraph.link.target[li];
      var vL = displayGraph.link.value[li];
      linkCustom.push(
        '<b>Origine</b> : ' +
          escapeHtml(displayGraph.labels[sIdx]) +
          '<br><b>Cible</b> : ' +
          escapeHtml(displayGraph.labels[tIdx]) +
          '<br><b>Valeur</b> : <b>' +
          formatLinkValue(vL) +
          '</b>',
      );
    }
    var hideLink = [];
    for (var hi = 0; hi < displayGraph.link.value.length; hi++) {
      hideLink.push(isLinkBelowDisplayThreshold(displayGraph.link.value[hi]));
    }
    for (var ci = 0; ci < linkColors.length; ci++) {
      if (hideLink[ci]) linkColors[ci] = 'rgba(0,0,0,0)';
    }
    var anyHidden = false;
    for (var ai = 0; ai < hideLink.length; ai++) {
      if (hideLink[ai]) {
        anyHidden = true;
        break;
      }
    }
    var hoverTpl =
      '<b style="color:#000091">Flux</b><br>%{customdata}<extra></extra>';
    var hoverArr = null;
    if (anyHidden) {
      hoverArr = [];
      for (var hi2 = 0; hi2 < hideLink.length; hi2++) {
        hoverArr.push(hideLink[hi2] ? '<extra></extra>' : hoverTpl);
      }
    }
    var linkObj = {
      source: displayGraph.link.source,
      target: displayGraph.link.target,
      value: displayGraph.link.value,
      color: linkColors,
      customdata: linkCustom,
      hoverlabel: hoverLabelLink,
      hovertemplate: hoverArr || hoverTpl,
    };
    var nodeLabels = displayFiltered
      ? displayGraph.labels.slice()
      : buildNodeDisplayLabels(displayGraph, hideLink);
    return {
      type: 'sankey',
      orientation: state.verticalSankey ? 'v' : 'h',
      valueformat: '.0f',
      valuesuffix: '',
      node: {
        pad: 18,
        thickness: 22,
        line: { color: '#3A3A3A', width: 0.35 },
        label: nodeLabels,
        color: nodeColors,
        customdata: buildNodeHoverCustom(displayGraph),
        hoverlabel: hoverLabelNode,
        hovertemplate: '%{customdata}<extra></extra>',
      },
      link: linkObj,
    };
  }

  function makeLayout() {
    readDiagramOptions();
    return {
      font: { family: 'Marianne, arial, sans-serif', size: 13, color: '#161616' },
      paper_bgcolor: '#ffffff',
      plot_bgcolor: '#ffffff',
      margin: { l: 24, r: 24, t: 24, b: 24 },
      autosize: true,
      hoverlabel: {
        bgcolor: '#f6f6f6',
        bordercolor: '#000091',
        borderwidth: 2,
        font: { family: 'Marianne, arial, sans-serif', size: 14, color: '#161616' },
        align: 'left',
      },
      meta: {
        sankeyShowFlowValues: state.showLinkValues,
        sankeyLinkDisplayMin: state.linkDisplayMin,
        sankeyLinkValuesFontPx: state.linkValuesFontPx,
        sankeyVertical: state.verticalSankey,
        sankeyValueDisplayMode: state.valueDisplayMode,
      },
    };
  }

  function showAlert(message, kind) {
    var zone = document.getElementById('alerte-zone');
    if (!zone) return;
    zone.innerHTML = '';
    if (!message) return;
    var k = kind === 'success' ? 'success' : 'error';
    var title = kind === 'success' ? 'Succès' : 'Erreur';
    var el = document.createElement('div');
    el.className = 'fr-alert fr-alert--' + k;
    el.setAttribute('role', 'alert');
    el.innerHTML =
      '<h3 class="fr-alert__title">' +
      title +
      '</h3>' +
      '<p class="fr-alert__description">' +
      message.replace(/</g, '&lt;').replace(/>/g, '&gt;') +
      '</p>';
    zone.appendChild(el);
  }

  function clearAlert() {
    showAlert('');
  }

  function triggerDownload(filename, mime, body) {
    var blob = new Blob([body], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 2000);
  }

  function utf8JsonToBinaryB64(json) {
    return btoa(
      encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, function (_, hex) {
        return String.fromCharCode(parseInt(hex, 16));
      }),
    );
  }

  function buildStandaloneHtml(payload) {
    var plotlyCdn = 'https://cdn.plot.ly/plotly-2.35.3.min.js';
    var b64 = utf8JsonToBinaryB64(JSON.stringify(payload));
    return (
      '<!DOCTYPE html>\n' +
      '<html lang="fr">\n<head>\n<meta charset="utf-8"/>\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1"/>\n' +
      '<title>Diagramme Sankey</title>\n' +
      '<script src="' +
      plotlyCdn +
      '"><\/script>\n' +
      '</head>\n<body style="margin:0;font-family:Marianne,system-ui,sans-serif;">\n' +
      '<div id="g" style="width:100%;min-height:90vh;"></div>\n' +
      '<script>\n' +
      '(function(){\n' +
      'function fromB64(b64){\n' +
      '  return decodeURIComponent(Array.prototype.map.call(atob(b64),function(c){\n' +
      '    return "%"+("00"+c.charCodeAt(0).toString(16)).slice(-2);\n' +
      '  }).join(""));\n' +
      '}\n' +
      'function groupIntDigitsWithSpaces(d){d=String(d);if(!/^\\d+$/.test(d))return d;var L=d.length;if(L<=3)return d;var f=L%3;if(f===0)f=3;var p=[d.slice(0,f)];for(var gi=f;gi<L;gi+=3)p.push(d.slice(gi,gi+3));return p.join(" ");}\n' +
      'function formatNumberExactExport(n){if(!isFinite(n))return"";var v=Number(n);if(Math.abs(v-Math.round(v))<1e-9){var ri=Math.round(v),negI=ri<0,g=groupIntDigitsWithSpaces(String(Math.abs(ri)));return negI?"-"+g:g;}var s=String(v);if(/e/i.test(s))s=String(Number(v.toPrecision(15)));var neg=v<0;if(neg&&s.charAt(0)==="-")s=s.slice(1);var dot=s.indexOf("."),ip=dot===-1?s:s.slice(0,dot),fp=dot===-1?"":s.slice(dot+1),gr=groupIntDigitsWithSpaces(ip);if(neg)gr="-"+gr;return fp.length?gr+","+fp:gr;}\n' +
      'function formatOneDecimalExport(n){if(!isFinite(n))return"";var r=Math.round(Number(n)*10)/10;if(!isFinite(r))return"";var neg=r<0,a=Math.abs(r),s=a.toFixed(1),d=s.indexOf("."),ip=d===-1?s:s.slice(0,d),fp=d===-1?"0":s.slice(d+1);return(neg?"-":"")+groupIntDigitsWithSpaces(ip)+","+fp;}\n' +
      'function formatFlowValueExport(v,mode){if(!isFinite(v))return"";mode=mode||"exact";if(mode==="k")return formatOneDecimalExport(v/1e3)+" k";if(mode==="M")return formatOneDecimalExport(v/1e6)+" M";if(mode==="Md")return formatOneDecimalExport(v/1e9)+" Md";return formatNumberExactExport(v);}\n' +
      'var payload = JSON.parse(fromB64(' +
      JSON.stringify(b64) +
      '));\n' +
      'function applySankeyFlowLabels(gd){\n' +
      '  try {\n' +
      '    var meta = payload.layout && payload.layout.meta;\n' +
      '    if (!meta || !meta.sankeyShowFlowValues) return;\n' +
      '    var svg = gd && gd.querySelector && gd.querySelector("svg");\n' +
      '    if (!svg) return;\n' +
      '    var NS = "http://www.w3.org/2000/svg";\n' +
      '    Array.prototype.slice.call(svg.querySelectorAll("g.sankey-export-flow-value-wrap, text.sankey-export-flow-value")).forEach(function(n){ if(n.parentNode) n.parentNode.removeChild(n); });\n' +
      '    var minDisp = (meta && meta.sankeyLinkDisplayMin) ? Number(meta.sankeyLinkDisplayMin) : 0;\n' +
      '    if (!isFinite(minDisp) || minDisp < 0) minDisp = 0;\n' +
      '    var fsz = (meta && meta.sankeyLinkValuesFontPx) ? Number(meta.sankeyLinkValuesFontPx) : 20;\n' +
      '    if (!isFinite(fsz)) fsz = 20;\n' +
      '    fsz = Math.min(40, Math.max(8, Math.round(fsz)));\n' +
      '    var vert = !!(meta && meta.sankeyVertical);\n' +
      '    var dispMode = (meta && meta.sankeyValueDisplayMode) ? String(meta.sankeyValueDisplayMode) : "exact";\n' +
      '    if (dispMode !== "k" && dispMode !== "M" && dispMode !== "Md") dispMode = "exact";\n' +
      '    Array.prototype.forEach.call(svg.querySelectorAll("path.sankey-link"), function(pathEl){\n' +
      '      var d = pathEl.__data__;\n' +
      '      if (!d || !d.link || d.link.value == null) return;\n' +
      '      var v = Number(d.link.value);\n' +
      '      if (!isFinite(v)) return;\n' +
      '      if (minDisp > 0 && v < minDisp) return;\n' +
      '      var t = formatFlowValueExport(v, dispMode);\n' +
      '      var cx, cy;\n' +
      '      try {\n' +
      '        var bb = pathEl.getBBox();\n' +
      '        if (isFinite(bb.width) && isFinite(bb.height) && bb.width >= 2 && bb.height >= 2) {\n' +
      '          cx = bb.x + bb.width / 2; cy = bb.y + bb.height / 2;\n' +
      '        } else throw new Error("bbox");\n' +
      '      } catch (bbErr) {\n' +
      '        var pl = pathEl.getTotalLength();\n' +
      '        if (!isFinite(pl) || pl <= 0) return;\n' +
      '        var pt = pathEl.getPointAtLength(pl * 0.5);\n' +
      '        if (!pt || !isFinite(pt.x) || !isFinite(pt.y)) return;\n' +
      '        cx = pt.x; cy = pt.y;\n' +
      '      }\n' +
      '      var parent = pathEl.parentNode || svg;\n' +
      '      var text = document.createElementNS(NS, "text");\n' +
      '      text.setAttribute("class", "sankey-export-flow-value");\n' +
      '      text.setAttribute("pointer-events", "none");\n' +
      '      text.setAttribute("text-anchor", "middle");\n' +
      '      text.setAttribute("dominant-baseline", "middle");\n' +
      '      text.setAttribute("font-size", String(fsz));\n' +
      '      text.setAttribute("font-weight", "700");\n' +
      '      text.setAttribute("font-family", "Marianne, Arial, sans-serif");\n' +
      '      text.setAttribute("fill", "#161616");\n' +
      '      if (vert) {\n' +
      '        var wrap = document.createElementNS(NS, "g");\n' +
      '        wrap.setAttribute("class", "sankey-export-flow-value-wrap");\n' +
      '        wrap.setAttribute("transform", "translate(" + String(cx) + "," + String(cy) + ") scale(1,-1)");\n' +
      '        text.setAttribute("x", "0");\n' +
      '        text.setAttribute("y", "0");\n' +
      '        text.textContent = "";\n' +
      '        wrap.appendChild(text);\n' +
      '        parent.appendChild(wrap);\n' +
      '        text.textContent = t;\n' +
      '      } else {\n' +
      '        text.setAttribute("x", String(cx));\n' +
      '        text.setAttribute("y", String(cy));\n' +
      '        text.textContent = t;\n' +
      '        parent.appendChild(text);\n' +
      '      }\n' +
      '    });\n' +
      '  } catch (e) {}\n' +
      '}\n' +
      'function run(){\n' +
      '  if (!window.Plotly){ setTimeout(run, 50); return; }\n' +
      '  var nl = Plotly.newPlot("g", payload.data, payload.layout, {responsive:true, displaylogo:false});\n' +
      '  function done(gd){\n' +
      '    var el = (gd && gd.querySelector) ? gd : document.getElementById("g");\n' +
      '    function runLbl(){ setTimeout(function(){ applySankeyFlowLabels(el); }, 80); }\n' +
      '    runLbl();\n' +
      '    if (gd && gd.on) {\n' +
      '      gd.on("plotly_afterplot", runLbl);\n' +
      '      gd.on("plotly_relayout", runLbl);\n' +
      '    }\n' +
      '  }\n' +
      '  if (nl && typeof nl.then === "function") nl.then(done).catch(function(){ done(document.getElementById("g")); });\n' +
      '  else done(document.getElementById("g"));\n' +
      '}\n' +
      'run();\n' +
      '})();\n' +
      '<\/script>\n' +
      '</body>\n</html>\n'
    );
  }

  function setBusy(btn, busy, label) {
    if (!btn) return;
    btn.disabled = !!busy;
    if (label) btn.textContent = label;
  }

  function setFichierCsvStatut(fileOk) {
    var el = document.getElementById('fichier-csv-statut');
    if (!el) return;
    el.textContent = fileOk ? 'Fichier reçu.' : 'Pas de fichier chargé.';
    el.classList.toggle('sankey-file-statut--ok', !!fileOk);
    el.classList.toggle('sankey-file-statut--idle', !fileOk);
  }

  function setBrowseBusy(busy) {
    var b = document.getElementById('btn-parcourir-csv');
    if (!b) return;
    b.disabled = !!busy;
    b.textContent = busy ? 'Analyse…' : 'Parcourir…';
  }

  function ensureSankeyFlowLabelHooks(gd) {
    if (!gd || gd._autovizSankeyFlowLabelHooks) return;
    gd._autovizSankeyFlowLabelHooks = true;
    function schedFlowLabels() {
      requestAnimationFrame(syncFlowValueLabels);
    }
    gd.on('plotly_afterplot', schedFlowLabels);
    gd.on('plotly_relayout', schedFlowLabels);
    gd.on('plotly_redraw', schedFlowLabels);
    gd.addEventListener('pointerup', schedFlowLabels, true);
    gd.addEventListener('touchend', schedFlowLabels, true);
    var moveT = 0;
    var lastMove = 0;
    gd.addEventListener(
      'pointermove',
      function () {
        var elValMove = document.getElementById('opt-afficher-valeurs');
        if (!(elValMove && elValMove.checked)) return;
        var now = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
        if (now - lastMove < 32) return;
        lastMove = now;
        if (moveT) cancelAnimationFrame(moveT);
        moveT = requestAnimationFrame(function () {
          moveT = 0;
          syncFlowValueLabels();
        });
      },
      { passive: true },
    );
  }

  /** Plotly ne reapplique pas toujours les couleurs Sankey avec react sans datarevision ni premier newPlot. */
  function bumpDataRevision() {
    if (state.layout) state.layout.datarevision = Date.now();
  }

  function renderPlot() {
    if (!window.Plotly || !state.trace) return;
    bumpDataRevision();
    var gd = document.getElementById('chart');
    ensureSankeyFlowLabelHooks(gd);
    var cfg = {
      responsive: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d'],
    };
    function afterDraw() {
      requestAnimationFrame(function () {
        requestAnimationFrame(syncFlowValueLabels);
      });
    }
    var needsNewPlot = !gd._fullData || gd._fullData.length === 0;
    var pr = needsNewPlot
      ? window.Plotly.newPlot(gd, [state.trace], state.layout, cfg)
      : window.Plotly.react(gd, [state.trace], state.layout, cfg);
    if (pr && typeof pr.then === 'function') pr.then(afterDraw).catch(afterDraw);
    else afterDraw();
  }

  function exportPng() {
    var gd = document.getElementById('chart');
    if (!window.Plotly || !gd) return;
    return window.Plotly.downloadImage(gd, {
      format: 'png',
      filename: state.fileName,
      height: 900,
      width: 1280,
      scale: 2,
    });
  }

  function exportSvg() {
    var gd = document.getElementById('chart');
    if (!window.Plotly || !gd) return;
    return window.Plotly.downloadImage(gd, {
      format: 'svg',
      filename: state.fileName,
      height: 900,
      width: 1280,
      scale: 1,
    });
  }

  function exportPdf() {
    var gd = document.getElementById('chart');
    if (!window.Plotly || !gd) return Promise.reject(new Error('Plotly indisponible.'));
    var JsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!JsPDF) return Promise.reject(new Error('jsPDF indisponible.'));
    return window.Plotly.toImage(gd, { format: 'png', height: 1000, width: 1400, scale: 2 }).then(function (dataUrl) {
      var pdf = new JsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      var pageW = pdf.internal.pageSize.getWidth();
      var pageH = pdf.internal.pageSize.getHeight();
      pdf.addImage(dataUrl, 'PNG', 0, 0, pageW, pageH, undefined, 'FAST');
      pdf.save(state.fileName + '.pdf');
    });
  }

  function exportHtml() {
    readDiagramOptions();
    var gd = document.getElementById('chart');
    var layout = state.layout;
    var data0 = state.trace;
    if (gd && gd.layout) layout = gd.layout;
    if (gd && gd.data && gd.data[0]) data0 = gd.data[0];
    var payload = {
      data: [JSON.parse(JSON.stringify(data0))],
      layout: JSON.parse(JSON.stringify(layout)),
    };
    payload.layout.meta = Object.assign({}, payload.layout.meta || {}, {
      sankeyShowFlowValues: !!state.showLinkValues,
      sankeyLinkDisplayMin: state.linkDisplayMin || 0,
      sankeyLinkValuesFontPx: state.linkValuesFontPx,
      sankeyVertical: !!state.verticalSankey,
      sankeyValueDisplayMode: state.valueDisplayMode || 'exact',
    });
    var html = buildStandaloneHtml(payload);
    triggerDownload(state.fileName + '.html', 'text/html;charset=utf-8', html);
  }

  function asPromise(maybe) {
    return maybe && typeof maybe.then === 'function' ? maybe : Promise.resolve();
  }

  function onExport() {
    var sel = document.getElementById('format-export');
    var fmt = sel ? sel.value : 'png';
    clearAlert();
    var btn = document.getElementById('btn-exporter');
    setBusy(btn, true, 'Export…');
    var p;
    if (fmt === 'png') p = asPromise(exportPng());
    else if (fmt === 'svg') p = asPromise(exportSvg());
    else if (fmt === 'pdf') p = exportPdf();
    else if (fmt === 'html') {
      try {
        exportHtml();
        p = Promise.resolve();
      } catch (e) {
        p = Promise.reject(e);
      }
    } else p = asPromise(exportPng());
    p.then(function () {
      setBusy(btn, false, 'Télécharger');
    }).catch(function (err) {
      setBusy(btn, false, 'Télécharger');
      showAlert((err && err.message) || 'Export impossible.', 'error');
    });
  }

  function baseName(name) {
    var n = String(name || 'sankey').replace(/\.[^/.]+$/, '');
    return n || 'sankey';
  }

  function updateResume() {
    var resume = document.getElementById('resume-donnees');
    if (!resume || !state.graph) return;
    if (state.isDemo) {
      resume.textContent =
        'Aperçu de démonstration (données et couleurs DSFR). Choisissez un fichier CSV avec « Parcourir… » pour remplacer cet aperçu.';
    } else {
      resume.textContent =
        state.links.length + ' lien(s), ' + state.graph.labels.length + ' nœud(s). Fichier : ' + state.fileName + '.';
    }
  }

  function loadDemoPreview() {
    state.isDemo = true;
    state.nodeColorOverrides = Object.create(null);
    state.linkColorOverrides = Object.create(null);
    state.links = DEMO_LINKS.map(function (L) {
      return { source: L.source, target: L.target, value: L.value };
    });
    state.paletteId = 'institutionnel';
    state.linkColorKey = 'bleu_france';
    state.graph = buildSankeyGraph(state.links);
    state.trace = makeTrace(state.graph);
    state.layout = makeLayout();
    state.fileName = 'apercu-dsfr';
    populateNodeColorTable();
    populateLinkColorTable();
    renderPlot();
    updateResume();
    var btnE = document.getElementById('btn-exporter');
    if (btnE) btnE.disabled = false;
    setFichierCsvStatut(false);
  }

  function setColorResetButtonsDisabled(disabled) {
    var bf = document.getElementById('btn-reset-couleurs-flux');
    var bn = document.getElementById('btn-reset-couleurs-noeuds');
    if (bf) bf.disabled = !!disabled;
    if (bn) bn.disabled = !!disabled;
  }

  /** Pas de lignes « exemple » sur l’aperçu démo : uniquement après import CSV. */
  function fillColorTableDemoPlaceholder(tbody) {
    tbody.innerHTML = '';
    var tr = document.createElement('tr');
    var td = document.createElement('td');
    td.colSpan = 3;
    td.className = 'fr-text--sm';
    td.textContent =
      'Les couleurs par flux et par nœud se règlent sur les données de votre fichier CSV importé, pas sur l’aperçu de démonstration.';
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  function populateNodeColorTable() {
    var tbody = document.getElementById('node-color-tbody');
    if (!tbody || !state.graph) return;
    if (state.isDemo) {
      fillColorTableDemoPlaceholder(tbody);
      setColorResetButtonsDisabled(true);
      return;
    }
    var renderG = getDisplaySankeyGraphResult(state.graph).g;
    if (!renderG) return;
    tbody.innerHTML = '';
    for (var j = 0; j < renderG.labels.length; j++) {
      var lab = renderG.labels[j];
      var tr = document.createElement('tr');
      var td0 = document.createElement('td');
      td0.textContent = lab;
      var tdChip = document.createElement('td');
      tdChip.className = 'sankey-table-chip-cell';
      var hexRes = resolvedNodeHexForLabel(renderG, lab, j);
      tdChip.appendChild(
        createColorChip(hexRes, 'Aperçu : ' + (state.nodeColorOverrides[lab] ? 'couleur personnalisée' : 'palette')),
      );
      var tdSel = document.createElement('td');
      tdSel.className = 'sankey-color-select-cell';
      var s = document.createElement('select');
      s.className = 'fr-select';
      s.setAttribute('data-node-label', lab);
      var o0 = document.createElement('option');
      o0.value = '';
      o0.textContent = 'Automatique (palette du thème)';
      s.appendChild(o0);
      for (var k = 0; k < DSFR_SWATCHES.length; k++) {
        var sw = DSFR_SWATCHES[k];
        var o = document.createElement('option');
        o.value = sw.hex;
        o.textContent = sw.label;
        o.title = sw.hex;
        o.setAttribute('data-hex', sw.hex);
        o.style.backgroundColor = sw.hex;
        s.appendChild(o);
      }
      var cov = state.nodeColorOverrides[lab] || '';
      if (cov && cov !== '') {
        s.value = cov;
        if (s.value !== cov) {
          var oCust = document.createElement('option');
          oCust.value = cov;
          oCust.textContent = 'Personnalisée';
          oCust.title = cov;
          oCust.setAttribute('data-hex', cov);
          if (/^#|^rgb/i.test(cov)) oCust.style.backgroundColor = cov;
          s.appendChild(oCust);
          s.value = cov;
        }
      } else s.value = '';
      s.addEventListener('change', function () {
        var label = this.getAttribute('data-node-label');
        var v = this.value;
        if (v) state.nodeColorOverrides[label] = v;
        else delete state.nodeColorOverrides[label];
        refreshStyleFromUi();
      });
      tdSel.appendChild(s);
      tr.appendChild(td0);
      tr.appendChild(tdChip);
      tr.appendChild(tdSel);
      tbody.appendChild(tr);
    }
    setColorResetButtonsDisabled(false);
  }

  function populateLinkColorTable() {
    var tbody = document.getElementById('link-color-tbody');
    if (!tbody || !state.graph) return;
    if (state.isDemo) {
      fillColorTableDemoPlaceholder(tbody);
      return;
    }
    var graph = getDisplaySankeyGraphResult(state.graph).g;
    if (!graph) return;
    tbody.innerHTML = '';
    for (var i = 0; i < graph.link.source.length; i++) {
      var sLab = graph.labels[graph.link.source[i]];
      var tLab = graph.labels[graph.link.target[i]];
      var k = linkPairKey(sLab, tLab);
      var tr = document.createElement('tr');
      var td0 = document.createElement('td');
      td0.textContent = sLab + ' → ' + tLab;
      var tdChip = document.createElement('td');
      tdChip.className = 'sankey-table-chip-cell';
      var cssRes = resolvedLinkCssForIndex(graph, i);
      tdChip.appendChild(
        createColorChip(
          cssRes,
          'Aperçu : ' + (state.linkColorOverrides[k] ? 'couleur personnalisée' : 'teinte par défaut'),
        ),
      );
      var tdSel = document.createElement('td');
      tdSel.className = 'sankey-color-select-cell';
      var s = document.createElement('select');
      s.className = 'fr-select';
      s.setAttribute('data-link-key', k);
      var o0 = document.createElement('option');
      o0.value = '';
      o0.textContent = 'Automatique (teinte par défaut)';
      s.appendChild(o0);
      for (var sw = 0; sw < DSFR_SWATCHES.length; sw++) {
        var item = DSFR_SWATCHES[sw];
        var o = document.createElement('option');
        o.value = item.hex;
        o.textContent = item.label;
        o.title = item.hex;
        o.setAttribute('data-hex', item.hex);
        o.style.backgroundColor = item.hex;
        s.appendChild(o);
      }
      var cov = state.linkColorOverrides[k] || '';
      if (cov && cov !== '') {
        s.value = cov;
        if (s.value !== cov) {
          var oCustL = document.createElement('option');
          oCustL.value = cov;
          oCustL.textContent = 'Personnalisée';
          oCustL.title = cov;
          oCustL.setAttribute('data-hex', cov);
          if (/^#|^rgb/i.test(cov)) oCustL.style.backgroundColor = cov;
          s.appendChild(oCustL);
          s.value = cov;
        }
      } else s.value = '';
      s.addEventListener('change', function () {
        var key = this.getAttribute('data-link-key');
        var v = this.value;
        if (v) state.linkColorOverrides[key] = v;
        else delete state.linkColorOverrides[key];
        refreshStyleFromUi();
      });
      tdSel.appendChild(s);
      tr.appendChild(td0);
      tr.appendChild(tdChip);
      tr.appendChild(tdSel);
      tbody.appendChild(tr);
    }
    setColorResetButtonsDisabled(false);
  }

  /** Mise à jour légère : taille des valeurs rubans + meta export, sans recalculer tout le graphe. */
  function updateFlowValueLabelsMetaFromUi() {
    readDiagramOptions();
    if (state.layout) {
      state.layout.meta = Object.assign({}, state.layout.meta || {}, {
        sankeyShowFlowValues: state.showLinkValues,
        sankeyLinkDisplayMin: state.linkDisplayMin || 0,
        sankeyLinkValuesFontPx: state.linkValuesFontPx,
        sankeyVertical: state.verticalSankey,
        sankeyValueDisplayMode: state.valueDisplayMode || 'exact',
      });
    }
    syncFlowValueLabels();
  }

  function refreshStyleFromUi() {
    if (!state.graph) return;
    readDiagramOptions();
    state.trace = makeTrace(state.graph);
    if (state.layout) {
      state.layout.meta = Object.assign({}, state.layout.meta || {}, {
        sankeyShowFlowValues: state.showLinkValues,
        sankeyLinkDisplayMin: state.linkDisplayMin || 0,
        sankeyLinkValuesFontPx: state.linkValuesFontPx,
        sankeyVertical: state.verticalSankey,
        sankeyValueDisplayMode: state.valueDisplayMode || 'exact',
      });
    }
    renderPlot();
    populateNodeColorTable();
    populateLinkColorTable();
  }

  function onGenerate(file) {
    clearAlert();
    var btnE = document.getElementById('btn-exporter');
    setBrowseBusy(true);
    setBusy(btnE, true);
    state.nodeColorOverrides = Object.create(null);
    state.linkColorOverrides = Object.create(null);
    state.paletteId = 'institutionnel';
    state.linkColorKey = 'bleu_france';
    parseCsvFile(file, function (err, aggLinks) {
      setBrowseBusy(false);
      setBusy(btnE, false, 'Télécharger');
      var input = document.getElementById('fichier-csv');
      if (err) {
        if (input) input.value = '';
        showAlert(err.message + ' L’aperçu de démonstration a été conservé.', 'error');
        loadDemoPreview();
        return;
      }
      state.isDemo = false;
      state.fileName = baseName(file.name);
      state.links = aggLinks;
      state.graph = buildSankeyGraph(aggLinks);
      state.trace = makeTrace(state.graph);
      state.layout = makeLayout();
      populateNodeColorTable();
      populateLinkColorTable();
      renderPlot();
      updateResume();
      setFichierCsvStatut(true);
    });
  }

  function runWhenPlotly(fn) {
    if (window.Plotly) fn();
    else
      window.addEventListener('load', function once() {
        window.removeEventListener('load', once);
        if (window.Plotly) fn();
      });
  }

  function ready() {
    var input = document.getElementById('fichier-csv');
    var btnE = document.getElementById('btn-exporter');
    if (!input || !btnE) return;

    var btnBrowse = document.getElementById('btn-parcourir-csv');
    if (btnBrowse) {
      btnBrowse.addEventListener('click', function () {
        input.click();
      });
    }

    input.addEventListener('change', function () {
      clearAlert();
      var f = input.files && input.files[0];
      if (!f) {
        setFichierCsvStatut(false);
        return;
      }
      if (!window.Plotly) {
        showAlert('Plotly n’est pas chargé. Vérifiez votre connexion puis rechargez la page.', 'error');
        input.value = '';
        setFichierCsvStatut(false);
        return;
      }
      onGenerate(f);
    });

    btnE.addEventListener('click', function () {
      if (!state.trace) {
        showAlert('Diagramme indisponible.', 'error');
        return;
      }
      onExport();
    });

    var optVal = document.getElementById('opt-afficher-valeurs');
    if (optVal) optVal.addEventListener('change', refreshStyleFromUi);
    var optVert = document.getElementById('opt-sankey-vertical');
    if (optVert) optVert.addEventListener('change', refreshStyleFromUi);
    var seuilFlux = document.getElementById('seuil-flux-affichage');
    if (seuilFlux) {
      seuilFlux.addEventListener('change', refreshStyleFromUi);
      seuilFlux.addEventListener('input', function () {
        if (state.graph) refreshStyleFromUi();
      });
    }

    var tailleRub = document.getElementById('taille-police-valeurs-rubans');
    if (tailleRub) {
      tailleRub.addEventListener('change', updateFlowValueLabelsMetaFromUi);
      tailleRub.addEventListener('input', function () {
        updateFlowValueLabelsMetaFromUi();
      });
    }

    var optFmtVal = document.getElementById('opt-format-valeurs');
    if (optFmtVal) optFmtVal.addEventListener('change', refreshStyleFromUi);

    var btnReset = document.getElementById('btn-reset-couleurs-noeuds');
    if (btnReset)
      btnReset.addEventListener('click', function () {
        state.nodeColorOverrides = Object.create(null);
        refreshStyleFromUi();
      });

    var btnResetFlux = document.getElementById('btn-reset-couleurs-flux');
    if (btnResetFlux)
      btnResetFlux.addEventListener('click', function () {
        state.linkColorOverrides = Object.create(null);
        refreshStyleFromUi();
      });

    var labelResizeTimer = null;
    if (typeof ResizeObserver !== 'undefined') {
      var chartObs = document.getElementById('chart');
      if (chartObs) {
        new ResizeObserver(function () {
          if (labelResizeTimer) clearTimeout(labelResizeTimer);
          labelResizeTimer = setTimeout(syncFlowValueLabels, 100);
        }).observe(chartObs);
      }
    }

    setFichierCsvStatut(false);
    runWhenPlotly(loadDemoPreview);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready);
  } else {
    ready();
  }
})();
