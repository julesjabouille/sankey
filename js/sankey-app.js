/* Compléments locaux : le DSFR fournit la base via CDN */

/* Cadre gris : dimensions fixées par les curseurs ; le diagramme remplit la zone blanche. */
.sankey-chart-wrap {
  width: 100%;
  max-width: 100%;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--border-default-grey, #ddd);
  border-radius: 0;
  background: var(--background-alt-grey, #f6f6f6);
  box-sizing: border-box;
  padding: 0.75rem;
}

.sankey-chart-wrap #chart {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  background: #ffffff;
  border: 1px solid var(--border-default-grey, #e5e5e5);
}

.sankey-chart-wrap .js-plotly-plot,
.sankey-chart-wrap .plotly,
.sankey-chart-wrap .plot-container {
  width: 100% !important;
  height: 100% !important;
}

.sankey-frame-controls {
  border: 1px solid var(--border-default-grey, #ddd);
  padding: 1rem 1.25rem;
  background: var(--background-alt-grey, #f6f6f6);
}

.sankey-frame-controls .fr-range-group {
  margin-bottom: 0.5rem;
}

/* Curseurs visibles même si le JS DSFR n’a pas encore initialisé le composant */
.sankey-frame-controls .fr-range input[type='range'] {
  display: block;
  width: 100%;
  min-height: 2.5rem;
  margin-top: 0.25rem;
  cursor: pointer;
  accent-color: #000091;
}

.sankey-frame-controls .fr-range[data-fr-js-range] input[type='range'] {
  min-height: var(--thumb-size, 1.5rem);
  margin-top: 0;
  accent-color: unset;
}

/* Libellés de valeur sur les rubans Sankey (SVG) — taille via attribut font-size dans le JS */
.sankey-chart-wrap svg text.sankey-app-flow-value {
  font-weight: 700;
  font-family: Marianne, Arial, sans-serif;
  fill: #161616;
}

.sankey-chart-wrap svg g.sankey-app-flow-value-wrap text {
  font-weight: 700;
  font-family: Marianne, Arial, sans-serif;
  fill: #161616;
}

@media print {
  .sankey-chart-wrap {
    break-inside: avoid;
    border: 1px solid #ccc;
    background: #fff;
  }

  .sankey-chart-wrap svg text.sankey-app-flow-value,
  .sankey-chart-wrap svg g.sankey-app-flow-value-wrap text {
    fill: #161616 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}

.fr-callout--privacy {
  border-left: 4px solid var(--border-action-high-blue-france);
}

.sankey-upload-zone {
  position: relative;
}

.sankey-upload-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1rem;
}

.sankey-file-statut.sankey-file-statut--idle {
  color: var(--text-mention-grey, #666);
}

.sankey-file-statut.sankey-file-statut--ok {
  color: var(--text-default-success, #18753c);
  font-weight: 500;
}

.sankey-perso-actions .fr-btn {
  margin-top: 0 !important;
}

.sankey-table-chip-cell {
  vertical-align: middle;
  width: 3rem;
}

.sankey-color-chip {
  display: inline-block;
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 0.25rem;
  border: 1px solid var(--border-default-grey, #3a3a3a);
  box-sizing: border-box;
  vertical-align: middle;
}

.sankey-file-input-hidden {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  padding: 0 !important;
  margin: -1px !important;
  overflow: hidden !important;
  clip: rect(0, 0, 0, 0) !important;
  white-space: nowrap !important;
  border: 0 !important;
}

.sankey-appearance {
  border: 1px solid var(--border-default-grey, #ddd);
  padding: 1rem 1.25rem;
  background: var(--background-alt-grey, #f6f6f6);
}

.sankey-color-select-cell {
  vertical-align: middle;
  min-width: 14rem;
}

#node-color-tbody .fr-select,
#link-color-tbody .fr-select {
  max-width: 100%;
}

/* Évite de masquer les listes natives des <select> (ancêtre overflow scroll). */
.sankey-color-table-wrap .fr-table__wrapper {
  overflow: visible;
  max-height: none;
}

